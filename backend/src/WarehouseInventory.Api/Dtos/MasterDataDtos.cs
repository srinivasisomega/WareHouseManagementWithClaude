using System.ComponentModel.DataAnnotations;

namespace WarehouseInventory.Api.Dtos;

/// <summary>Item details for create and full update.</summary>
public sealed class ItemRequest
{
    /// <summary>Unique stock-keeping unit code; stored trimmed and upper-cased.</summary>
    [Required, StringLength(50)]
    [RegularExpression("^[A-Za-z0-9._-]+$", ErrorMessage = "SKU may contain only letters, digits, '.', '_' and '-'.")]
    public string Sku { get; init; } = string.Empty;

    /// <summary>Display name.</summary>
    [Required, StringLength(200)]
    public string Name { get; init; } = string.Empty;

    /// <summary>Optional free-text description; blank is stored as null.</summary>
    [StringLength(1000)]
    public string? Description { get; init; }

    /// <summary>Unit the item is counted in (e.g. EA, BOX); stored upper-cased.</summary>
    [Required, StringLength(20)]
    public string UnitOfMeasure { get; init; } = "EA";

    /// <summary>Total on-hand quantity at or below which the item is flagged as low stock. Zero disables alerts.</summary>
    [Range(0, 1_000_000)]
    public int LowStockThreshold { get; init; }

    /// <summary>Whether the item can be used in new receipts, transfers and orders.</summary>
    public bool IsActive { get; init; } = true;
}

/// <summary>New low-stock threshold for an item.</summary>
public sealed class ThresholdRequest
{
    /// <summary>Total on-hand quantity at or below which the item is flagged as low stock. Zero disables alerts.</summary>
    [Range(0, 1_000_000)]
    public int LowStockThreshold { get; init; }
}

/// <summary>An item as returned by the API.</summary>
/// <param name="Id">Item id.</param>
/// <param name="Sku">Normalized SKU code.</param>
/// <param name="Name">Display name.</param>
/// <param name="Description">Optional description.</param>
/// <param name="UnitOfMeasure">Unit the item is counted in.</param>
/// <param name="LowStockThreshold">Low-stock threshold; zero means alerts are disabled.</param>
/// <param name="IsActive">Whether the item is active.</param>
public sealed record ItemDto(
    int Id,
    string Sku,
    string Name,
    string? Description,
    string UnitOfMeasure,
    int LowStockThreshold,
    bool IsActive);

/// <summary>Location details for create and full update.</summary>
public sealed class LocationRequest
{
    /// <summary>Unique location code; stored trimmed and upper-cased.</summary>
    [Required, StringLength(50)]
    [RegularExpression("^[A-Za-z0-9._-]+$", ErrorMessage = "Code may contain only letters, digits, '.', '_' and '-'.")]
    public string Code { get; init; } = string.Empty;

    /// <summary>Display name.</summary>
    [Required, StringLength(200)]
    public string Name { get; init; } = string.Empty;

    /// <summary>Optional free-text description; blank is stored as null.</summary>
    [StringLength(1000)]
    public string? Description { get; init; }

    /// <summary>Whether the location is in use. A location holding stock cannot be deactivated.</summary>
    public bool IsActive { get; init; } = true;
}

/// <summary>A storage location as returned by the API.</summary>
/// <param name="Id">Location id.</param>
/// <param name="Code">Normalized location code.</param>
/// <param name="Name">Display name.</param>
/// <param name="Description">Optional description.</param>
/// <param name="IsActive">Whether the location is active.</param>
public sealed record LocationDto(int Id, string Code, string Name, string? Description, bool IsActive);
