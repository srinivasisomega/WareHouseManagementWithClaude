using System.ComponentModel.DataAnnotations;

namespace WarehouseInventory.Api.Configuration;

/// <summary>JWT issuing and validation settings, bound from the "Jwt" section and validated on startup.</summary>
public sealed class JwtOptions
{
    /// <summary>Configuration section name.</summary>
    public const string SectionName = "Jwt";

    /// <summary>Token issuer (iss) written on issue and required on validation.</summary>
    [Required]
    public string Issuer { get; init; } = string.Empty;

    /// <summary>Token audience (aud) written on issue and required on validation.</summary>
    [Required]
    public string Audience { get; init; } = string.Empty;

    /// <summary>HMAC signing key. Supply via user-secrets or the Jwt__Key environment variable; never commit it.</summary>
    [Required, MinLength(32)]
    public string Key { get; init; } = string.Empty;

    /// <summary>Token lifetime in minutes (5 to 1440).</summary>
    [Range(5, 1440)]
    public int ExpiryMinutes { get; init; } = 480;
}

/// <summary>Initial user accounts created when the user table is empty. Passwords come from secrets, not source.</summary>
public sealed class SeedUsersOptions
{
    /// <summary>Configuration section name.</summary>
    public const string SectionName = "SeedUsers";

    /// <summary>Username of the seeded admin account.</summary>
    public string AdminUsername { get; init; } = "admin";

    /// <summary>Password of the seeded admin account; seeding is skipped if either password is missing.</summary>
    public string? AdminPassword { get; init; }

    /// <summary>Username of the seeded staff account.</summary>
    public string StaffUsername { get; init; } = "staff";

    /// <summary>Password of the seeded staff account; seeding is skipped if either password is missing.</summary>
    public string? StaffPassword { get; init; }
}

/// <summary>Database startup behaviour, bound from the "Database" section.</summary>
public sealed class DatabaseOptions
{
    /// <summary>Configuration section name.</summary>
    public const string SectionName = "Database";

    /// <summary>When true, pending EF Core migrations are applied at application start.</summary>
    public bool ApplyMigrationsOnStartup { get; init; }
}

/// <summary>Names of the authorization policies used by the controllers.</summary>
public static class AuthPolicies
{
    /// <summary>Master-data maintenance: items, locations, thresholds.</summary>
    public const string AdminOnly = "AdminOnly";

    /// <summary>Day-to-day warehouse operations. Admins are included so they can assist on the floor.</summary>
    public const string WarehouseOperations = "WarehouseOperations";
}
