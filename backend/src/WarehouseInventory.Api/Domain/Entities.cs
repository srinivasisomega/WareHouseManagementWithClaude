namespace WarehouseInventory.Api.Domain;

/// <summary>A stock-keeping unit (SKU) that the warehouse holds.</summary>
public class Item
{
    public int Id { get; set; }
    public string Sku { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string UnitOfMeasure { get; set; } = "EA";

    /// <summary>Total on-hand quantity at or below which the item is flagged as low stock. Zero disables alerts.</summary>
    public int LowStockThreshold { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public List<StockLevel> StockLevels { get; set; } = new();
}

/// <summary>A physical storage location (bin, shelf, dock) in the warehouse.</summary>
public class Location
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public List<StockLevel> StockLevels { get; set; } = new();
}

/// <summary>On-hand quantity of one item at one location.</summary>
public class StockLevel
{
    public int Id { get; set; }
    public int ItemId { get; set; }
    public Item Item { get; set; } = null!;
    public int LocationId { get; set; }
    public Location Location { get; set; } = null!;
    public int Quantity { get; set; }

    /// <summary>Optimistic concurrency token so simultaneous stock changes cannot overwrite each other.</summary>
    public byte[]? RowVersion { get; set; }
}

/// <summary>Kind of stock change recorded in the movement audit trail.</summary>
public enum MovementType
{
    Receipt = 1,
    Transfer = 2,
    Pick = 3,
}

/// <summary>Immutable audit record of a stock change.</summary>
public class StockMovement
{
    public int Id { get; set; }
    public MovementType Type { get; set; }
    public int ItemId { get; set; }
    public Item Item { get; set; } = null!;
    public int? FromLocationId { get; set; }
    public Location? FromLocation { get; set; }
    public int? ToLocationId { get; set; }
    public Location? ToLocation { get; set; }
    public int Quantity { get; set; }
    public string? Reference { get; set; }
    public string PerformedBy { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
}

/// <summary>Fulfillment workflow status: Open → Picking → Picked → Packed → Dispatched.</summary>
public enum OrderStatus
{
    Open = 1,
    Picking = 2,
    Picked = 3,
    Packed = 4,
    Dispatched = 5,
}

/// <summary>An outbound order that moves through pick, pack and dispatch.</summary>
public class FulfillmentOrder
{
    public int Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public OrderStatus Status { get; set; } = OrderStatus.Open;
    public int? PackageCount { get; set; }
    public string? Carrier { get; set; }
    public string? TrackingNumber { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? PackedAtUtc { get; set; }
    public DateTime? DispatchedAtUtc { get; set; }

    public List<OrderLine> Lines { get; set; } = new();
}

/// <summary>One item and quantity on an order, with how much has been picked so far.</summary>
public class OrderLine
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public FulfillmentOrder Order { get; set; } = null!;
    public int ItemId { get; set; }
    public Item Item { get; set; } = null!;
    public int QuantityOrdered { get; set; }
    public int QuantityPicked { get; set; }
}

/// <summary>Role names stored on users and issued in the JWT role claim.</summary>
public static class UserRoles
{
    public const string Admin = "Admin";
    public const string Staff = "Staff";
}

/// <summary>A user account; the password is stored only as an ASP.NET Core Identity hash.</summary>
public class AppUser
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = UserRoles.Staff;
    public bool IsActive { get; set; } = true;
}
