using System.Text.Json.Nodes;

namespace WarehouseSqlMcp;

/// <summary>JSON-RPC 2.0 dispatch for the MCP methods this server supports.</summary>
internal static class McpProtocol
{
    private const string DefaultProtocolVersion = "2025-06-18";

    /// <summary>Handles one request or notification; returns null for notifications (no response).</summary>
    public static async Task<JsonNode?> HandleAsync(JsonObject message, SqlTools tools)
    {
        var id = message["id"]?.DeepClone();
        var method = message["method"]?.GetValue<string>();
        var isNotification = id is null;

        switch (method)
        {
            case "initialize":
                var requested = message["params"]?["protocolVersion"]?.GetValue<string>();
                return Result(id, new JsonObject
                {
                    ["protocolVersion"] = requested ?? DefaultProtocolVersion,
                    ["capabilities"] = new JsonObject { ["tools"] = new JsonObject() },
                    ["serverInfo"] = new JsonObject { ["name"] = "warehouse-sql", ["version"] = "1.0.0" },
                    ["instructions"] =
                        "Development access to the WarehouseInventory SQL Server database as least-privilege user warehouse_mcp: " +
                        "SELECT on all app tables except Users; INSERT/UPDATE on Items and Locations only; no DELETE or DDL. " +
                        "Change stock and orders through the ASP.NET Core API so audit rows are written.",
                });

            case "ping":
                return Result(id, new JsonObject());

            case "tools/list":
                return Result(id, new JsonObject { ["tools"] = SqlTools.Definitions() });

            case "tools/call":
                var name = message["params"]?["name"]?.GetValue<string>() ?? string.Empty;
                var arguments = message["params"]?["arguments"] as JsonObject ?? new JsonObject();
                var (text, isError) = await tools.CallAsync(name, arguments);
                return Result(id, new JsonObject
                {
                    ["content"] = new JsonArray(new JsonObject { ["type"] = "text", ["text"] = text }),
                    ["isError"] = isError,
                });

            default:
                // Notifications such as notifications/initialized need no reply.
                return isNotification ? null : Error(id, -32601, $"Method not found: {method}");
        }
    }

    public static JsonObject Result(JsonNode? id, JsonNode result) =>
        new() { ["jsonrpc"] = "2.0", ["id"] = id, ["result"] = result };

    public static JsonObject Error(JsonNode? id, int code, string message) =>
        new() { ["jsonrpc"] = "2.0", ["id"] = id, ["error"] = new JsonObject { ["code"] = code, ["message"] = message } };
}
