using System.ComponentModel.DataAnnotations;

namespace WarehouseInventory.Api.Dtos;

/// <summary>Incoming stock to add to a location.</summary>
public sealed class ReceiveStockRequest
{
    /// <summary>Id of an active item.</summary>
    [Range(1, int.MaxValue, ErrorMessage = "Select an item.")]
    public int ItemId { get; init; }

    /// <summary>Id of the active location receiving the stock.</summary>
    [Range(1, int.MaxValue, ErrorMessage = "Select a location.")]
    public int LocationId { get; init; }

    /// <summary>Units received.</summary>
    [Range(1, 1_000_000)]
    public int Quantity { get; init; }

    /// <summary>Optional supplier reference such as a PO or delivery note number.</summary>
    [StringLength(100)]
    public string? Reference { get; init; }
}

/// <summary>Stock to move from one location to another.</summary>
public sealed class TransferStockRequest
{
    /// <summary>Id of an active item.</summary>
    [Range(1, int.MaxValue, ErrorMessage = "Select an item.")]
    public int ItemId { get; init; }

    /// <summary>Location the stock is taken from; it must hold at least <see cref="Quantity"/> units.</summary>
    [Range(1, int.MaxValue, ErrorMessage = "Select a source location.")]
    public int FromLocationId { get; init; }

    /// <summary>Active location the stock is moved to; must differ from the source.</summary>
    [Range(1, int.MaxValue, ErrorMessage = "Select a destination location.")]
    public int ToLocationId { get; init; }

    /// <summary>Units to move.</summary>
    [Range(1, 1_000_000)]
    public int Quantity { get; init; }

    /// <summary>Optional free-text reference for the transfer.</summary>
    [StringLength(100)]
    public string? Reference { get; init; }
}

/// <summary>An entry in the stock movement audit trail.</summary>
/// <param name="Id">Movement id.</param>
/// <param name="Type">Movement type name (Receipt, Transfer, Pick).</param>
/// <param name="ItemId">Item id.</param>
/// <param name="Sku">Item SKU.</param>
/// <param name="ItemName">Item name.</param>
/// <param name="FromLocationCode">Source location code; null for receipts.</param>
/// <param name="ToLocationCode">Destination location code; null for picks.</param>
/// <param name="Quantity">Units moved.</param>
/// <param name="Reference">Optional reference (supplier document or order number).</param>
/// <param name="PerformedBy">Username that performed the movement.</param>
/// <param name="CreatedAtUtc">When the movement happened, in UTC.</param>
public sealed record StockMovementDto(
    int Id,
    string Type,
    int ItemId,
    string Sku,
    string ItemName,
    string? FromLocationCode,
    string? ToLocationCode,
    int Quantity,
    string? Reference,
    string PerformedBy,
    DateTime CreatedAtUtc);

/// <summary>On-hand quantity of an item at one location.</summary>
/// <param name="LocationId">Location id.</param>
/// <param name="LocationCode">Location code.</param>
/// <param name="LocationName">Location name.</param>
/// <param name="Quantity">Units on hand at the location.</param>
public sealed record LocationStockDto(int LocationId, string LocationCode, string LocationName, int Quantity);

/// <summary>An item's on-hand stock across all locations.</summary>
/// <param name="ItemId">Item id.</param>
/// <param name="Sku">Item SKU.</param>
/// <param name="Name">Item name.</param>
/// <param name="UnitOfMeasure">Unit the item is counted in.</param>
/// <param name="TotalQuantity">Total units on hand across all locations.</param>
/// <param name="LowStockThreshold">Low-stock threshold; zero means alerts are disabled.</param>
/// <param name="IsLowStock">True when the threshold is above zero and the total is at or below it.</param>
/// <param name="Locations">Locations holding a positive quantity, ordered by code.</param>
public sealed record InventoryItemDto(
    int ItemId,
    string Sku,
    string Name,
    string UnitOfMeasure,
    int TotalQuantity,
    int LowStockThreshold,
    bool IsLowStock,
    IReadOnlyList<LocationStockDto> Locations);

/// <summary>A low-stock alert for an active item.</summary>
/// <param name="ItemId">Item id.</param>
/// <param name="Sku">Item SKU.</param>
/// <param name="Name">Item name.</param>
/// <param name="TotalQuantity">Total units on hand across all locations.</param>
/// <param name="LowStockThreshold">The item's low-stock threshold.</param>
/// <param name="Shortfall">Threshold minus total quantity.</param>
public sealed record StockAlertDto(
    int ItemId,
    string Sku,
    string Name,
    int TotalQuantity,
    int LowStockThreshold,
    int Shortfall);
