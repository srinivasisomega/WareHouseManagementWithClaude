using System.ComponentModel.DataAnnotations;

namespace WarehouseInventory.Api.Dtos;

/// <summary>A new outbound order.</summary>
public sealed class CreateOrderRequest
{
    /// <summary>Customer the order ships to.</summary>
    [Required, StringLength(200)]
    public string CustomerName { get; init; } = string.Empty;

    /// <summary>Order lines; at least one, and each item may appear only once.</summary>
    [Required, MinLength(1, ErrorMessage = "An order needs at least one line.")]
    public List<CreateOrderLineRequest> Lines { get; init; } = new();
}

/// <summary>One line of a new order.</summary>
public sealed class CreateOrderLineRequest
{
    /// <summary>Id of an active item.</summary>
    [Range(1, int.MaxValue, ErrorMessage = "Select an item.")]
    public int ItemId { get; init; }

    /// <summary>Units ordered.</summary>
    [Range(1, 1_000_000)]
    public int Quantity { get; init; }
}

/// <summary>Picks units for one order line from a location.</summary>
public sealed class PickRequest
{
    /// <summary>The order line being picked.</summary>
    [Range(1, int.MaxValue, ErrorMessage = "Select an order line.")]
    public int OrderLineId { get; init; }

    /// <summary>The location the stock is taken from.</summary>
    [Range(1, int.MaxValue, ErrorMessage = "Select a location to pick from.")]
    public int LocationId { get; init; }

    /// <summary>Units to pick; may not exceed the line's remaining quantity or the stock at the location.</summary>
    [Range(1, 1_000_000)]
    public int Quantity { get; init; }
}

/// <summary>Packing details for a fully picked order.</summary>
public sealed class PackRequest
{
    /// <summary>Number of packages the order was packed into.</summary>
    [Range(1, 1000)]
    public int PackageCount { get; init; }
}

/// <summary>Shipping details for a packed order.</summary>
public sealed class DispatchRequest
{
    /// <summary>Carrier collecting the shipment.</summary>
    [Required, StringLength(100)]
    public string Carrier { get; init; } = string.Empty;

    /// <summary>Optional carrier tracking number; blank is stored as null.</summary>
    [StringLength(100)]
    public string? TrackingNumber { get; init; }
}

/// <summary>An order as shown in the order list.</summary>
/// <param name="Id">Order id.</param>
/// <param name="OrderNumber">Human-readable order number (ORD-yyyyMMdd-XXXXXX).</param>
/// <param name="CustomerName">Customer the order ships to.</param>
/// <param name="Status">Current workflow status name.</param>
/// <param name="LineCount">Number of order lines.</param>
/// <param name="TotalUnits">Sum of ordered quantities across all lines.</param>
/// <param name="CreatedAtUtc">When the order was created, in UTC.</param>
public sealed record OrderSummaryDto(
    int Id,
    string OrderNumber,
    string CustomerName,
    string Status,
    int LineCount,
    int TotalUnits,
    DateTime CreatedAtUtc);

/// <summary>One line of an order with its pick progress.</summary>
/// <param name="Id">Order line id.</param>
/// <param name="ItemId">Ordered item id.</param>
/// <param name="Sku">Ordered item SKU.</param>
/// <param name="ItemName">Ordered item name.</param>
/// <param name="QuantityOrdered">Units ordered.</param>
/// <param name="QuantityPicked">Units picked so far.</param>
/// <param name="AvailableLocations">Active locations currently holding the item, to pick from.</param>
public sealed record OrderLineDto(
    int Id,
    int ItemId,
    string Sku,
    string ItemName,
    int QuantityOrdered,
    int QuantityPicked,
    IReadOnlyList<LocationStockDto> AvailableLocations);

/// <summary>Full order detail including lines and fulfillment data.</summary>
/// <param name="Id">Order id.</param>
/// <param name="OrderNumber">Human-readable order number.</param>
/// <param name="CustomerName">Customer the order ships to.</param>
/// <param name="Status">Current workflow status name.</param>
/// <param name="PackageCount">Packages, set when packed.</param>
/// <param name="Carrier">Carrier, set when dispatched.</param>
/// <param name="TrackingNumber">Optional tracking number, set when dispatched.</param>
/// <param name="CreatedBy">Username that created the order.</param>
/// <param name="CreatedAtUtc">When the order was created, in UTC.</param>
/// <param name="PackedAtUtc">When the order was packed, in UTC.</param>
/// <param name="DispatchedAtUtc">When the order was dispatched, in UTC.</param>
/// <param name="Lines">Order lines ordered by id.</param>
public sealed record OrderDetailDto(
    int Id,
    string OrderNumber,
    string CustomerName,
    string Status,
    int? PackageCount,
    string? Carrier,
    string? TrackingNumber,
    string CreatedBy,
    DateTime CreatedAtUtc,
    DateTime? PackedAtUtc,
    DateTime? DispatchedAtUtc,
    IReadOnlyList<OrderLineDto> Lines);
