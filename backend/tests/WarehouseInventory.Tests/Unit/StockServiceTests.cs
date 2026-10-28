using WarehouseInventory.Api.Common;
using WarehouseInventory.Api.Dtos;
using WarehouseInventory.Api.Services;

namespace WarehouseInventory.Tests.Unit;

public class StockServiceTests
{
    private readonly Api.Data.WarehouseDbContext _db = TestData.CreateDb();
    private readonly StockService _service;

    public StockServiceTests()
    {
        _service = new StockService(_db, new FixedTimeProvider());
    }

    [Fact]
    public async Task Receive_NewLocation_CreatesStockAndRecordsMovement()
    {
        var item = _db.AddItem("SKU-1");
        var dock = _db.AddLocation("DOCK");

        var movement = await _service.ReceiveAsync(
            new ReceiveStockRequest { ItemId = item.Id, LocationId = dock.Id, Quantity = 10, Reference = " PO-1 " }, "staff", default);

        Assert.Equal(10, _db.QuantityAt(item, dock));
        Assert.Equal("Receipt", movement.Type);
        Assert.Equal("DOCK", movement.ToLocationCode);
        Assert.Null(movement.FromLocationCode);
        Assert.Equal("PO-1", movement.Reference);
        Assert.Equal("staff", movement.PerformedBy);
    }

    [Fact]
    public async Task Receive_ExistingStock_AddsToQuantity()
    {
        var item = _db.AddItem("SKU-1");
        var dock = _db.AddLocation("DOCK");
        _db.AddStock(item, dock, 4);

        await _service.ReceiveAsync(new ReceiveStockRequest { ItemId = item.Id, LocationId = dock.Id, Quantity = 6 }, "staff", default);

        Assert.Equal(10, _db.QuantityAt(item, dock));
    }

    [Fact]
    public async Task Receive_InactiveItem_IsRejected()
    {
        var item = _db.AddItem("SKU-1", active: false);
        var dock = _db.AddLocation("DOCK");

        await Assert.ThrowsAsync<BusinessRuleException>(() =>
            _service.ReceiveAsync(new ReceiveStockRequest { ItemId = item.Id, LocationId = dock.Id, Quantity = 1 }, "staff", default));
    }

    [Fact]
    public async Task Receive_UnknownLocation_ThrowsNotFound()
    {
        var item = _db.AddItem("SKU-1");

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.ReceiveAsync(new ReceiveStockRequest { ItemId = item.Id, LocationId = 999, Quantity = 1 }, "staff", default));
    }

    [Fact]
    public async Task Transfer_MovesQuantityBetweenLocations()
    {
        var item = _db.AddItem("SKU-1");
        var dock = _db.AddLocation("DOCK");
        var shelf = _db.AddLocation("A-01");
        _db.AddStock(item, dock, 10);

        var movement = await _service.TransferAsync(
            new TransferStockRequest { ItemId = item.Id, FromLocationId = dock.Id, ToLocationId = shelf.Id, Quantity = 7 }, "staff", default);

        Assert.Equal(3, _db.QuantityAt(item, dock));
        Assert.Equal(7, _db.QuantityAt(item, shelf));
        Assert.Equal("Transfer", movement.Type);
        Assert.Equal("DOCK", movement.FromLocationCode);
        Assert.Equal("A-01", movement.ToLocationCode);
    }

    [Fact]
    public async Task Transfer_MoreThanAvailable_IsRejectedAndStockUnchanged()
    {
        var item = _db.AddItem("SKU-1");
        var dock = _db.AddLocation("DOCK");
        var shelf = _db.AddLocation("A-01");
        _db.AddStock(item, dock, 2);

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            _service.TransferAsync(new TransferStockRequest { ItemId = item.Id, FromLocationId = dock.Id, ToLocationId = shelf.Id, Quantity = 3 }, "staff", default));

        Assert.Contains("2 available", ex.Message);
        Assert.Equal(2, _db.QuantityAt(item, dock));
    }

    [Fact]
    public async Task Transfer_SameLocation_IsRejected()
    {
        var item = _db.AddItem("SKU-1");
        var dock = _db.AddLocation("DOCK");
        _db.AddStock(item, dock, 5);

        await Assert.ThrowsAsync<BusinessRuleException>(() =>
            _service.TransferAsync(new TransferStockRequest { ItemId = item.Id, FromLocationId = dock.Id, ToLocationId = dock.Id, Quantity = 1 }, "staff", default));
    }

    [Fact]
    public async Task Transfer_ToInactiveLocation_IsRejected()
    {
        var item = _db.AddItem("SKU-1");
        var dock = _db.AddLocation("DOCK");
        var closed = _db.AddLocation("OLD", active: false);
        _db.AddStock(item, dock, 5);

        await Assert.ThrowsAsync<BusinessRuleException>(() =>
            _service.TransferAsync(new TransferStockRequest { ItemId = item.Id, FromLocationId = dock.Id, ToLocationId = closed.Id, Quantity = 1 }, "staff", default));
    }

    [Fact]
    public async Task GetMovements_FiltersByLocation_NewestFirst()
    {
        var item = _db.AddItem("SKU-1");
        var dock = _db.AddLocation("DOCK");
        var shelf = _db.AddLocation("A-01");
        var other = _db.AddLocation("B-01");
        await _service.ReceiveAsync(new ReceiveStockRequest { ItemId = item.Id, LocationId = dock.Id, Quantity = 5 }, "staff", default);
        await _service.ReceiveAsync(new ReceiveStockRequest { ItemId = item.Id, LocationId = other.Id, Quantity = 5 }, "staff", default);
        await _service.TransferAsync(new TransferStockRequest { ItemId = item.Id, FromLocationId = dock.Id, ToLocationId = shelf.Id, Quantity = 2 }, "staff", default);

        var movements = await _service.GetMovementsAsync(itemId: null, locationId: dock.Id, take: 50, default);

        Assert.Equal(new[] { "Transfer", "Receipt" }, movements.Select(m => m.Type));
    }
}
