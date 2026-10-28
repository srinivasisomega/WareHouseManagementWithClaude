using WarehouseInventory.Api.Common;
using WarehouseInventory.Api.Dtos;
using WarehouseInventory.Api.Services;

namespace WarehouseInventory.Tests.Unit;

public class ItemServiceTests
{
    private readonly Api.Data.WarehouseDbContext _db = TestData.CreateDb();
    private readonly ItemService _service;

    public ItemServiceTests()
    {
        _service = new ItemService(_db, new FixedTimeProvider());
    }

    [Fact]
    public async Task CreateItem_NormalizesSkuAndUnit_AndTrimsName()
    {
        var item = await _service.CreateItemAsync(
            new ItemRequest { Sku = " ab-100 ", Name = "  Widget ", UnitOfMeasure = "ea", LowStockThreshold = 5 }, default);

        Assert.Equal("AB-100", item.Sku);
        Assert.Equal("Widget", item.Name);
        Assert.Equal("EA", item.UnitOfMeasure);
        Assert.Equal(5, item.LowStockThreshold);
        Assert.True(item.IsActive);
    }

    [Fact]
    public async Task CreateItem_DuplicateSkuIgnoringCase_ThrowsConflict()
    {
        _db.AddItem("AB-100");

        await Assert.ThrowsAsync<ConflictException>(() =>
            _service.CreateItemAsync(new ItemRequest { Sku = "ab-100", Name = "Other", UnitOfMeasure = "EA" }, default));
    }

    [Fact]
    public async Task UpdateItem_KeepingSameSku_Succeeds()
    {
        var existing = _db.AddItem("AB-100");

        var updated = await _service.UpdateItemAsync(existing.Id,
            new ItemRequest { Sku = "AB-100", Name = "Renamed", UnitOfMeasure = "BOX", IsActive = false }, default);

        Assert.Equal("Renamed", updated.Name);
        Assert.Equal("BOX", updated.UnitOfMeasure);
        Assert.False(updated.IsActive);
    }

    [Fact]
    public async Task UpdateItem_ToAnotherItemsSku_ThrowsConflict()
    {
        _db.AddItem("AB-100");
        var second = _db.AddItem("AB-200");

        await Assert.ThrowsAsync<ConflictException>(() =>
            _service.UpdateItemAsync(second.Id, new ItemRequest { Sku = "AB-100", Name = "x", UnitOfMeasure = "EA" }, default));
    }

    [Fact]
    public async Task UpdateItem_UnknownId_ThrowsNotFound()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            _service.UpdateItemAsync(999, new ItemRequest { Sku = "X", Name = "x", UnitOfMeasure = "EA" }, default));
    }

    [Fact]
    public async Task UpdateThreshold_ChangesOnlyThreshold()
    {
        var existing = _db.AddItem("AB-100", threshold: 1);

        var updated = await _service.UpdateThresholdAsync(existing.Id, new ThresholdRequest { LowStockThreshold = 25 }, default);

        Assert.Equal(25, updated.LowStockThreshold);
        Assert.Equal("AB-100", updated.Sku);
    }

    [Fact]
    public async Task GetItems_ExcludesInactiveByDefault_AndFiltersBySearch()
    {
        _db.AddItem("AB-100", name: "Blue widget");
        _db.AddItem("AB-200", name: "Red gadget");
        _db.AddItem("AB-300", name: "Old widget", active: false);

        var active = await _service.GetItemsAsync(search: "widget", includeInactive: false, default);
        var all = await _service.GetItemsAsync(search: "widget", includeInactive: true, default);

        Assert.Equal(new[] { "AB-100" }, active.Select(i => i.Sku));
        Assert.Equal(new[] { "AB-100", "AB-300" }, all.Select(i => i.Sku));
    }
}
