using Microsoft.EntityFrameworkCore;
using WarehouseInventory.Api.Data;
using WarehouseInventory.Api.Domain;

namespace WarehouseInventory.Tests.Unit;

internal sealed class FixedTimeProvider : TimeProvider
{
    public DateTimeOffset Now { get; set; } = new(2026, 10, 27, 9, 0, 0, TimeSpan.Zero);

    public override DateTimeOffset GetUtcNow() => Now;
}

/// <summary>Builds an isolated in-memory database per test with small helpers for common fixtures.</summary>
internal static class TestData
{
    public static WarehouseDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<WarehouseDbContext>()
            .UseInMemoryDatabase($"warehouse-{Guid.NewGuid()}")
            .Options);

    public static Item AddItem(this WarehouseDbContext db, string sku, int threshold = 0, bool active = true, string? name = null)
    {
        var item = new Item { Sku = sku, Name = name ?? $"Item {sku}", UnitOfMeasure = "EA", LowStockThreshold = threshold, IsActive = active };
        db.Items.Add(item);
        db.SaveChanges();
        return item;
    }

    public static Location AddLocation(this WarehouseDbContext db, string code, bool active = true)
    {
        var location = new Location { Code = code, Name = $"Location {code}", IsActive = active };
        db.Locations.Add(location);
        db.SaveChanges();
        return location;
    }

    public static void AddStock(this WarehouseDbContext db, Item item, Location location, int quantity)
    {
        db.StockLevels.Add(new StockLevel { ItemId = item.Id, LocationId = location.Id, Quantity = quantity });
        db.SaveChanges();
    }

    public static int QuantityAt(this WarehouseDbContext db, Item item, Location location) =>
        db.StockLevels.AsNoTracking().Where(s => s.ItemId == item.Id && s.LocationId == location.Id).Select(s => s.Quantity).FirstOrDefault();
}
