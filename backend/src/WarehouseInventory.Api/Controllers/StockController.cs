using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WarehouseInventory.Api.Common;
using WarehouseInventory.Api.Configuration;
using WarehouseInventory.Api.Dtos;
using WarehouseInventory.Api.Services;

namespace WarehouseInventory.Api.Controllers;

/// <summary>Stock receipts, transfers between locations, and the movement audit trail. Available to staff and admins.</summary>
[ApiController]
[Route("api/stock")]
[Authorize(Policy = AuthPolicies.WarehouseOperations)]
public sealed class StockController : ControllerBase
{
    private readonly IStockService _stockService;

    /// <summary>Creates the controller.</summary>
    /// <param name="stockService">Service that changes on-hand stock.</param>
    public StockController(IStockService stockService)
    {
        _stockService = stockService;
    }

    /// <summary>POST api/stock/receipts — receives incoming stock of an item into a location.</summary>
    /// <param name="request">Item, location, quantity and optional supplier reference.</param>
    /// <param name="ct">Request cancellation token.</param>
    /// <returns>The recorded Receipt movement.</returns>
    /// <response code="201">The stock was received.</response>
    /// <response code="400">The request failed validation.</response>
    /// <response code="401">The caller is not authenticated.</response>
    /// <response code="404">The item or location was not found.</response>
    /// <response code="409">The stock record was changed concurrently by another user; refresh and retry.</response>
    /// <response code="422">The item or location is inactive.</response>
    [HttpPost("receipts")]
    [ProducesResponseType<StockMovementDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<StockMovementDto>> Receive(ReceiveStockRequest request, CancellationToken ct)
    {
        // The caller's username is recorded on the movement audit record.
        var movement = await _stockService.ReceiveAsync(request, User.GetUsername(), ct);
        return StatusCode(StatusCodes.Status201Created, movement);
    }

    /// <summary>POST api/stock/transfers — moves a quantity of an item from one location to another.</summary>
    /// <param name="request">Item, source and destination locations, quantity and optional reference.</param>
    /// <param name="ct">Request cancellation token.</param>
    /// <returns>The recorded Transfer movement.</returns>
    /// <response code="201">The stock was transferred.</response>
    /// <response code="400">The request failed validation.</response>
    /// <response code="401">The caller is not authenticated.</response>
    /// <response code="404">The item or destination location was not found.</response>
    /// <response code="409">The stock record was changed concurrently by another user; refresh and retry.</response>
    /// <response code="422">Source equals destination, the item or destination is inactive, or the source has insufficient stock.</response>
    [HttpPost("transfers")]
    [ProducesResponseType<StockMovementDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<StockMovementDto>> Transfer(TransferStockRequest request, CancellationToken ct)
    {
        // The caller's username is recorded on the movement audit record.
        var movement = await _stockService.TransferAsync(request, User.GetUsername(), ct);
        return StatusCode(StatusCodes.Status201Created, movement);
    }

    /// <summary>GET api/stock/movements — lists stock movements, newest first.</summary>
    /// <param name="itemId">Optional item filter.</param>
    /// <param name="locationId">Optional location filter; matches movements from or to the location.</param>
    /// <param name="take">Maximum rows to return, clamped to 1..<see cref="StockService.MaxMovementsPage"/>.</param>
    /// <param name="ct">Request cancellation token.</param>
    /// <returns>The matching movements.</returns>
    /// <response code="200">The matching movements (possibly empty).</response>
    /// <response code="401">The caller is not authenticated.</response>
    [HttpGet("movements")]
    public async Task<ActionResult<IReadOnlyList<StockMovementDto>>> GetMovements(
        [FromQuery] int? itemId, [FromQuery] int? locationId, [FromQuery] int take = 100, CancellationToken ct = default) =>
        Ok(await _stockService.GetMovementsAsync(itemId, locationId, take, ct));
}
