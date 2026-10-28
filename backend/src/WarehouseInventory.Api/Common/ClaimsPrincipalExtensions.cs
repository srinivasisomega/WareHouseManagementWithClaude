using System.Security.Claims;

namespace WarehouseInventory.Api.Common;

/// <summary>Helpers for reading the authenticated caller from the JWT claims.</summary>
public static class ClaimsPrincipalExtensions
{
    /// <summary>Username of the authenticated caller, recorded on audit fields.</summary>
    public static string GetUsername(this ClaimsPrincipal user) =>
        user.Identity?.Name ?? throw new InvalidOperationException("Authenticated user has no name claim.");
}
