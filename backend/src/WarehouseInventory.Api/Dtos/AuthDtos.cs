using System.ComponentModel.DataAnnotations;

namespace WarehouseInventory.Api.Dtos;

/// <summary>Credentials submitted to the login endpoint.</summary>
public sealed class LoginRequest
{
    /// <summary>Account username; surrounding whitespace is ignored.</summary>
    [Required, StringLength(100)]
    public string Username { get; init; } = string.Empty;

    /// <summary>Plain-text password, verified against the stored hash and never logged.</summary>
    [Required, StringLength(200)]
    public string Password { get; init; } = string.Empty;
}

/// <summary>Result of a successful credential check. The controller puts the token in an HttpOnly cookie; it is never returned in a response body.</summary>
/// <param name="Token">Signed JWT.</param>
/// <param name="Username">The authenticated user's name.</param>
/// <param name="Role">The user's role (Admin or Staff).</param>
/// <param name="ExpiresAtUtc">When the token expires, in UTC.</param>
public sealed record LoginResponse(string Token, string Username, string Role, DateTime ExpiresAtUtc);

/// <summary>The signed-in user's session, as returned to the browser (no token).</summary>
/// <param name="Username">The authenticated user's name.</param>
/// <param name="Role">The user's role (Admin or Staff).</param>
/// <param name="ExpiresAtUtc">When the session expires, in UTC.</param>
public sealed record SessionResponse(string Username, string Role, DateTime ExpiresAtUtc);
