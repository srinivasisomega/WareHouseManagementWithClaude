using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc;
using WarehouseInventory.Api.Dtos;

namespace WarehouseInventory.Tests.Integration;

public class ApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public ApiTests(ApiFactory factory)
    {
        _factory = factory;
    }

    private static string Unique(string prefix) => $"{prefix}-{Guid.NewGuid().ToString("N")[..8]}".ToUpperInvariant();

    [Fact]
    public async Task Login_SetsHttpOnlyStrictSecureCookie_AndReturnsNoToken()
    {
        var response = await _factory.CreateBrowserClient().PostAsJsonAsync("/api/auth/login", new { username = "staff", password = ApiFactory.StaffPassword });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<SessionResponse>();
        Assert.Equal("Staff", body!.Role);
        Assert.DoesNotContain("token", await response.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);

        var cookie = Assert.Single(response.Headers.GetValues("Set-Cookie"), c => c.StartsWith("wh_auth="));
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=strict", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("secure", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/api", cookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Me_WithSessionCookie_ReturnsUser_AndLogoutEndsSession()
    {
        var staff = await _factory.CreateStaffClientAsync();

        var me = await staff.GetFromJsonAsync<SessionResponse>("/api/auth/me");
        Assert.Equal("staff", me!.Username);
        Assert.Equal("Staff", me.Role);
        Assert.True(me.ExpiresAtUtc > DateTime.UtcNow);

        Assert.Equal(HttpStatusCode.NoContent, (await staff.PostAsync("/api/auth/logout", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await staff.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await staff.GetAsync("/api/inventory")).StatusCode);
    }

    [Fact]
    public async Task Me_WithoutSession_Returns401()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateBrowserClient().GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task Login_WithWrongPassword_Returns401ProblemWithoutDetailLeak()
    {
        var response = await _factory.CreateClient().PostAsJsonAsync("/api/auth/login", new { username = "admin", password = "nope" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal("Invalid username or password.", problem!.Detail);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithoutToken_Returns401()
    {
        var response = await _factory.CreateClient().GetAsync("/api/inventory");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Staff_CannotCreateItems_Returns403()
    {
        var staff = await _factory.CreateStaffClientAsync();

        var response = await staff.PostAsJsonAsync("/api/items", new ItemRequest { Sku = Unique("X"), Name = "x", UnitOfMeasure = "EA" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task CreateItem_InvalidPayload_Returns400WithFieldErrors()
    {
        var admin = await _factory.CreateAdminClientAsync();

        var response = await admin.PostAsJsonAsync("/api/items", new { sku = "bad sku!", name = "", unitOfMeasure = "EA", lowStockThreshold = -1 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.Contains("Sku", problem!.Errors.Keys);
        Assert.Contains("Name", problem.Errors.Keys);
        Assert.Contains("LowStockThreshold", problem.Errors.Keys);
    }

    [Fact]
    public async Task CreateItem_DuplicateSku_Returns409()
    {
        var admin = await _factory.CreateAdminClientAsync();
        var request = new ItemRequest { Sku = Unique("DUP"), Name = "Dup", UnitOfMeasure = "EA" };

        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("/api/items", request)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync("/api/items", request)).StatusCode);
    }

    [Fact]
    public async Task GetItem_Unknown_Returns404Problem()
    {
        var staff = await _factory.CreateStaffClientAsync();

        var response = await staff.GetAsync("/api/items/987654");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Transfer_InsufficientStock_Returns422()
    {
        var admin = await _factory.CreateAdminClientAsync();
        var item = await Create<ItemDto>(admin, "/api/items", new ItemRequest { Sku = Unique("T"), Name = "T", UnitOfMeasure = "EA" });
        var from = await Create<LocationDto>(admin, "/api/locations", new LocationRequest { Code = Unique("F"), Name = "From" });
        var to = await Create<LocationDto>(admin, "/api/locations", new LocationRequest { Code = Unique("T"), Name = "To" });

        var staff = await _factory.CreateStaffClientAsync();
        var response = await staff.PostAsJsonAsync("/api/stock/transfers",
            new TransferStockRequest { ItemId = item.Id, FromLocationId = from.Id, ToLocationId = to.Id, Quantity = 1 });

        Assert.Equal((HttpStatusCode)422, response.StatusCode);
    }

    [Fact]
    public async Task EndToEnd_ReceiveMoveAlertPickPackDispatch()
    {
        var admin = await _factory.CreateAdminClientAsync();
        var sku = Unique("E2E");
        var item = await Create<ItemDto>(admin, "/api/items", new ItemRequest { Sku = sku, Name = "End to end", UnitOfMeasure = "EA", LowStockThreshold = 5 });
        var dock = await Create<LocationDto>(admin, "/api/locations", new LocationRequest { Code = Unique("DOCK"), Name = "Dock" });
        var shelf = await Create<LocationDto>(admin, "/api/locations", new LocationRequest { Code = Unique("SHELF"), Name = "Shelf" });

        var staff = await _factory.CreateStaffClientAsync();

        var receipt = await Create<StockMovementDto>(staff, "/api/stock/receipts",
            new ReceiveStockRequest { ItemId = item.Id, LocationId = dock.Id, Quantity = 8, Reference = "PO-77" });
        Assert.Equal("staff", receipt.PerformedBy);

        await Create<StockMovementDto>(staff, "/api/stock/transfers",
            new TransferStockRequest { ItemId = item.Id, FromLocationId = dock.Id, ToLocationId = shelf.Id, Quantity = 6 });

        var inventory = await staff.GetFromJsonAsync<List<InventoryItemDto>>($"/api/inventory?search={sku}");
        var row = Assert.Single(inventory!);
        Assert.Equal(8, row.TotalQuantity);
        Assert.False(row.IsLowStock);
        Assert.Equal(new[] { 2, 6 }, row.Locations.OrderBy(l => l.Quantity).Select(l => l.Quantity));

        var order = await Create<OrderDetailDto>(staff, "/api/orders",
            new CreateOrderRequest { CustomerName = "Acme", Lines = { new CreateOrderLineRequest { ItemId = item.Id, Quantity = 4 } } });
        Assert.Equal("Open", order.Status);

        order = await Post<OrderDetailDto>(staff, $"/api/orders/{order.Id}/pick",
            new PickRequest { OrderLineId = order.Lines[0].Id, LocationId = shelf.Id, Quantity = 4 });
        Assert.Equal("Picked", order.Status);

        var alerts = await staff.GetFromJsonAsync<List<StockAlertDto>>("/api/inventory/alerts");
        var alert = Assert.Single(alerts!, a => a.Sku == sku);
        Assert.Equal(4, alert.TotalQuantity);

        var earlyDispatch = await staff.PostAsJsonAsync($"/api/orders/{order.Id}/dispatch", new DispatchRequest { Carrier = "UPS" });
        Assert.Equal((HttpStatusCode)422, earlyDispatch.StatusCode);

        order = await Post<OrderDetailDto>(staff, $"/api/orders/{order.Id}/pack", new PackRequest { PackageCount = 1 });
        Assert.Equal("Packed", order.Status);

        order = await Post<OrderDetailDto>(staff, $"/api/orders/{order.Id}/dispatch", new DispatchRequest { Carrier = "UPS", TrackingNumber = "1Z1" });
        Assert.Equal("Dispatched", order.Status);

        var movements = await staff.GetFromJsonAsync<List<StockMovementDto>>($"/api/stock/movements?itemId={item.Id}");
        Assert.Equal(new[] { "Pick", "Transfer", "Receipt" }, movements!.Select(m => m.Type));
    }

    private static async Task<T> Create<T>(HttpClient client, string url, object body)
    {
        var response = await client.PostAsJsonAsync(url, body);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<T>())!;
    }

    private static async Task<T> Post<T>(HttpClient client, string url, object body)
    {
        var response = await client.PostAsJsonAsync(url, body);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<T>())!;
    }
}
