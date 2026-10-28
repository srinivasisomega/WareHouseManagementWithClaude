using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using WarehouseInventory.Api.Configuration;
using WarehouseInventory.Api.Domain;
using WarehouseInventory.Api.Dtos;
using WarehouseInventory.Api.Services;

namespace WarehouseInventory.Tests.Unit;

public class AuthServiceTests
{
    private readonly Api.Data.WarehouseDbContext _db = TestData.CreateDb();
    private readonly PasswordHasher<AppUser> _hasher = new();
    private readonly AuthService _service;

    public AuthServiceTests()
    {
        var jwt = Options.Create(new JwtOptions { Issuer = "test", Audience = "test-client", Key = new string('k', 48), ExpiryMinutes = 60 });
        _service = new AuthService(_db, _hasher, jwt, new FixedTimeProvider());
        AddUser("admin", "Secret#1", UserRoles.Admin);
    }

    private void AddUser(string username, string password, string role, bool active = true)
    {
        var user = new AppUser { Username = username, Role = role, IsActive = active };
        user.PasswordHash = _hasher.HashPassword(user, password);
        _db.Users.Add(user);
        _db.SaveChanges();
    }

    [Fact]
    public async Task Login_ValidCredentials_ReturnsTokenWithRoleClaim()
    {
        var response = await _service.LoginAsync(new LoginRequest { Username = "admin", Password = "Secret#1" }, default);

        Assert.NotNull(response);
        Assert.Equal("Admin", response.Role);
        var token = new JsonWebToken(response.Token);
        Assert.Equal("Admin", token.GetClaim("role").Value);
        Assert.Equal("admin", token.GetClaim("name").Value);
        Assert.Equal(new DateTime(2026, 10, 27, 10, 0, 0, DateTimeKind.Utc), response.ExpiresAtUtc);
    }

    [Fact]
    public async Task Login_WrongPassword_ReturnsNull()
    {
        Assert.Null(await _service.LoginAsync(new LoginRequest { Username = "admin", Password = "wrong" }, default));
    }

    [Fact]
    public async Task Login_UnknownUser_ReturnsNull()
    {
        Assert.Null(await _service.LoginAsync(new LoginRequest { Username = "nobody", Password = "Secret#1" }, default));
    }

    [Fact]
    public async Task Login_InactiveUser_ReturnsNull()
    {
        AddUser("former", "Secret#2", UserRoles.Staff, active: false);

        Assert.Null(await _service.LoginAsync(new LoginRequest { Username = "former", Password = "Secret#2" }, default));
    }
}
