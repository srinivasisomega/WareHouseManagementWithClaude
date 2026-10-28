using WarehouseInventory.Api.Common;
using WarehouseInventory.Api.Dtos;
using WarehouseInventory.Api.Services;

namespace WarehouseInventory.Tests.Unit;

public class LocationServiceTests
{
    private readonly Api.Data.WarehouseDbContext _db = TestData.CreateDb();
    private readonly LocationService _service;

    public LocationServiceTests()
    {
        _service = new LocationService(_db, new FixedTimeProvider());
    }

    [Fact]
    public async Task CreateLocation_NormalizesCode()
    {
        var location = await _service.CreateLocationAsync(new LocationRequest { Code = "a-01-01", Name = "Aisle A" }, default);

        Assert.Equal("A-01-01", location.Code);
    }

    [Fact]
    public async Task CreateLocation_DuplicateCode_ThrowsConflict()
    {
        _db.AddLocation("A-01-01");

        await Assert.ThrowsAsync<ConflictException>(() =>
            _service.CreateLocationAsync(new LocationRequest { Code = "A-01-01", Name = "Dup" }, default));
    }

    [Fact]
    public async Task Deactivate_LocationHoldingStock_IsRejected()
    {
        var location = _db.AddLocation("A-01-01");
        _db.AddStock(_db.AddItem("SKU-1"), location, 3);

        await Assert.ThrowsAsync<BusinessRuleException>(() =>
            _service.UpdateLocationAsync(location.Id, new LocationRequest { Code = "A-01-01", Name = "A", IsActive = false }, default));
    }

    [Fact]
    public async Task Deactivate_EmptyLocation_Succeeds()
    {
        var location = _db.AddLocation("A-01-01");

        var updated = await _service.UpdateLocationAsync(location.Id, new LocationRequest { Code = "A-01-01", Name = "A", IsActive = false }, default);

        Assert.False(updated.IsActive);
        Assert.Empty(await _service.GetLocationsAsync(includeInactive: false, default));
    }
}
