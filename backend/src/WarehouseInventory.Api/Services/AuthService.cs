using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using WarehouseInventory.Api.Configuration;
using WarehouseInventory.Api.Data;
using WarehouseInventory.Api.Domain;
using WarehouseInventory.Api.Dtos;

namespace WarehouseInventory.Api.Services;

/// <summary>Verifies user credentials and issues JWT bearer tokens.</summary>
public interface IAuthService
{
    /// <summary>Returns a token for valid credentials, or null when the username or password is wrong.</summary>
    /// <param name="request">The submitted username and password.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The token and user details, or <c>null</c> for unknown, inactive or wrong-password accounts.</returns>
    Task<LoginResponse?> LoginAsync(LoginRequest request, CancellationToken ct);
}

/// <summary>
/// Password-based login against the user table. Unknown users are verified against a dummy hash so timing
/// does not reveal which usernames exist; hashes flagged for upgrade are re-hashed on successful login.
/// </summary>
public sealed class AuthService : IAuthService
{
    private readonly WarehouseDbContext _db;
    private readonly IPasswordHasher<AppUser> _hasher;
    private readonly JwtOptions _jwt;
    private readonly TimeProvider _clock;

    // Verifying against a throwaway hash for unknown users keeps response timing similar to a wrong password.
    private static readonly Lazy<string> DummyHash = new(() => new PasswordHasher<AppUser>().HashPassword(new AppUser(), Guid.NewGuid().ToString()));

    /// <summary>Creates the service.</summary>
    /// <param name="db">Database context holding the user table.</param>
    /// <param name="hasher">Password hasher used to verify and upgrade hashes.</param>
    /// <param name="jwt">JWT issuer, audience, key and lifetime settings.</param>
    /// <param name="clock">Time source for token issue and expiry times.</param>
    public AuthService(WarehouseDbContext db, IPasswordHasher<AppUser> hasher, IOptions<JwtOptions> jwt, TimeProvider clock)
    {
        _db = db;
        _hasher = hasher;
        _jwt = jwt.Value;
        _clock = clock;
    }

    /// <inheritdoc />
    public async Task<LoginResponse?> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        var username = request.Username.Trim();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == username && u.IsActive, ct);

        if (user is null)
        {
            //this call burns comparable CPU time for unknown users so timing does not leak valid usernames
            _hasher.VerifyHashedPassword(new AppUser(), DummyHash.Value, request.Password);
            return null;
        }

        //this call checks the submitted password against the stored hash
        var result = _hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (result == PasswordVerificationResult.Failed)
        {
            return null;
        }

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            //this call upgrades a hash created with older hashing parameters
            user.PasswordHash = _hasher.HashPassword(user, request.Password);
            await _db.SaveChangesAsync(ct);
        }

        var expires = _clock.GetUtcNow().UtcDateTime.AddMinutes(_jwt.ExpiryMinutes);
        //this call signs the JWT carrying the user's id, name and role
        return new LoginResponse(CreateToken(user, expires), user.Username, user.Role, expires);
    }

    /// <summary>Builds and signs a JWT with sub, name and role claims for the user.</summary>
    /// <param name="user">The authenticated user.</param>
    /// <param name="expiresUtc">Token expiry time in UTC.</param>
    /// <returns>The serialized, HMAC-SHA256 signed token.</returns>
    private string CreateToken(AppUser user, DateTime expiresUtc)
    {
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = _jwt.Issuer,
            Audience = _jwt.Audience,
            IssuedAt = _clock.GetUtcNow().UtcDateTime,
            NotBefore = _clock.GetUtcNow().UtcDateTime,
            Expires = expiresUtc,
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Name, user.Username),
                new Claim("role", user.Role),
            }),
            SigningCredentials = new SigningCredentials(CreateSigningKey(_jwt.Key), SecurityAlgorithms.HmacSha256),
        };

        return new JsonWebTokenHandler().CreateToken(descriptor);
    }

    /// <summary>Creates the symmetric key used both to sign tokens and to validate them in the JWT bearer handler.</summary>
    /// <param name="key">The configured signing key.</param>
    /// <returns>A key over the UTF-8 bytes of <paramref name="key"/>.</returns>
    public static SymmetricSecurityKey CreateSigningKey(string key) => new(Encoding.UTF8.GetBytes(key));
}
