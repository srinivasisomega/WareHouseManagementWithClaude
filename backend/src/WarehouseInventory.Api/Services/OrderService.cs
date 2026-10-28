using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using WarehouseInventory.Api.Common;
using WarehouseInventory.Api.Data;
using WarehouseInventory.Api.Domain;
using WarehouseInventory.Api.Dtos;

namespace WarehouseInventory.Api.Services;

/// <summary>Creates outbound orders and moves them through pick, pack and dispatch.</summary>
public interface IOrderService
{
    /// <summary>Lists orders, newest first.</summary>
    /// <param name="status">Optional status filter.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Order summaries with line and unit totals.</returns>
    Task<IReadOnlyList<OrderSummaryDto>> GetOrdersAsync(OrderStatus? status, CancellationToken ct);

    /// <summary>Returns an order with its lines and the active locations currently holding each line's item.</summary>
    /// <param name="id">Order id.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The order detail.</returns>
    /// <exception cref="NotFoundException">No order has this id.</exception>
    Task<OrderDetailDto> GetOrderAsync(int id, CancellationToken ct);

    /// <summary>Creates an order in the Open status with a generated order number.</summary>
    /// <param name="request">Customer and order lines.</param>
    /// <param name="createdBy">Username recorded as the order's creator.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The created order detail.</returns>
    /// <exception cref="BusinessRuleException">An item appears more than once, or an item does not exist or is inactive.</exception>
    Task<OrderDetailDto> CreateOrderAsync(CreateOrderRequest request, string createdBy, CancellationToken ct);

    /// <summary>
    /// Picks units for one line from a location: removes the stock, records a Pick movement, and sets the order
    /// to Picking, or Picked once every line is complete.
    /// </summary>
    /// <param name="orderId">Order id.</param>
    /// <param name="request">Order line, source location and quantity.</param>
    /// <param name="performedBy">Username recorded on the stock movement.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The updated order detail.</returns>
    /// <exception cref="NotFoundException">The order, or the line on this order, was not found.</exception>
    /// <exception cref="BusinessRuleException">
    /// The order is not Open or Picking, the quantity exceeds what remains on the line, or the location has insufficient stock.
    /// </exception>
    /// <exception cref="DbUpdateConcurrencyException">The stock level was changed concurrently by another request.</exception>
    Task<OrderDetailDto> PickAsync(int orderId, PickRequest request, string performedBy, CancellationToken ct);

    /// <summary>Marks a fully picked order as Packed and records the package count.</summary>
    /// <param name="orderId">Order id.</param>
    /// <param name="request">Number of packages.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The updated order detail.</returns>
    /// <exception cref="NotFoundException">No order has this id.</exception>
    /// <exception cref="BusinessRuleException">The order is not in the Picked status.</exception>
    Task<OrderDetailDto> PackAsync(int orderId, PackRequest request, CancellationToken ct);

    /// <summary>Marks a packed order as Dispatched and records the carrier and tracking number.</summary>
    /// <param name="orderId">Order id.</param>
    /// <param name="request">Carrier and optional tracking number.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The updated order detail.</returns>
    /// <exception cref="NotFoundException">No order has this id.</exception>
    /// <exception cref="BusinessRuleException">The order is not in the Packed status.</exception>
    Task<OrderDetailDto> DispatchAsync(int orderId, DispatchRequest request, CancellationToken ct);
}

/// <summary>
/// Outbound workflow: Open → Picking → Picked → Packed → Dispatched.
/// Picking removes stock from a location; packing requires every line fully picked; dispatch requires packing.
/// </summary>
public sealed class OrderService : IOrderService
{
    private readonly WarehouseDbContext _db;
    private readonly TimeProvider _clock;

    /// <summary>Creates the service.</summary>
    /// <param name="db">Database context.</param>
    /// <param name="clock">Time source for order numbers and workflow timestamps.</param>
    public OrderService(WarehouseDbContext db, TimeProvider clock)
    {
        _db = db;
        _clock = clock;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<OrderSummaryDto>> GetOrdersAsync(OrderStatus? status, CancellationToken ct)
    {
        var query = _db.Orders.AsNoTracking();
        if (status is not null)
        {
            query = query.Where(o => o.Status == status);
        }

        var rows = await query
            .OrderByDescending(o => o.CreatedAtUtc)
            .Select(o => new
            {
                o.Id,
                o.OrderNumber,
                o.CustomerName,
                o.Status,
                LineCount = o.Lines.Count,
                TotalUnits = o.Lines.Sum(l => l.QuantityOrdered),
                o.CreatedAtUtc,
            })
            .ToListAsync(ct);

        return rows
            .Select(o => new OrderSummaryDto(o.Id, o.OrderNumber, o.CustomerName, o.Status.ToString(), o.LineCount, o.TotalUnits, o.CreatedAtUtc))
            .ToList();
    }

    /// <inheritdoc />
    public async Task<OrderDetailDto> GetOrderAsync(int id, CancellationToken ct)
    {
        var order = await _db.Orders.AsNoTracking()
            .Include(o => o.Lines).ThenInclude(l => l.Item)
            .FirstOrDefaultAsync(o => o.Id == id, ct)
            ?? throw new NotFoundException($"Order {id} was not found.");

        return await ToDetailAsync(order, ct);
    }

    /// <inheritdoc />
    public async Task<OrderDetailDto> CreateOrderAsync(CreateOrderRequest request, string createdBy, CancellationToken ct)
    {
        var itemIds = request.Lines.Select(l => l.ItemId).ToList();
        if (itemIds.Distinct().Count() != itemIds.Count)
        {
            throw new BusinessRuleException("Each item may appear only once per order.");
        }

        //every requested item must exist and be active; anything missing from this list is rejected
        var activeItemIds = await _db.Items.Where(i => itemIds.Contains(i.Id) && i.IsActive).Select(i => i.Id).ToListAsync(ct);
        var invalid = itemIds.Except(activeItemIds).ToList();
        if (invalid.Count > 0)
        {
            throw new BusinessRuleException($"These items do not exist or are inactive: {string.Join(", ", invalid)}.");
        }

        var now = _clock.GetUtcNow().UtcDateTime;
        //order number is the creation date plus a random 6-hex-digit suffix
        var order = new FulfillmentOrder
        {
            OrderNumber = $"ORD-{now:yyyyMMdd}-{Convert.ToHexString(RandomNumberGenerator.GetBytes(3))}",
            CustomerName = request.CustomerName.Trim(),
            Status = OrderStatus.Open,
            CreatedBy = createdBy,
            CreatedAtUtc = now,
            Lines = request.Lines.Select(l => new OrderLine { ItemId = l.ItemId, QuantityOrdered = l.Quantity }).ToList(),
        };

        _db.Orders.Add(order);
        await _db.SaveChangesAsync(ct);
        //this method is called to reload the order with item details and stock locations
        return await GetOrderAsync(order.Id, ct);
    }

    /// <inheritdoc />
    public async Task<OrderDetailDto> PickAsync(int orderId, PickRequest request, string performedBy, CancellationToken ct)
    {
        //this method is called to load the tracked order with its lines or throw NotFoundException
        var order = await LoadForUpdateAsync(orderId, ct);
        if (order.Status is not (OrderStatus.Open or OrderStatus.Picking))
        {
            throw new BusinessRuleException($"Order {order.OrderNumber} is {order.Status} and can no longer be picked.");
        }

        var line = order.Lines.FirstOrDefault(l => l.Id == request.OrderLineId)
            ?? throw new NotFoundException($"Order line {request.OrderLineId} was not found on order {order.OrderNumber}.");

        var remaining = line.QuantityOrdered - line.QuantityPicked;
        if (request.Quantity > remaining)
        {
            throw new BusinessRuleException($"Cannot pick {request.Quantity}; only {remaining} remaining on this line.");
        }

        //this method is called to load the stock level and verify the location can supply the quantity
        var stock = await _db.GetStockForRemovalAsync(line.ItemId, request.LocationId, request.Quantity, ct);
        stock.Quantity -= request.Quantity;
        line.QuantityPicked += request.Quantity;
        order.Status = order.Lines.All(l => l.QuantityPicked == l.QuantityOrdered) ? OrderStatus.Picked : OrderStatus.Picking;

        //this method is called to add the Pick audit record, saved together with the stock change
        _db.RecordMovement(MovementType.Pick, line.ItemId, request.LocationId, null, request.Quantity, order.OrderNumber,
            performedBy, _clock.GetUtcNow().UtcDateTime);

        //a concurrent change to the same stock level fails here with DbUpdateConcurrencyException (mapped to 409)
        await _db.SaveChangesAsync(ct);
        return await GetOrderAsync(orderId, ct);
    }

    /// <inheritdoc />
    public async Task<OrderDetailDto> PackAsync(int orderId, PackRequest request, CancellationToken ct)
    {
        var order = await LoadForUpdateAsync(orderId, ct);
        if (order.Status != OrderStatus.Picked)
        {
            throw new BusinessRuleException($"Order {order.OrderNumber} must be fully picked before packing (current status: {order.Status}).");
        }

        order.Status = OrderStatus.Packed;
        order.PackageCount = request.PackageCount;
        order.PackedAtUtc = _clock.GetUtcNow().UtcDateTime;

        await _db.SaveChangesAsync(ct);
        return await GetOrderAsync(orderId, ct);
    }

    /// <inheritdoc />
    public async Task<OrderDetailDto> DispatchAsync(int orderId, DispatchRequest request, CancellationToken ct)
    {
        var order = await LoadForUpdateAsync(orderId, ct);
        if (order.Status != OrderStatus.Packed)
        {
            throw new BusinessRuleException($"Order {order.OrderNumber} must be packed before dispatch (current status: {order.Status}).");
        }

        order.Status = OrderStatus.Dispatched;
        order.Carrier = request.Carrier.Trim();
        order.TrackingNumber = string.IsNullOrWhiteSpace(request.TrackingNumber) ? null : request.TrackingNumber.Trim();
        order.DispatchedAtUtc = _clock.GetUtcNow().UtcDateTime;

        await _db.SaveChangesAsync(ct);
        return await GetOrderAsync(orderId, ct);
    }

    /// <summary>Loads a tracked order with its lines for a workflow update.</summary>
    /// <param name="orderId">Order id.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The tracked order.</returns>
    /// <exception cref="NotFoundException">No order has this id.</exception>
    private async Task<FulfillmentOrder> LoadForUpdateAsync(int orderId, CancellationToken ct) =>
        await _db.Orders.Include(o => o.Lines).FirstOrDefaultAsync(o => o.Id == orderId, ct)
        ?? throw new NotFoundException($"Order {orderId} was not found.");

    /// <summary>
    /// Maps an order to its detail DTO, attaching for each line the active locations that hold its item,
    /// loaded in a single query for all of the order's items.
    /// </summary>
    /// <param name="order">Order with lines and line items loaded.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The order detail.</returns>
    private async Task<OrderDetailDto> ToDetailAsync(FulfillmentOrder order, CancellationToken ct)
    {
        var itemIds = order.Lines.Select(l => l.ItemId).Distinct().ToList();
        var stockByItem = (await _db.StockLevels.AsNoTracking()
                .Where(s => itemIds.Contains(s.ItemId) && s.Quantity > 0 && s.Location.IsActive)
                .OrderBy(s => s.Location.Code)
                .Select(s => new { s.ItemId, Stock = new LocationStockDto(s.LocationId, s.Location.Code, s.Location.Name, s.Quantity) })
                .ToListAsync(ct))
            .ToLookup(x => x.ItemId, x => x.Stock);

        var lines = order.Lines
            .OrderBy(l => l.Id)
            .Select(l => new OrderLineDto(l.Id, l.ItemId, l.Item.Sku, l.Item.Name, l.QuantityOrdered, l.QuantityPicked, stockByItem[l.ItemId].ToList()))
            .ToList();

        return new OrderDetailDto(order.Id, order.OrderNumber, order.CustomerName, order.Status.ToString(), order.PackageCount,
            order.Carrier, order.TrackingNumber, order.CreatedBy, order.CreatedAtUtc, order.PackedAtUtc, order.DispatchedAtUtc, lines);
    }
}
