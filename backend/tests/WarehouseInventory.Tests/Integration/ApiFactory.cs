using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WarehouseInventory.Api.Data;
using WarehouseInventory.Api.Dtos;

namespace WarehouseInventory.Tests.Integration;

/// <summary>
/// Hosts the API against a throwaway SQL Server LocalDB database that is created by migrations
/// on startup and dropped when the fixture is disposed, so tests never touch the development database.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string AdminPassword = "Admin#Test1";
    public const string StaffPassword = "Staff#Test1";

    private readonly string _connectionString =
        $"Server=(localdb)\\MSSQLLocalDB;Database=WarehouseInventory_Test_{Guid.NewGuid():N};Trusted_Connection=True;TrustServerCertificate=True";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:WarehouseDb", _connectionString);
        builder.UseSetting("Database:ApplyMigrationsOnStartup", "true");
        builder.UseSetting("Jwt:Key", "integration-test-signing-key-that-is-long-enough");
        builder.UseSetting("SeedUsers:AdminPassword", AdminPassword);
        builder.UseSetting("SeedUsers:StaffPassword", StaffPassword);
        builder.UseSetting("RateLimiting:LoginPermitLimitPerMinute", "1000");
    }

    public async Task<HttpClient> CreateClientAsAsync(string username, string password)
    {
        var client = CreateBrowserClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new { username, password });
        response.EnsureSuccessStatusCode();
        // The session JWT is now held in the client's cookie container (HttpOnly cookie), like a browser.
        return client;
    }

    /// <summary>A browser-like client: HTTPS (so Secure cookies flow) with a cookie container.</summary>
    public HttpClient CreateBrowserClient() =>
        CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost"), HandleCookies = true });

    public Task<HttpClient> CreateAdminClientAsync() => CreateClientAsAsync("admin", AdminPassword);

    public Task<HttpClient> CreateStaffClientAsync() => CreateClientAsAsync("staff", StaffPassword);

    public Task InitializeAsync() => Task.CompletedTask;

    async Task IAsyncLifetime.DisposeAsync()
    {
        using (var scope = Services.CreateScope())
        {
            await scope.ServiceProvider.GetRequiredService<WarehouseDbContext>().Database.EnsureDeletedAsync();
        }

        await base.DisposeAsync();
    }
}
