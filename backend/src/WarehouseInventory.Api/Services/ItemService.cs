using Microsoft.EntityFrameworkCore;
using WarehouseInventory.Api.Common;
using WarehouseInventory.Api.Data;
using WarehouseInventory.Api.Domain;
using WarehouseInventory.Api.Dtos;

namespace WarehouseInventory.Api.Services;

/// <summary>Maintains item (SKU) master data.</summary>
public interface IItemService
{
    /// <summary>Lists items ordered by SKU.</summary>
    /// <param name="search">Optional text matched against SKU or name.</param>
    /// <param name="includeInactive">When true, inactive items are included.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The matching items.</returns>
    Task<IReadOnlyList<ItemDto>> GetItemsAsync(string? search, bool includeInactive, CancellationToken ct);

    /// <summary>Returns a single item.</summary>
    /// <param name="id">Item id.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The item.</returns>
    /// <exception cref="NotFoundException">No item has this id.</exception>
    Task<ItemDto> GetItemAsync(int id, CancellationToken ct);

    /// <summary>Creates an item. The SKU is trimmed and upper-cased before the uniqueness check.</summary>
    /// <param name="request">The item details.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The created item.</returns>
    /// <exception cref="ConflictException">Another item already uses the SKU.</exception>
    Task<ItemDto> CreateItemAsync(ItemRequest request, CancellationToken ct);

    /// <summary>Replaces all editable fields of an item.</summary>
    /// <param name="id">Item id.</param>
    /// <param name="request">The new item details.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The updated item.</returns>
    /// <exception cref="NotFoundException">No item has this id.</exception>
    /// <exception cref="ConflictException">The new SKU is already used by another item.</exception>
    Task<ItemDto> UpdateItemAsync(int id, ItemRequest request, CancellationToken ct);

    /// <summary>Changes only the item's low-stock threshold.</summary>
    /// <param name="id">Item id.</param>
    /// <param name="request">The new threshold.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The updated item.</returns>
    /// <exception cref="NotFoundException">No item has this id.</exception>
    Task<ItemDto> UpdateThresholdAsync(int id, ThresholdRequest request, CancellationToken ct);
}

/// <summary>EF Core implementation of <see cref="IItemService"/>.</summary>
public sealed class ItemService : IItemService
{
    private readonly WarehouseDbContext _db;
    private readonly TimeProvider _clock;

    /// <summary>Creates the service.</summary>
    /// <param name="db">Database context.</param>
    /// <param name="clock">Time source for audit timestamps.</param>
    public ItemService(WarehouseDbContext db, TimeProvider clock)
    {
        _db = db;
        _clock = clock;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<ItemDto>> GetItemsAsync(string? search, bool includeInactive, CancellationToken ct)
    {
        var query = _db.Items.AsNoTracking();
        if (!includeInactive)
        {
            query = query.Where(i => i.IsActive);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(i => i.Sku.Contains(term) || i.Name.Contains(term));
        }

        return await query.OrderBy(i => i.Sku).Select(i => ToDto(i)).ToListAsync(ct);
    }

    /// <inheritdoc />
    public async Task<ItemDto> GetItemAsync(int id, CancellationToken ct)
    {
        var item = await _db.Items.AsNoTracking().FirstOrDefaultAsync(i => i.Id == id, ct)
            ?? throw new NotFoundException($"Item {id} was not found.");
        return ToDto(item);
    }

    /// <inheritdoc />
    public async Task<ItemDto> CreateItemAsync(ItemRequest request, CancellationToken ct)
    {
        //this method is called to normalize the SKU and reject duplicates before inserting
        var sku = NormalizeCode(request.Sku);
        await EnsureSkuIsUniqueAsync(sku, excludeId: null, ct);

        var now = _clock.GetUtcNow().UtcDateTime;
        var item = new Item { CreatedAtUtc = now };
        //this method is called to copy the request fields and set the modified date
        Apply(item, request, sku, now);

        _db.Items.Add(item);
        await _db.SaveChangesAsync(ct);
        return ToDto(item);
    }

    /// <inheritdoc />
    public async Task<ItemDto> UpdateItemAsync(int id, ItemRequest request, CancellationToken ct)
    {
        //this method is called to load the tracked item or throw NotFoundException
        var item = await FindAsync(id, ct);
        var sku = NormalizeCode(request.Sku);
        if (sku != item.Sku)
        {
            //uniqueness is only checked when the SKU actually changes
            await EnsureSkuIsUniqueAsync(sku, id, ct);
        }

        //this method is called to copy the request fields and update the modified date of the record
        Apply(item, request, sku, _clock.GetUtcNow().UtcDateTime);
        await _db.SaveChangesAsync(ct);
        return ToDto(item);
    }

    /// <inheritdoc />
    public async Task<ItemDto> UpdateThresholdAsync(int id, ThresholdRequest request, CancellationToken ct)
    {
        var item = await FindAsync(id, ct);
        item.LowStockThreshold = request.LowStockThreshold;
        item.UpdatedAtUtc = _clock.GetUtcNow().UtcDateTime;
        await _db.SaveChangesAsync(ct);
        return ToDto(item);
    }

    /// <summary>Normalizes an item SKU or location code: trimmed and upper-cased.</summary>
    /// <param name="value">The raw code.</param>
    /// <returns>The normalized code.</returns>
    internal static string NormalizeCode(string value) => value.Trim().ToUpperInvariant();

    /// <summary>Loads a tracked item for update.</summary>
    /// <exception cref="NotFoundException">No item has this id.</exception>
    private async Task<Item> FindAsync(int id, CancellationToken ct) =>
        await _db.Items.FirstOrDefaultAsync(i => i.Id == id, ct)
        ?? throw new NotFoundException($"Item {id} was not found.");

    /// <summary>Ensures no other item uses the SKU.</summary>
    /// <param name="sku">Normalized SKU.</param>
    /// <param name="excludeId">Item to ignore (the one being updated), or null on create.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <exception cref="ConflictException">Another item already uses the SKU.</exception>
    private async Task EnsureSkuIsUniqueAsync(string sku, int? excludeId, CancellationToken ct)
    {
        if (await _db.Items.AnyAsync(i => i.Sku == sku && i.Id != excludeId, ct))
        {
            throw new ConflictException($"An item with SKU '{sku}' already exists.");
        }
    }

    /// <summary>Copies request fields onto the entity, normalizing text, and stamps the modified date.</summary>
    /// <param name="item">The entity to update.</param>
    /// <param name="request">The submitted details.</param>
    /// <param name="sku">The already-normalized SKU.</param>
    /// <param name="now">Current UTC time, written to <see cref="Item.UpdatedAtUtc"/>.</param>
    private static void Apply(Item item, ItemRequest request, string sku, DateTime now)
    {
        item.Sku = sku;
        item.Name = request.Name.Trim();
        item.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        item.UnitOfMeasure = request.UnitOfMeasure.Trim().ToUpperInvariant();
        item.LowStockThreshold = request.LowStockThreshold;
        item.IsActive = request.IsActive;
        item.UpdatedAtUtc = now;
    }

    private static ItemDto ToDto(Item i) =>
        new(i.Id, i.Sku, i.Name, i.Description, i.UnitOfMeasure, i.LowStockThreshold, i.IsActive);
}
