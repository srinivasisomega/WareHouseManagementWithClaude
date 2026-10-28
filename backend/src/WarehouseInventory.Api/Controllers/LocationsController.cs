using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WarehouseInventory.Api.Configuration;
using WarehouseInventory.Api.Dtos;
using WarehouseInventory.Api.Services;

namespace WarehouseInventory.Api.Controllers;

/// <summary>Storage location master data. Reads are open to staff and admins; changes are admin-only.</summary>
[ApiController]
[Route("api/locations")]
[Authorize(Policy = AuthPolicies.WarehouseOperations)]
public sealed class LocationsController : ControllerBase
{
    private readonly ILocationService _locationService;

    /// <summary>Creates the controller.</summary>
    /// <param name="locationService">Service that manages location master data.</param>
    public LocationsController(ILocationService locationService)
    {
        _locationService = locationService;
    }

    /// <summary>GET api/locations — lists locations ordered by code.</summary>
    /// <param name="includeInactive">When true, inactive locations are included.</param>
    /// <param name="ct">Request cancellation token.</param>
    /// <returns>The locations.</returns>
    /// <response code="200">The locations (possibly empty).</response>
    /// <response code="401">The caller is not authenticated.</response>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<LocationDto>>> GetLocations([FromQuery] bool includeInactive, CancellationToken ct) =>
        Ok(await _locationService.GetLocationsAsync(includeInactive, ct));

    /// <summary>GET api/locations/{id} — returns a single location.</summary>
    /// <param name="id">Location id.</param>
    /// <param name="ct">Request cancellation token.</param>
    /// <returns>The location.</returns>
    /// <response code="200">The location was found.</response>
    /// <response code="401">The caller is not authenticated.</response>
    /// <response code="404">No location has this id.</response>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<LocationDto>> GetLocation(int id, CancellationToken ct) =>
        Ok(await _locationService.GetLocationAsync(id, ct));

    /// <summary>POST api/locations — creates a location. Admin only. The code is trimmed and upper-cased.</summary>
    /// <param name="request">The location to create.</param>
    /// <param name="ct">Request cancellation token.</param>
    /// <returns>The created location, with a Location header pointing at <see cref="GetLocation"/>.</returns>
    /// <response code="201">The location was created.</response>
    /// <response code="400">The request failed validation.</response>
    /// <response code="401">The caller is not authenticated.</response>
    /// <response code="403">The caller is not an admin.</response>
    /// <response code="409">Another location already uses this code.</response>
    [HttpPost]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    [ProducesResponseType<LocationDto>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<LocationDto>> CreateLocation(LocationRequest request, CancellationToken ct)
    {
        var location = await _locationService.CreateLocationAsync(request, ct);
        return CreatedAtAction(nameof(GetLocation), new { id = location.Id }, location);
    }

    /// <summary>PUT api/locations/{id} — replaces a location's details, including its active flag. Admin only.</summary>
    /// <param name="id">Location id.</param>
    /// <param name="request">The new location details.</param>
    /// <param name="ct">Request cancellation token.</param>
    /// <returns>The updated location.</returns>
    /// <response code="200">The location was updated.</response>
    /// <response code="400">The request failed validation.</response>
    /// <response code="401">The caller is not authenticated.</response>
    /// <response code="403">The caller is not an admin.</response>
    /// <response code="404">No location has this id.</response>
    /// <response code="409">The new code is already used by another location.</response>
    /// <response code="422">The location still holds stock and cannot be deactivated.</response>
    [HttpPut("{id:int}")]
    [Authorize(Policy = AuthPolicies.AdminOnly)]
    public async Task<ActionResult<LocationDto>> UpdateLocation(int id, LocationRequest request, CancellationToken ct) =>
        Ok(await _locationService.UpdateLocationAsync(id, request, ct));
}
