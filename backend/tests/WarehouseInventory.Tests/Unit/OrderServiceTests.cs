using Microsoft.EntityFrameworkCore;
using WarehouseInventory.Api.Common;
using WarehouseInventory.Api.Domain;
using WarehouseInventory.Api.Dtos;
using WarehouseInventory.Api.Services;

namespace WarehouseInventory.Tests.Unit;

public class OrderServiceTests
{
    private readonly Api.Data.WarehouseDbContext _db = TestData.CreateDb();
    private readonly OrderService _service;
    private readonly Item _item;
    private readonly Location _shelf;

    public OrderServiceTests()
    {
        _service = new OrderService(_db, new FixedTimeProvider());
        _item = _db.AddItem("SKU-1");
        _shelf = _db.AddLocation("A-01");
        _db.AddStock(_item, _shelf, 10);
    }

    private Task<OrderDetailDto> CreateOrder(int quantity = 4) =>
        _service.CreateOrderAsync(new CreateOrderRequest
        {
            CustomerName = " Acme ",
            Lines = { new CreateOrderLineRequest { ItemId = _item.Id, Quantity = quantity } },
        }, "staff", default);

    private Task<OrderDetailDto> Pick(OrderDetailDto order, int quantity) =>
        _service.PickAsync(order.Id, new PickRequest { OrderLineId = order.Lines[0].Id, LocationId = _shelf.Id, Quantity = quantity }, "staff", default);

    [Fact]
    public async Task CreateOrder_StartsOpen_WithGeneratedNumberAndPickSuggestions()
    {
        var order = await CreateOrder();

        Assert.Equal("Open", order.Status);
        Assert.Equal("Acme", order.CustomerName);
        Assert.StartsWith("ORD-20261027-", order.OrderNumber);
        var line = Assert.Single(order.Lines);
        Assert.Equal(4, line.QuantityOrdered);
        Assert.Equal(0, line.QuantityPicked);
        Assert.Equal("A-01", Assert.Single(line.AvailableLocations).LocationCode);
    }

    [Fact]
    public async Task CreateOrder_DuplicateItemLines_IsRejected()
    {
        var request = new CreateOrderRequest
        {
            CustomerName = "Acme",
            Lines =
            {
                new CreateOrderLineRequest { ItemId = _item.Id, Quantity = 1 },
                new CreateOrderLineRequest { ItemId = _item.Id, Quantity = 2 },
            },
        };

        await Assert.ThrowsAsync<BusinessRuleException>(() => _service.CreateOrderAsync(request, "staff", default));
    }

    [Fact]
    public async Task CreateOrder_InactiveOrUnknownItem_IsRejected()
    {
        var inactive = _db.AddItem("OLD", active: false);
        var request = new CreateOrderRequest
        {
            CustomerName = "Acme",
            Lines =
            {
                new CreateOrderLineRequest { ItemId = inactive.Id, Quantity = 1 },
                new CreateOrderLineRequest { ItemId = 999, Quantity = 1 },
            },
        };

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => _service.CreateOrderAsync(request, "staff", default));
        Assert.Contains("999", ex.Message);
    }

    [Fact]
    public async Task PartialPick_MovesToPicking_DeductsStock_AndRecordsMovement()
    {
        var order = await Pick(await CreateOrder(quantity: 4), 3);

        Assert.Equal("Picking", order.Status);
        Assert.Equal(3, order.Lines[0].QuantityPicked);
        Assert.Equal(7, _db.QuantityAt(_item, _shelf));
        var movement = await _db.StockMovements.SingleAsync();
        Assert.Equal(MovementType.Pick, movement.Type);
        Assert.Equal(order.OrderNumber, movement.Reference);
        Assert.Equal(_shelf.Id, movement.FromLocationId);
    }

    [Fact]
    public async Task FullPick_MovesToPicked()
    {
        var order = await Pick(await CreateOrder(quantity: 4), 4);

        Assert.Equal("Picked", order.Status);
    }

    [Fact]
    public async Task Pick_MoreThanRemainingOnLine_IsRejected()
    {
        var order = await Pick(await CreateOrder(quantity: 4), 3);

        await Assert.ThrowsAsync<BusinessRuleException>(() => Pick(order, 2));
        Assert.Equal(7, _db.QuantityAt(_item, _shelf));
    }

    [Fact]
    public async Task Pick_MoreThanLocationHolds_IsRejected()
    {
        var order = await CreateOrder(quantity: 4);
        var empty = _db.AddLocation("B-01");

        await Assert.ThrowsAsync<BusinessRuleException>(() =>
            _service.PickAsync(order.Id, new PickRequest { OrderLineId = order.Lines[0].Id, LocationId = empty.Id, Quantity = 1 }, "staff", default));
    }

    [Fact]
    public async Task Pick_UnknownLine_ThrowsNotFound()
    {
        var order = await CreateOrder();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.PickAsync(order.Id, new PickRequest { OrderLineId = 999, LocationId = _shelf.Id, Quantity = 1 }, "staff", default));
    }

    [Fact]
    public async Task Pack_BeforeFullyPicked_IsRejected()
    {
        var order = await Pick(await CreateOrder(quantity: 4), 1);

        await Assert.ThrowsAsync<BusinessRuleException>(() => _service.PackAsync(order.Id, new PackRequest { PackageCount = 1 }, default));
    }

    [Fact]
    public async Task Dispatch_BeforePacked_IsRejected()
    {
        var order = await Pick(await CreateOrder(quantity: 4), 4);

        await Assert.ThrowsAsync<BusinessRuleException>(() => _service.DispatchAsync(order.Id, new DispatchRequest { Carrier = "UPS" }, default));
    }

    [Fact]
    public async Task FullWorkflow_PickPackDispatch()
    {
        var order = await Pick(await CreateOrder(quantity: 4), 4);

        order = await _service.PackAsync(order.Id, new PackRequest { PackageCount = 2 }, default);
        Assert.Equal("Packed", order.Status);
        Assert.Equal(2, order.PackageCount);
        Assert.NotNull(order.PackedAtUtc);

        order = await _service.DispatchAsync(order.Id, new DispatchRequest { Carrier = " UPS ", TrackingNumber = "1Z999" }, default);
        Assert.Equal("Dispatched", order.Status);
        Assert.Equal("UPS", order.Carrier);
        Assert.Equal("1Z999", order.TrackingNumber);
        Assert.NotNull(order.DispatchedAtUtc);

        await Assert.ThrowsAsync<BusinessRuleException>(() => Pick(order, 1));
    }

    [Fact]
    public async Task GetOrders_FiltersByStatus()
    {
        await CreateOrder(quantity: 1);
        await Pick(await CreateOrder(quantity: 1), 1);

        var picked = await _service.GetOrdersAsync(OrderStatus.Picked, default);

        Assert.Equal("Picked", Assert.Single(picked).Status);
        Assert.Equal(2, (await _service.GetOrdersAsync(null, default)).Count);
    }
}
