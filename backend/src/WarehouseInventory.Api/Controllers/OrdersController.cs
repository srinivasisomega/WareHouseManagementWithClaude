using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WarehouseInventory.Api.Common;
using WarehouseInventory.Api.Configuration;
using WarehouseInventory.Api.Domain;
using WarehouseInventory.Api.Dtos;
using WarehouseInventory.Api.Services;

namespace WarehouseInventory.Api.Controllers;

/// <summary>Outbound fulfillment orders and their pick, pack and dispatch steps. Available to staff and admins.</summary>
[ApiController]
[Route("api/orders")]
[Authorize(Policy = AuthPolicies.WarehouseOperations)]
public sealed class OrdersController : ControllerBase
{
    private readonly IOrderService _orderService;

    /// <summary>Creates the controller.</summary>
    /// <param name="orderService">Service that runs the order workflow.</param>
    public OrdersController(IOrderService orderService)
    {
        _orderService = orderService;
    }

    /// <summary>GET api/orders — lists orders, newest first.</summary>
    /// <param name="status">Optional status filter.</param>
    /// <param name="ct">Request cancellation token.</param>
    /// <returns>Order summaries.</returns>
    /// <response code="200">The matching orders (possibly empty).</response>
    /// <response code="400">The status value is not a valid <see cref="OrderStatus"/>.</response>
    /// <response code="401">The caller is not authenticated.</response>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<OrderSummaryDto>>> GetOrders([FromQuery] OrderStatus? status, CancellationToken ct) =>
        Ok(await _orderService.GetOrdersAsync(status, ct));

    /// <summary>GET api/orders/{id} — returns an order with its lines and where each line's item is in stock.</summary>
    /// <param name="id">Order id.</param>
    /// <param name="ct">Request cancellation token.</param>
    /// <returns>The order detail.</returns>
    /// <response code="200">The order was found.</response>
    /// <response code="401">The caller is not authenticated.</response>
    /// <response code="404">No order has this id.</response>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<OrderDetailDto>> GetOrder(int id, CancellationToken ct) =>
        Ok(await _orderService.GetOrderAsync(id, ct));

    /// <summary>POST api/orders — creates an order in the Open status, recording the caller as its creator.</summary>
    /// <param name="request">Customer and order lines.</param>
    /// <param name="ct">Request cancellation token.</param>
    /// <returns>The created order, with a Location header pointing at <see cref="GetOrder"/>.</returns>
    /// <response code="201">The order was created.</response>
    /// <response code="400">The request failed validation (e.g. no lines, invalid quantity).</response>
    /// <response code="401">The caller is not authenticated.</response>
    /// <response code="422">An item appears more than once, or an item does not exist or is inactive.</response>
    [HttpPost]
    [ProducesResponseType<OrderDetailDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<OrderDetailDto>> CreateOrder(CreateOrderRequest request, CancellationToken ct)
    {
        // The caller's username is recorded as the order's creator.
        var order = await _orderService.CreateOrderAsync(request, User.GetUsername(), ct);
        return CreatedAtAction(nameof(GetOrder), new { id = order.Id }, order);
    }

    /// <summary>POST api/orders/{id}/pick — picks a quantity of one order line from a location, removing it from stock.</summary>
    /// <param name="id">Order id.</param>
    /// <param name="request">The order line, source location and quantity to pick.</param>
    /// <param name="ct">Request cancellation token.</param>
    /// <returns>The updated order; its status becomes Picking, or Picked once every line is complete.</returns>
    /// <response code="200">The pick was recorded.</response>
    /// <response code="400">The request failed validation.</response>
    /// <response code="401">The caller is not authenticated.</response>
    /// <response code="404">The order, or the line on this order, was not found.</response>
    /// <response code="409">The stock record was changed concurrently by another user; refresh and retry.</response>
    /// <response code="422">The order is past picking, the quantity exceeds what remains on the line, or the location has insufficient stock.</response>
    [HttpPost("{id:int}/pick")]
    public async Task<ActionResult<OrderDetailDto>> Pick(int id, PickRequest request, CancellationToken ct) =>
        Ok(await _orderService.PickAsync(id, request, User.GetUsername(), ct));

    /// <summary>POST api/orders/{id}/pack — marks a fully picked order as packed.</summary>
    /// <param name="id">Order id.</param>
    /// <param name="request">Number of packages.</param>
    /// <param name="ct">Request cancellation token.</param>
    /// <returns>The updated order in the Packed status.</returns>
    /// <response code="200">The order was packed.</response>
    /// <response code="400">The request failed validation.</response>
    /// <response code="401">The caller is not authenticated.</response>
    /// <response code="404">No order has this id.</response>
    /// <response code="422">The order is not in the Picked status.</response>
    [HttpPost("{id:int}/pack")]
    public async Task<ActionResult<OrderDetailDto>> Pack(int id, PackRequest request, CancellationToken ct) =>
        Ok(await _orderService.PackAsync(id, request, ct));

    /// <summary>POST api/orders/{id}/dispatch — records carrier details and marks a packed order as dispatched.</summary>
    /// <param name="id">Order id.</param>
    /// <param name="request">Carrier and optional tracking number.</param>
    /// <param name="ct">Request cancellation token.</param>
    /// <returns>The updated order in the Dispatched status.</returns>
    /// <response code="200">The order was dispatched.</response>
    /// <response code="400">The request failed validation.</response>
    /// <response code="401">The caller is not authenticated.</response>
    /// <response code="404">No order has this id.</response>
    /// <response code="422">The order is not in the Packed status.</response>
    [HttpPost("{id:int}/dispatch")]
    public async Task<ActionResult<OrderDetailDto>> Dispatch(int id, DispatchRequest request, CancellationToken ct) =>
        Ok(await _orderService.DispatchAsync(id, request, ct));
}
