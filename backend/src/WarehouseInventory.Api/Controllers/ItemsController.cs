using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WarehouseInventory.Api.Configuration;
using WarehouseInventory.Api.Dtos;
using WarehouseInventory.Api.Services;

namespace WarehouseInventory.Api.Controllers;

/// <summary>Item (SKU) master data. Reads are open to staff and admins; changes are admin-only.</summary>
[ApiController]
[Route("api/items")]
[Authorize(Policy = AuthPolicies.WarehouseOperations)]
public sealed class ItemsController : ControllerBase
{
    private readonly IItemService _itemService;

    /// <summary>Creates the controller.</summary>
    /// <param name="itemService">Service that manages item master data.</param>
    public ItemsController(IItemService itemService)
    {
        _itemService = itemService;
    }

    /// <summary>GET api/items — lists items ordered by SKU.</summary>
    /// <param name="search">Optional text matched against SKU or name.</param>
    /// <param name="includeInactive">When true, inactive items are included.</param>
    /// <param name="ct">Request cancellation token.</param>
    /// <returns>The matching items.</returns>
    /// <response code="200">The matching items (possibly empty).</response>
    /// <response code="401">The caller is not authenticated.</response>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ItemDto>>> GetItems([FromQuery] string? search, [FromQuery] bool includeInactive, CancellationToken ct) =>
        Ok(await _itemService.GetItemsAsync(search, includeInactive, ct));

    /// <summary>GET api/items/{id} — returns a single item.</summary>
    /// <param name="id">Item id.</param>
    /// <param name="ct">Request cancellation token.</param>
    /// <returns>The item.</returns>
    /// <response code="200">The item was found.</response>
    /// <response code="401">The caller is not authenticated.</response>
    /// <response code="404">No item has this id.</response>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<ItemDto>> GetItem(int id, CancellationToken ct) =>
        Ok(await _itemService.GetItemAsync(id, ct));

    /// <summary>POST api/items — creates an item. Admin only. The SKU is trimmed and upper-cased.</summary>
    /// <param name="request">The item to create.</param>
    /// <param name="ct">Request cancellation token.</param>
    /// <returns>The created item, with a Location header pointing at <see cref="GetItem"/>.</returns>
    /// <response code="201">The item was created.</response>
    /// <response code="400">The request failed validation.</response>
    /// <response code="401">The caller is not authenticated.</response>
    /// <response code="403">The caller is not an admin.</response>
    /// <response code="409">Another item already uses this SKU.</response>
    [HttpPost]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    [ProducesResponseType<ItemDto>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ItemDto>> CreateItem(ItemRequest request, CancellationToken ct)
    {
        var item = await _itemService.CreateItemAsync(request, ct);
        return CreatedAtAction(nameof(GetItem), new { id = item.Id }, item);
    }

    /// <summary>PUT api/items/{id} — replaces an item's details, including SKU, threshold and active flag. Admin only.</summary>
    /// <param name="id">Item id.</param>
    /// <param name="request">The new item details.</param>
    /// <param name="ct">Request cancellation token.</param>
    /// <returns>The updated item.</returns>
    /// <response code="200">The item was updated.</response>
    /// <response code="400">The request failed validation.</response>
    /// <response code="401">The caller is not authenticated.</response>
    /// <response code="403">The caller is not an admin.</response>
    /// <response code="404">No item has this id.</response>
    /// <response code="409">The new SKU is already used by another item.</response>
    [HttpPut("{id:int}")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<ActionResult<ItemDto>> UpdateItem(int id, ItemRequest request, CancellationToken ct) =>
        Ok(await _itemService.UpdateItemAsync(id, request, ct));

    /// <summary>PUT api/items/{id}/threshold — changes only the item's low-stock threshold. Admin only.</summary>
    /// <param name="id">Item id.</param>
    /// <param name="request">The new threshold; zero disables alerts.</param>
    /// <param name="ct">Request cancellation token.</param>
    /// <returns>The updated item.</returns>
    /// <response code="200">The threshold was updated.</response>
    /// <response code="400">The request failed validation.</response>
    /// <response code="401">The caller is not authenticated.</response>
    /// <response code="403">The caller is not an admin.</response>
    /// <response code="404">No item has this id.</response>
    [HttpPut("{id:int}/threshold")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<ActionResult<ItemDto>> UpdateThreshold(int id, ThresholdRequest request, CancellationToken ct) =>
        Ok(await _itemService.UpdateThresholdAsync(id, request, ct));
}
