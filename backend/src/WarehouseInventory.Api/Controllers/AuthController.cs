using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using WarehouseInventory.Api.Common;
using WarehouseInventory.Api.Dtos;
using WarehouseInventory.Api.Services;

namespace WarehouseInventory.Api.Controllers;

/// <summary>Signs warehouse users in and out using an HttpOnly session cookie that carries the JWT.</summary>
[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    /// <summary>Name of the per-IP rate-limit policy applied to the login endpoint.</summary>
    public const string LoginRateLimitPolicy = "login";

    private readonly IAuthService _authService;

    /// <summary>Creates the controller.</summary>
    /// <param name="authService">Service that verifies credentials and issues tokens.</param>
    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    /// <summary>POST api/auth/login — verifies credentials and sets the HttpOnly session cookie. Anonymous and rate limited per client IP.</summary>
    /// <param name="request">The user's credentials.</param>
    /// <param name="ct">Request cancellation token.</param>
    /// <returns>The user's name, role and session expiry (the token itself is only in the cookie).</returns>
    /// <response code="200">Credentials are valid; the session cookie is set.</response>
    /// <response code="400">The request failed validation (missing or over-long username/password).</response>
    /// <response code="401">The username or password is wrong, or the account is inactive.</response>
    /// <response code="429">Too many login attempts from this client; retry after the rate-limit window.</response>
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting(LoginRateLimitPolicy)]
    [ProducesResponseType<SessionResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<SessionResponse>> Login(LoginRequest request, CancellationToken ct)
    {
        // Delegates credential verification and token creation to the auth service; null means invalid credentials.
        var result = await _authService.LoginAsync(request, ct);
        if (result is null)
        {
            return Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Login failed", detail: "Invalid username or password.");
        }

        AuthCookie.Append(Response, result.Token, result.ExpiresAtUtc);
        return Ok(new SessionResponse(result.Username, result.Role, result.ExpiresAtUtc));
    }

    /// <summary>GET api/auth/me — returns the current session so the UI can restore it after a page reload.</summary>
    /// <returns>The signed-in user's name, role and session expiry.</returns>
    /// <response code="200">The caller has a valid session.</response>
    /// <response code="401">No valid session.</response>
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType<SessionResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public ActionResult<SessionResponse> Me()
    {
        var expires = long.TryParse(User.FindFirst("exp")?.Value, out var seconds)
            ? DateTimeOffset.FromUnixTimeSeconds(seconds).UtcDateTime
            : DateTime.UtcNow;
        return Ok(new SessionResponse(User.GetUsername(), User.FindFirst("role")?.Value ?? string.Empty, expires));
    }

    /// <summary>POST api/auth/logout — clears the session cookie.</summary>
    /// <response code="204">The session cookie was cleared.</response>
    [HttpPost("logout")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public IActionResult Logout()
    {
        AuthCookie.Delete(Response);
        return NoContent();
    }
}
