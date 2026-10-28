using Microsoft.EntityFrameworkCore;
using WarehouseInventory.Api.Common;
using WarehouseInventory.Api.Data;
using WarehouseInventory.Api.Domain;
using WarehouseInventory.Api.Dtos;

namespace WarehouseInventory.Api.Services;

/// <summary>Maintains storage location master data.</summary>
public interface ILocationService
{
    /// <summary>Lists locations ordered by code.</summary>
    /// <param name="includeInactive">When true, inactive locations are included.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The locations.</returns>
    Task<IReadOnlyList<LocationDto>> GetLocationsAsync(bool includeInactive, CancellationToken ct);

    /// <summary>Returns a single location.</summary>
    /// <param name="id">Location id.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The location.</returns>
    /// <exception cref="NotFoundException">No location has this id.</exception>
    Task<LocationDto> GetLocationAsync(int id, CancellationToken ct);

    /// <summary>Creates a location. The code is trimmed and upper-cased before the uniqueness check.</summary>
    /// <param name="request">The location details.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The created location.</returns>
    /// <exception cref="ConflictException">Another location already uses the code.</exception>
    Task<LocationDto> CreateLocationAsync(LocationRequest request, CancellationToken ct);

    /// <summary>Replaces all editable fields of a location.</summary>
    /// <param name="id">Location id.</param>
    /// <param name="request">The new location details.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The updated location.</returns>
    /// <exception cref="NotFoundException">No location has this id.</exception>
    /// <exception cref="ConflictException">The new code is already used by another location.</exception>
    /// <exception cref="BusinessRuleException">Deactivation was requested while the location still holds stock.</exception>
    Task<LocationDto> UpdateLocationAsync(int id, LocationRequest request, CancellationToken ct);
}

/// <summary>EF Core implementation of <see cref="ILocationService"/>.</summary>
public sealed class LocationService : ILocationService
{
    private readonly WarehouseDbContext _db;
    private readonly TimeProvider _clock;

    /// <summary>Creates the service.</summary>
    /// <param name="db">Database context.</param>
    /// <param name="clock">Time source for audit timestamps.</param>
    public LocationService(WarehouseDbContext db, TimeProvider clock)
    {
        _db = db;
        _clock = clock;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<LocationDto>> GetLocationsAsync(bool includeInactive, CancellationToken ct)
    {
        var query = _db.Locations.AsNoTracking();
        if (!includeInactive)
        {
            query = query.Where(l => l.IsActive);
        }

        return await query.OrderBy(l => l.Code).Select(l => ToDto(l)).ToListAsync(ct);
    }

    /// <inheritdoc />
    public async Task<LocationDto> GetLocationAsync(int id, CancellationToken ct)
    {
        var location = await _db.Locations.AsNoTracking().FirstOrDefaultAsync(l => l.Id == id, ct)
            ?? throw new NotFoundException($"Location {id} was not found.");
        return ToDto(location);
    }

    /// <inheritdoc />
    public async Task<LocationDto> CreateLocationAsync(LocationRequest request, CancellationToken ct)
    {
        //this method is called to normalize the code and reject duplicates before inserting
        var code = ItemService.NormalizeCode(request.Code);
        await EnsureCodeIsUniqueAsync(code, excludeId: null, ct);

        var now = _clock.GetUtcNow().UtcDateTime;
        var location = new Location { CreatedAtUtc = now };
        //this method is called to copy the request fields and set the modified date
        Apply(location, request, code, now);

        _db.Locations.Add(location);
        await _db.SaveChangesAsync(ct);
        return ToDto(location);
    }

    /// <inheritdoc />
    public async Task<LocationDto> UpdateLocationAsync(int id, LocationRequest request, CancellationToken ct)
    {
        var location = await _db.Locations.FirstOrDefaultAsync(l => l.Id == id, ct)
            ?? throw new NotFoundException($"Location {id} was not found.");

        var code = ItemService.NormalizeCode(request.Code);
        if (code != location.Code)
        {
            //uniqueness is only checked when the code actually changes
            await EnsureCodeIsUniqueAsync(code, id, ct);
        }

        //a location may only be deactivated once all of its stock has been moved out
        if (!request.IsActive && location.IsActive
            && await _db.StockLevels.AnyAsync(s => s.LocationId == id && s.Quantity > 0, ct))
        {
            throw new BusinessRuleException("A location that still holds stock cannot be deactivated. Move the stock first.");
        }

        //this method is called to copy the request fields and update the modified date of the record
        Apply(location, request, code, _clock.GetUtcNow().UtcDateTime);
        await _db.SaveChangesAsync(ct);
        return ToDto(location);
    }

    /// <summary>Ensures no other location uses the code.</summary>
    /// <param name="code">Normalized location code.</param>
    /// <param name="excludeId">Location to ignore (the one being updated), or null on create.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <exception cref="ConflictException">Another location already uses the code.</exception>
    private async Task EnsureCodeIsUniqueAsync(string code, int? excludeId, CancellationToken ct)
    {
        if (await _db.Locations.AnyAsync(l => l.Code == code && l.Id != excludeId, ct))
        {
            throw new ConflictException($"A location with code '{code}' already exists.");
        }
    }

    /// <summary>Copies request fields onto the entity, normalizing text, and stamps the modified date.</summary>
    /// <param name="location">The entity to update.</param>
    /// <param name="request">The submitted details.</param>
    /// <param name="code">The already-normalized code.</param>
    /// <param name="now">Current UTC time, written to <see cref="Location.UpdatedAtUtc"/>.</param>
    private static void Apply(Location location, LocationRequest request, string code, DateTime now)
    {
        location.Code = code;
        location.Name = request.Name.Trim();
        location.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        location.IsActive = request.IsActive;
        location.UpdatedAtUtc = now;
    }

    private static LocationDto ToDto(Location l) => new(l.Id, l.Code, l.Name, l.Description, l.IsActive);
}
