using Microsoft.EntityFrameworkCore;
using WarehouseInventory.Api.Domain;

namespace WarehouseInventory.Api.Data;

/// <summary>EF Core context for the warehouse inventory database.</summary>
public class WarehouseDbContext : DbContext
{
    /// <summary>Creates the context with the configured provider options.</summary>
    /// <param name="options">Context options.</param>
    public WarehouseDbContext(DbContextOptions<WarehouseDbContext> options) : base(options)
    {
    }

    public DbSet<Item> Items => Set<Item>();
    public DbSet<Location> Locations => Set<Location>();
    public DbSet<StockLevel> StockLevels => Set<StockLevel>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<FulfillmentOrder> Orders => Set<FulfillmentOrder>();
    public DbSet<OrderLine> OrderLines => Set<OrderLine>();
    public DbSet<AppUser> Users => Set<AppUser>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Item>(e =>
        {
            e.Property(x => x.Sku).HasMaxLength(50).IsRequired();
            e.HasIndex(x => x.Sku).IsUnique();
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Description).HasMaxLength(1000);
            e.Property(x => x.UnitOfMeasure).HasMaxLength(20).IsRequired();
            e.ToTable(t => t.HasCheckConstraint("CK_Items_LowStockThreshold", "[LowStockThreshold] >= 0"));
        });

        modelBuilder.Entity<Location>(e =>
        {
            e.Property(x => x.Code).HasMaxLength(50).IsRequired();
            e.HasIndex(x => x.Code).IsUnique();
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Description).HasMaxLength(1000);
        });

        modelBuilder.Entity<StockLevel>(e =>
        {
            e.HasIndex(x => new { x.ItemId, x.LocationId }).IsUnique();
            e.Property(x => x.RowVersion).IsRowVersion();
            e.HasOne(x => x.Item).WithMany(i => i.StockLevels).HasForeignKey(x => x.ItemId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Location).WithMany(l => l.StockLevels).HasForeignKey(x => x.LocationId).OnDelete(DeleteBehavior.Restrict);
            e.ToTable(t => t.HasCheckConstraint("CK_StockLevels_Quantity", "[Quantity] >= 0"));
        });

        modelBuilder.Entity<StockMovement>(e =>
        {
            e.Property(x => x.Type).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Reference).HasMaxLength(100);
            e.Property(x => x.PerformedBy).HasMaxLength(100).IsRequired();
            e.HasIndex(x => x.CreatedAtUtc);
            e.HasOne(x => x.Item).WithMany().HasForeignKey(x => x.ItemId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.FromLocation).WithMany().HasForeignKey(x => x.FromLocationId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.ToLocation).WithMany().HasForeignKey(x => x.ToLocationId).OnDelete(DeleteBehavior.Restrict);
            e.ToTable(t => t.HasCheckConstraint("CK_StockMovements_Quantity", "[Quantity] > 0"));
        });

        modelBuilder.Entity<FulfillmentOrder>(e =>
        {
            e.ToTable("Orders");
            e.Property(x => x.OrderNumber).HasMaxLength(30).IsRequired();
            e.HasIndex(x => x.OrderNumber).IsUnique();
            e.Property(x => x.CustomerName).HasMaxLength(200).IsRequired();
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.HasIndex(x => x.Status);
            e.Property(x => x.Carrier).HasMaxLength(100);
            e.Property(x => x.TrackingNumber).HasMaxLength(100);
            e.Property(x => x.CreatedBy).HasMaxLength(100).IsRequired();
        });

        modelBuilder.Entity<OrderLine>(e =>
        {
            e.HasOne(x => x.Order).WithMany(o => o.Lines).HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Item).WithMany().HasForeignKey(x => x.ItemId).OnDelete(DeleteBehavior.Restrict);
            e.ToTable(t =>
            {
                t.HasCheckConstraint("CK_OrderLines_QuantityOrdered", "[QuantityOrdered] > 0");
                t.HasCheckConstraint("CK_OrderLines_QuantityPicked", "[QuantityPicked] >= 0 AND [QuantityPicked] <= [QuantityOrdered]");
            });
        });

        modelBuilder.Entity<AppUser>(e =>
        {
            e.Property(x => x.Username).HasMaxLength(100).IsRequired();
            e.HasIndex(x => x.Username).IsUnique();
            e.Property(x => x.PasswordHash).HasMaxLength(500).IsRequired();
            e.Property(x => x.Role).HasMaxLength(20).IsRequired();
        });
    }
}
