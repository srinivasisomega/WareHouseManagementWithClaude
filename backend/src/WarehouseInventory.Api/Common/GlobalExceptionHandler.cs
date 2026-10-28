using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace WarehouseInventory.Api.Common;

/// <summary>
/// Converts exceptions into RFC 7807 problem responses. Known domain exceptions keep their message;
/// anything unexpected is logged and returned as a generic 500 without internal details.
/// </summary>
public sealed class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;
    private readonly IProblemDetailsService _problemDetailsService;

    /// <summary>Creates the handler.</summary>
    /// <param name="logger">Logger for rejected and unhandled requests.</param>
    /// <param name="problemDetailsService">Writes the RFC 7807 response body.</param>
    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger, IProblemDetailsService problemDetailsService)
    {
        _logger = logger;
        _problemDetailsService = problemDetailsService;
    }

    /// <summary>
    /// Maps <see cref="NotFoundException"/> to 404, <see cref="ConflictException"/> and <see cref="DbUpdateConcurrencyException"/>
    /// to 409, <see cref="BusinessRuleException"/> to 422 and anything else to 500, then writes a problem response.
    /// </summary>
    /// <param name="httpContext">The failing request.</param>
    /// <param name="exception">The exception thrown by the pipeline.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>True when the problem response was written.</returns>
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var (status, title, detail) = exception switch
        {
            NotFoundException e => (StatusCodes.Status404NotFound, "Not found", e.Message),
            ConflictException e => (StatusCodes.Status409Conflict, "Conflict", e.Message),
            BusinessRuleException e => (StatusCodes.Status422UnprocessableEntity, "Request could not be processed", e.Message),
            DbUpdateConcurrencyException => (StatusCodes.Status409Conflict, "Conflict",
                "The stock record was changed by another user. Refresh and try again."),
            _ => (StatusCodes.Status500InternalServerError, "Server error", "An unexpected error occurred."),
        };

        if (status == StatusCodes.Status500InternalServerError)
        {
            _logger.LogError(exception, "Unhandled exception for {Method} {Path}", httpContext.Request.Method, httpContext.Request.Path);
        }
        else
        {
            _logger.LogInformation("Request {Method} {Path} rejected with {Status}: {Message}",
                httpContext.Request.Method, httpContext.Request.Path, status, detail);
        }

        httpContext.Response.StatusCode = status;
        return await _problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = new ProblemDetails { Status = status, Title = title, Detail = detail },
        });
    }
}
