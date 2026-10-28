using Microsoft.EntityFrameworkCore;
using WarehouseInventory.Api.Data;
using WarehouseInventory.Api.Dtos;

namespace WarehouseInventory.Api.Services;

/// <summary>Read-side queries over on-hand stock and low-stock alerts.</summary>
public interface IInventoryService
{
    /// <summary>Searches active items with their total and per-location on-hand quantities, ordered by SKU.</summary>
    /// <param name="search">Optional text matched against SKU or name.</param>
    /// <param name="locationId">Optional location; only items with a positive quantity there are returned.</param>
    /// <param name="lowStockOnly">When true, only items at or below their low-stock threshold are returned.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Up to <see cref="InventoryService.MaxResults"/> matching items.</returns>
    Task<IReadOnlyList<InventoryItemDto>> SearchAsync(string? search, int? locationId, bool lowStockOnly, CancellationToken ct);

    /// <summary>Lists active items whose total stock is at or below a non-zero threshold.</summary>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>Alerts ordered by largest shortfall, then SKU.</returns>
    Task<IReadOnlyList<StockAlertDto>> GetLowStockAlertsAsync(CancellationToken ct);
}

/// <summary>
/// Read-side queries over on-hand stock. An item is low on stock when its threshold is above zero
/// and its total on-hand quantity across all locations is at or below that threshold.
/// </summary>
public sealed class InventoryService : IInventoryService
{
    /// <summary>Maximum number of rows returned by <see cref="SearchAsync"/>.</summary>
    public const int MaxResults = 500;

    private readonly WarehouseDbContext _db;

    /// <summary>Creates the service.</summary>
    /// <param name="db">Database context.</param>
    public InventoryService(WarehouseDbContext db)
    {
        _db = db;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<InventoryItemDto>> SearchAsync(string? search, int? locationId, bool lowStockOnly, CancellationToken ct)
    {
        var query = _db.Items.AsNoTracking().Where(i => i.IsActive);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(i => i.Sku.Contains(term) || i.Name.Contains(term));
        }

        if (locationId is not null)
        {
            query = query.Where(i => i.StockLevels.Any(s => s.LocationId == locationId && s.Quantity > 0));
        }

        if (lowStockOnly)
        {
            query = query.Where(i => i.LowStockThreshold > 0 && i.StockLevels.Sum(s => s.Quantity) <= i.LowStockThreshold);
        }

        var rows = await query
            .OrderBy(i => i.Sku)
            .Take(MaxResults)
            .Select(i => new
            {
                i.Id,
                i.Sku,
                i.Name,
                i.UnitOfMeasure,
                i.LowStockThreshold,
                Total = i.StockLevels.Sum(s => s.Quantity),
                Locations = i.StockLevels
                    .Where(s => s.Quantity > 0)
                    .OrderBy(s => s.Location.Code)
                    .Select(s => new LocationStockDto(s.LocationId, s.Location.Code, s.Location.Name, s.Quantity))
                    .ToList(),
            })
            .ToListAsync(ct);

        return rows
            .Select(r => new InventoryItemDto(
                r.Id, r.Sku, r.Name, r.UnitOfMeasure, r.Total, r.LowStockThreshold,
                IsLowStock(r.Total, r.LowStockThreshold), r.Locations))
            .ToList();
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<StockAlertDto>> GetLowStockAlertsAsync(CancellationToken ct)
    {
        var rows = await _db.Items.AsNoTracking()
            .Where(i => i.IsActive && i.LowStockThreshold > 0)
            .Select(i => new { i.Id, i.Sku, i.Name, i.LowStockThreshold, Total = i.StockLevels.Sum(s => s.Quantity) })
            .Where(r => r.Total <= r.LowStockThreshold)
            .ToListAsync(ct);

        return rows
            .Select(r => new StockAlertDto(r.Id, r.Sku, r.Name, r.Total, r.LowStockThreshold, r.LowStockThreshold - r.Total))
            .OrderByDescending(a => a.Shortfall)
            .ThenBy(a => a.Sku)
            .ToList();
    }

    /// <summary>True when the threshold is above zero and the total quantity is at or below it.</summary>
    /// <param name="totalQuantity">Total on-hand quantity across all locations.</param>
    /// <param name="threshold">The item's low-stock threshold; zero disables alerts.</param>
    /// <returns>Whether the item is low on stock.</returns>
    public static bool IsLowStock(int totalQuantity, int threshold) => threshold > 0 && totalQuantity <= threshold;
}
