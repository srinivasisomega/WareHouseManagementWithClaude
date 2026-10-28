namespace WarehouseInventory.Api.Common;

/// <summary>
/// The session JWT travels in an HttpOnly cookie so browser scripts cannot read it (XSS token theft).
/// SameSite=Strict keeps the browser from sending it on cross-site requests (CSRF).
/// </summary>
public static class AuthCookie
{
    /// <summary>Cookie name holding the JWT.</summary>
    public const string Name = "wh_auth";

    /// <summary>Writes the session cookie, expiring together with the token.</summary>
    public static void Append(HttpResponse response, string token, DateTime expiresAtUtc) =>
        response.Cookies.Append(Name, token, Options(response.HttpContext, expiresAtUtc));

    /// <summary>Removes the session cookie.</summary>
    public static void Delete(HttpResponse response) =>
        response.Cookies.Delete(Name, Options(response.HttpContext, expiresAtUtc: null));

    private static CookieOptions Options(HttpContext context, DateTime? expiresAtUtc) => new()
    {
        HttpOnly = true,
        SameSite = SameSiteMode.Strict,
        // Secure everywhere except plain-HTTP local development (the Vite dev proxy talks HTTP to the API).
        Secure = context.Request.IsHttps || !context.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment(),
        Path = "/api",
        IsEssential = true,
        Expires = expiresAtUtc is null ? null : new DateTimeOffset(expiresAtUtc.Value, TimeSpan.Zero),
    };
}
