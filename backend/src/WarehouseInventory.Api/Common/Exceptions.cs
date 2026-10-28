namespace WarehouseInventory.Api.Common;

/// <summary>Thrown when a requested resource does not exist. Mapped to HTTP 404.</summary>
public class NotFoundException : Exception
{
    /// <summary>Creates the exception.</summary>
    /// <param name="message">Client-safe message returned as the problem detail.</param>
    public NotFoundException(string message) : base(message)
    {
    }
}

/// <summary>Thrown when a request conflicts with existing state (e.g. a duplicate SKU). Mapped to HTTP 409.</summary>
public class ConflictException : Exception
{
    /// <summary>Creates the exception.</summary>
    /// <param name="message">Client-safe message returned as the problem detail.</param>
    public ConflictException(string message) : base(message)
    {
    }
}

/// <summary>Thrown when a request is well-formed but violates a business rule. Mapped to HTTP 422.</summary>
public class BusinessRuleException : Exception
{
    /// <summary>Creates the exception.</summary>
    /// <param name="message">Client-safe message returned as the problem detail.</param>
    public BusinessRuleException(string message) : base(message)
    {
    }
}
