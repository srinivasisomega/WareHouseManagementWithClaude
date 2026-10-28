using Microsoft.EntityFrameworkCore;
using WarehouseInventory.Api.Common;
using WarehouseInventory.Api.Domain;

namespace WarehouseInventory.Api.Data;

/// <summary>Shared stock-level lookups used by every operation that changes on-hand quantities.</summary>
internal static class StockLevelExtensions
{
    /// <summary>Loads the tracked stock level for an item at a location, adding a zero-quantity row if none exists.</summary>
    public static async Task<StockLevel> GetOrAddStockLevelAsync(this WarehouseDbContext db, int itemId, int locationId, CancellationToken ct)
    {
        var level = await db.StockLevels.FirstOrDefaultAsync(s => s.ItemId == itemId && s.LocationId == locationId, ct);
        if (level is null)
        {
            level = new StockLevel { ItemId = itemId, LocationId = locationId, Quantity = 0 };
            db.StockLevels.Add(level);
        }

        return level;
    }

    /// <summary>Loads the stock level and verifies it can supply <paramref name="quantity"/> units.</summary>
    public static async Task<StockLevel> GetStockForRemovalAsync(this WarehouseDbContext db, int itemId, int locationId, int quantity, CancellationToken ct)
    {
        var level = await db.StockLevels.FirstOrDefaultAsync(s => s.ItemId == itemId && s.LocationId == locationId, ct);

        var available = level?.Quantity ?? 0;
        if (level is null || available < quantity)
        {
            throw new BusinessRuleException($"Insufficient stock at the selected location: {available} available, {quantity} requested.");
        }

        return level;
    }

    /// <summary>Adds an audit record for a stock change; it is persisted with the caller's SaveChanges.</summary>
    public static StockMovement RecordMovement(this WarehouseDbContext db, MovementType type, int itemId, int? fromLocationId,
        int? toLocationId, int quantity, string? reference, string performedBy, DateTime nowUtc)
    {
        var movement = new StockMovement
        {
            Type = type,
            ItemId = itemId,
            FromLocationId = fromLocationId,
            ToLocationId = toLocationId,
            Quantity = quantity,
            Reference = string.IsNullOrWhiteSpace(reference) ? null : reference.Trim(),
            PerformedBy = performedBy,
            CreatedAtUtc = nowUtc,
        };
        db.StockMovements.Add(movement);
        return movement;
    }
}
