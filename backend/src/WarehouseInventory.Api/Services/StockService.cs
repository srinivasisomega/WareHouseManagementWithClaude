using Microsoft.EntityFrameworkCore;
using WarehouseInventory.Api.Common;
using WarehouseInventory.Api.Data;
using WarehouseInventory.Api.Domain;
using WarehouseInventory.Api.Dtos;

namespace WarehouseInventory.Api.Services;

/// <summary>Changes on-hand stock (receipts and transfers) and queries the movement audit trail.</summary>
public interface IStockService
{
    /// <summary>Adds received units to an item's stock at a location and records a Receipt movement.</summary>
    /// <param name="request">Item, location, quantity and optional reference.</param>
    /// <param name="performedBy">Username recorded on the movement.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The recorded movement.</returns>
    /// <exception cref="NotFoundException">The item or location was not found.</exception>
    /// <exception cref="BusinessRuleException">The item or location is inactive.</exception>
    /// <exception cref="DbUpdateConcurrencyException">The stock level was changed concurrently by another request.</exception>
    Task<StockMovementDto> ReceiveAsync(ReceiveStockRequest request, string performedBy, CancellationToken ct);

    /// <summary>Moves units of an item between two locations and records a Transfer movement.</summary>
    /// <param name="request">Item, source and destination locations, quantity and optional reference.</param>
    /// <param name="performedBy">Username recorded on the movement.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The recorded movement.</returns>
    /// <exception cref="NotFoundException">The item or destination location was not found.</exception>
    /// <exception cref="BusinessRuleException">
    /// Source equals destination, the item or destination is inactive, or the source has insufficient stock.
    /// </exception>
    /// <exception cref="DbUpdateConcurrencyException">A stock level was changed concurrently by another request.</exception>
    Task<StockMovementDto> TransferAsync(TransferStockRequest request, string performedBy, CancellationToken ct);

    /// <summary>Lists stock movements, newest first.</summary>
    /// <param name="itemId">Optional item filter.</param>
    /// <param name="locationId">Optional location filter; matches movements from or to the location.</param>
    /// <param name="take">Maximum rows, clamped to 1..<see cref="StockService.MaxMovementsPage"/>.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The matching movements.</returns>
    Task<IReadOnlyList<StockMovementDto>> GetMovementsAsync(int? itemId, int? locationId, int take, CancellationToken ct);
}

/// <summary>
/// EF Core implementation of <see cref="IStockService"/>. Each stock change and its audit movement are saved
/// in one SaveChanges call; stock-level row versions guard against concurrent updates.
/// </summary>
public sealed class StockService : IStockService
{
    /// <summary>Upper bound on the number of movements returned by <see cref="GetMovementsAsync"/>.</summary>
    public const int MaxMovementsPage = 500;

    private readonly WarehouseDbContext _db;
    private readonly TimeProvider _clock;

    /// <summary>Creates the service.</summary>
    /// <param name="db">Database context.</param>
    /// <param name="clock">Time source for movement timestamps.</param>
    public StockService(WarehouseDbContext db, TimeProvider clock)
    {
        _db = db;
        _clock = clock;
    }

    /// <inheritdoc />
    public async Task<StockMovementDto> ReceiveAsync(ReceiveStockRequest request, string performedBy, CancellationToken ct)
    {
        //these methods are called to verify the item and location exist and are active
        await EnsureActiveItemAsync(request.ItemId, ct);
        await EnsureActiveLocationAsync(request.LocationId, ct);

        //this method is called to load the stock level, creating an empty one if the item is new to the location
        var level = await _db.GetOrAddStockLevelAsync(request.ItemId, request.LocationId, ct);
        level.Quantity += request.Quantity;

        //this method is called to add the Receipt audit record, saved together with the stock change
        var movement = AddMovement(MovementType.Receipt, request.ItemId, null, request.LocationId, request.Quantity, request.Reference, performedBy);
        await _db.SaveChangesAsync(ct);
        //this method is called to re-read the movement with item and location details for the response
        return await GetMovementAsync(movement.Id, ct);
    }

    /// <inheritdoc />
    public async Task<StockMovementDto> TransferAsync(TransferStockRequest request, string performedBy, CancellationToken ct)
    {
        if (request.FromLocationId == request.ToLocationId)
        {
            throw new BusinessRuleException("Source and destination locations must be different.");
        }

        //these methods are called to verify the item and destination exist and are active
        await EnsureActiveItemAsync(request.ItemId, ct);
        await EnsureActiveLocationAsync(request.ToLocationId, ct);

        //this method is called to verify the source location can supply the quantity
        var source = await _db.GetStockForRemovalAsync(request.ItemId, request.FromLocationId, request.Quantity, ct);
        //this method is called to load or create the destination stock level
        var destination = await _db.GetOrAddStockLevelAsync(request.ItemId, request.ToLocationId, ct);
        source.Quantity -= request.Quantity;
        destination.Quantity += request.Quantity;

        //this method is called to add the Transfer audit record, saved together with both stock changes
        var movement = AddMovement(MovementType.Transfer, request.ItemId, request.FromLocationId, request.ToLocationId, request.Quantity, request.Reference, performedBy);
        await _db.SaveChangesAsync(ct);
        //this method is called to re-read the movement with item and location details for the response
        return await GetMovementAsync(movement.Id, ct);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<StockMovementDto>> GetMovementsAsync(int? itemId, int? locationId, int take, CancellationToken ct)
    {
        var query = _db.StockMovements.AsNoTracking();
        if (itemId is not null)
        {
            query = query.Where(m => m.ItemId == itemId);
        }

        if (locationId is not null)
        {
            query = query.Where(m => m.FromLocationId == locationId || m.ToLocationId == locationId);
        }

        return await Project(query.OrderByDescending(m => m.CreatedAtUtc).ThenByDescending(m => m.Id))
            .Take(Math.Clamp(take, 1, MaxMovementsPage))
            .ToListAsync(ct);
    }

    /// <summary>Adds an audit movement stamped with the current time; it is persisted with the caller's SaveChanges.</summary>
    /// <param name="type">Movement type.</param>
    /// <param name="itemId">Item moved.</param>
    /// <param name="fromId">Source location, or null for receipts.</param>
    /// <param name="toId">Destination location.</param>
    /// <param name="quantity">Units moved.</param>
    /// <param name="reference">Optional reference text.</param>
    /// <param name="performedBy">Username performing the movement.</param>
    /// <returns>The tracked movement entity.</returns>
    private StockMovement AddMovement(MovementType type, int itemId, int? fromId, int? toId, int quantity, string? reference, string performedBy) =>
        _db.RecordMovement(type, itemId, fromId, toId, quantity, reference, performedBy, _clock.GetUtcNow().UtcDateTime);

    /// <summary>Verifies the item exists and is active.</summary>
    /// <param name="itemId">Item id.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <exception cref="NotFoundException">No item has this id.</exception>
    /// <exception cref="BusinessRuleException">The item is inactive.</exception>
    private async Task EnsureActiveItemAsync(int itemId, CancellationToken ct)
    {
        var item = await _db.Items.AsNoTracking().Where(i => i.Id == itemId).Select(i => new { i.IsActive }).FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException($"Item {itemId} was not found.");
        if (!item.IsActive)
        {
            throw new BusinessRuleException("The selected item is inactive.");
        }
    }

    /// <summary>Verifies the location exists and is active.</summary>
    /// <param name="locationId">Location id.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <exception cref="NotFoundException">No location has this id.</exception>
    /// <exception cref="BusinessRuleException">The location is inactive.</exception>
    private async Task EnsureActiveLocationAsync(int locationId, CancellationToken ct)
    {
        var location = await _db.Locations.AsNoTracking().Where(l => l.Id == locationId).Select(l => new { l.IsActive }).FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException($"Location {locationId} was not found.");
        if (!location.IsActive)
        {
            throw new BusinessRuleException("The selected location is inactive.");
        }
    }

    private async Task<StockMovementDto> GetMovementAsync(int id, CancellationToken ct) =>
        await Project(_db.StockMovements.AsNoTracking().Where(m => m.Id == id)).FirstAsync(ct);

    /// <summary>Projects movements to DTOs in SQL, joining item and location codes.</summary>
    /// <param name="query">The movement query to project.</param>
    /// <returns>A composable DTO query.</returns>
    internal static IQueryable<StockMovementDto> Project(IQueryable<StockMovement> query) =>
        query.Select(m => new StockMovementDto(
            m.Id,
            m.Type.ToString(),
            m.ItemId,
            m.Item.Sku,
            m.Item.Name,
            m.FromLocation != null ? m.FromLocation.Code : null,
            m.ToLocation != null ? m.ToLocation.Code : null,
            m.Quantity,
            m.Reference,
            m.PerformedBy,
            m.CreatedAtUtc));
}
