using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WarehouseInventory.Api.Configuration;
using WarehouseInventory.Api.Dtos;
using WarehouseInventory.Api.Services;

namespace WarehouseInventory.Api.Controllers;

/// <summary>Read-only views of on-hand stock and low-stock alerts. Available to staff and admins.</summary>
[ApiController]
[Route("api/inventory")]
[Authorize(Policy = AuthPolicies.WarehouseOperations)]
public sealed class InventoryController : ControllerBase
{
    private readonly IInventoryService _inventoryService;

    /// <summary>Creates the controller.</summary>
    /// <param name="inventoryService">Service that queries on-hand stock.</param>
    public InventoryController(IInventoryService inventoryService)
    {
        _inventoryService = inventoryService;
    }

    /// <summary>GET api/inventory — searches active items with their total and per-location on-hand quantities.</summary>
    /// <param name="search">Optional text matched against SKU or name.</param>
    /// <param name="locationId">Optional location; only items with stock at that location are returned.</param>
    /// <param name="lowStockOnly">When true, only items at or below their low-stock threshold are returned.</param>
    /// <param name="ct">Request cancellation token.</param>
    /// <returns>Matching items ordered by SKU, capped at <see cref="InventoryService.MaxResults"/>.</returns>
    /// <response code="200">The matching inventory rows (possibly empty).</response>
    /// <response code="401">The caller is not authenticated.</response>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<InventoryItemDto>>> Search(
        [FromQuery] string? search, [FromQuery] int? locationId, [FromQuery] bool lowStockOnly, CancellationToken ct) =>
        Ok(await _inventoryService.SearchAsync(search, locationId, lowStockOnly, ct));

    /// <summary>GET api/inventory/alerts — lists active items whose total stock is at or below their threshold.</summary>
    /// <param name="ct">Request cancellation token.</param>
    /// <returns>Alerts ordered by largest shortfall first.</returns>
    /// <response code="200">The current low-stock alerts (possibly empty).</response>
    /// <response code="401">The caller is not authenticated.</response>
    [HttpGet("alerts")]
    public async Task<ActionResult<IReadOnlyList<StockAlertDto>>> GetAlerts(CancellationToken ct) =>
        Ok(await _inventoryService.GetLowStockAlertsAsync(ct));
}
