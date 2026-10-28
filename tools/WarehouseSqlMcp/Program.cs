// Minimal MCP (Model Context Protocol) server over stdio for the WarehouseInventory development database.
// Every connection impersonates the database-only user `warehouse_mcp` (EXECUTE AS ... WITH NO REVERT), so the
// database enforces least privilege (see backend/database/mcp-access.sql). stdout carries protocol messages only;
// diagnostics go to stderr.

using System.Text.Json;
using System.Text.Json.Nodes;
using WarehouseSqlMcp;

var connectionString = Environment.GetEnvironmentVariable("WAREHOUSE_MCP_CONNECTION");
if (string.IsNullOrWhiteSpace(connectionString))
{
    Console.Error.WriteLine("WAREHOUSE_MCP_CONNECTION is not set.");
    return 1;
}

var tools = new SqlTools(connectionString);
var stdout = Console.OpenStandardOutput();

string? line;
while ((line = await Console.In.ReadLineAsync()) is not null)
{
    if (string.IsNullOrWhiteSpace(line))
    {
        continue;
    }

    JsonNode? response;
    try
    {
        response = await McpProtocol.HandleAsync(JsonNode.Parse(line)!.AsObject(), tools);
    }
    catch (JsonException)
    {
        response = McpProtocol.Error(null, -32700, "Parse error");
    }
    catch (Exception ex)
    {
        // Keep the server alive; details go to stderr only.
        Console.Error.WriteLine(ex);
        response = McpProtocol.Error(null, -32603, "Internal error");
    }

    if (response is not null)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes(response.ToJsonString() + "\n");
        await stdout.WriteAsync(bytes);
        await stdout.FlushAsync();
    }
}

return 0;
