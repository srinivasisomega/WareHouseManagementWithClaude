using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WarehouseInventory.Api.Configuration;
using WarehouseInventory.Api.Domain;

namespace WarehouseInventory.Api.Data;

/// <summary>Applies pending migrations (when enabled) and creates the initial admin/staff accounts.</summary>
public static class DatabaseInitializer
{
    /// <summary>Runs startup database initialization in its own DI scope.</summary>
    /// <param name="services">The application service provider.</param>
    /// <param name="ct">Cancellation token.</param>
    public static async Task InitializeAsync(IServiceProvider services, CancellationToken ct = default)
    {
        using var scope = services.CreateScope();
        var sp = scope.ServiceProvider;
        var db = sp.GetRequiredService<WarehouseDbContext>();
        var logger = sp.GetRequiredService<ILoggerFactory>().CreateLogger(typeof(DatabaseInitializer));

        if (sp.GetRequiredService<IOptions<DatabaseOptions>>().Value.ApplyMigrationsOnStartup)
        {
            await db.Database.MigrateAsync(ct);
        }

        await SeedUsersAsync(db, sp.GetRequiredService<IOptions<SeedUsersOptions>>().Value,
            sp.GetRequiredService<IPasswordHasher<AppUser>>(), logger, ct);
    }

    /// <summary>Creates the admin and staff accounts when no users exist and both passwords are configured.</summary>
    private static async Task SeedUsersAsync(WarehouseDbContext db, SeedUsersOptions options, IPasswordHasher<AppUser> hasher,
        ILogger logger, CancellationToken ct)
    {
        if (await db.Users.AnyAsync(ct))
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(options.AdminPassword) || string.IsNullOrWhiteSpace(options.StaffPassword))
        {
            logger.LogWarning("No users exist and SeedUsers passwords are not configured; skipping user seeding.");
            return;
        }

        AddUser(options.AdminUsername, options.AdminPassword, UserRoles.Admin);
        AddUser(options.StaffUsername, options.StaffPassword, UserRoles.Staff);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seeded initial users {Admin} and {Staff}.", options.AdminUsername, options.StaffUsername);

        void AddUser(string username, string password, string role)
        {
            var user = new AppUser { Username = username, Role = role, IsActive = true };
            user.PasswordHash = hasher.HashPassword(user, password);
            db.Users.Add(user);
        }
    }
}
