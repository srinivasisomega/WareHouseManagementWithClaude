using WarehouseInventory.Api.Services;

namespace WarehouseInventory.Tests.Unit;

public class InventoryServiceTests
{
    private readonly Api.Data.WarehouseDbContext _db = TestData.CreateDb();
    private readonly InventoryService _service;

    public InventoryServiceTests()
    {
        _service = new InventoryService(_db);
    }

    [Theory]
    [InlineData(0, 0, false)]   // threshold 0 disables alerts
    [InlineData(5, 10, true)]   // below threshold
    [InlineData(10, 10, true)]  // at threshold
    [InlineData(11, 10, false)] // above threshold
    public void IsLowStock_FollowsThresholdRule(int total, int threshold, bool expected) =>
        Assert.Equal(expected, InventoryService.IsLowStock(total, threshold));

    [Fact]
    public async Task Search_ReturnsTotalsAndPerLocationBreakdown()
    {
        var item = _db.AddItem("SKU-1", threshold: 5);
        var a = _db.AddLocation("A-01");
        var b = _db.AddLocation("B-01");
        _db.AddStock(item, a, 3);
        _db.AddStock(item, b, 4);

        var result = Assert.Single(await _service.SearchAsync(null, null, false, default));

        Assert.Equal(7, result.TotalQuantity);
        Assert.False(result.IsLowStock);
        Assert.Equal(new[] { "A-01", "B-01" }, result.Locations.Select(l => l.LocationCode));
    }

    [Fact]
    public async Task Search_ItemWithNoStock_HasZeroTotal()
    {
        _db.AddItem("SKU-1", threshold: 1);

        var result = Assert.Single(await _service.SearchAsync(null, null, false, default));

        Assert.Equal(0, result.TotalQuantity);
        Assert.True(result.IsLowStock);
        Assert.Empty(result.Locations);
    }

    [Fact]
    public async Task Search_LowStockOnly_ExcludesHealthyAndUnmonitoredItems()
    {
        var shelf = _db.AddLocation("A-01");
        _db.AddStock(_db.AddItem("LOW", threshold: 10), shelf, 2);
        _db.AddStock(_db.AddItem("OK", threshold: 10), shelf, 50);
        _db.AddItem("UNMONITORED", threshold: 0);

        var result = await _service.SearchAsync(null, null, lowStockOnly: true, default);

        Assert.Equal(new[] { "LOW" }, result.Select(r => r.Sku));
    }

    [Fact]
    public async Task Search_ByLocation_ReturnsOnlyItemsStockedThere()
    {
        var a = _db.AddLocation("A-01");
        var b = _db.AddLocation("B-01");
        _db.AddStock(_db.AddItem("IN-A"), a, 1);
        _db.AddStock(_db.AddItem("IN-B"), b, 1);

        var result = await _service.SearchAsync(null, a.Id, false, default);

        Assert.Equal(new[] { "IN-A" }, result.Select(r => r.Sku));
    }

    [Fact]
    public async Task Search_ByTerm_MatchesSkuOrName_AndSkipsInactive()
    {
        _db.AddItem("BOLT-1", name: "Hex bolt");
        _db.AddItem("NUT-1", name: "Hex nut");
        _db.AddItem("WASH-1", name: "Washer");
        _db.AddItem("BOLT-OLD", name: "Old bolt", active: false);

        var result = await _service.SearchAsync("Hex", null, false, default);

        Assert.Equal(new[] { "BOLT-1", "NUT-1" }, result.Select(r => r.Sku));
    }

    [Fact]
    public async Task Alerts_OrderedByLargestShortfall()
    {
        var shelf = _db.AddLocation("A-01");
        _db.AddStock(_db.AddItem("SMALL-GAP", threshold: 10), shelf, 8);
        _db.AddStock(_db.AddItem("BIG-GAP", threshold: 100), shelf, 5);
        _db.AddStock(_db.AddItem("HEALTHY", threshold: 10), shelf, 20);

        var alerts = await _service.GetLowStockAlertsAsync(default);

        Assert.Equal(new[] { "BIG-GAP", "SMALL-GAP" }, alerts.Select(a => a.Sku));
        Assert.Equal(95, alerts[0].Shortfall);
    }
}
