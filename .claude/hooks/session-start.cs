// SessionStart hook: prints concise orientation for a new Claude Code session.
// Claude Code adds this hook's stdout to the session context. No third-party dependencies.
// Run by: dotnet run --project .claude/hooks/session-start.csproj

using System.Text;
using System.Text.Json;

var projectDir = Environment.GetEnvironmentVariable("CLAUDE_PROJECT_DIR") ?? Directory.GetCurrentDirectory();

var source = "startup";
try
{
    // Hook input arrives as JSON on stdin; "source" is startup | resume | clear | compact.
    if (Console.IsInputRedirected)
    {
        var input = Console.In.ReadToEnd();
        if (!string.IsNullOrWhiteSpace(input))
        {
            using var doc = JsonDocument.Parse(input);
            if (doc.RootElement.TryGetProperty("source", out var s) && s.ValueKind == JsonValueKind.String)
            {
                source = s.GetString() ?? source;
            }
        }
    }
}
catch (JsonException)
{
    // Missing or malformed input should never block a session; fall back to defaults.
}

var sb = new StringBuilder();
sb.AppendLine($"[session-start:{source}] Warehouse Inventory project — orient before changing anything:");
sb.AppendLine("1. Inspect the existing architecture first (CLAUDE.md has the map):");
sb.AppendLine($"   - React frontend: frontend/ (React 19 + TS + Vite){Exists("frontend/package.json")}");
sb.AppendLine($"   - ASP.NET Core backend: backend/src/WarehouseInventory.Api (Controllers → Services → EF Core){Exists("backend/src/WarehouseInventory.Api/WarehouseInventory.Api.csproj")}");
sb.AppendLine("   - SQL Server database: LocalDB 'WarehouseInventory', EF Core migrations in backend/src/WarehouseInventory.Api/Data/Migrations");
sb.AppendLine($"   - SQL Server MCP tools: {DescribeSqlMcp()}");
sb.AppendLine("2. Main functionality by route:");
sb.AppendLine("   - Admin (/admin/*): items/SKUs, warehouse locations, low-stock thresholds.");
sb.AppendLine("   - Staff: inventory search, low-stock alerts, receive, move, movement history, orders pick → pack → dispatch.");
sb.AppendLine("3. Database inspection, querying and data manipulation during development: prefer the SQL Server MCP tools over the REST API.");
sb.AppendLine("4. Implementing or testing application behaviour: use the ASP.NET Core API (http://localhost:5041/api, Swagger at /swagger).");
sb.AppendLine("5. Follow .claude/rules/*.md and the relevant skills (create-api, create-react-feature). This orientation is analysis only — do not modify application code because of it.");

Console.Out.Write(sb.ToString());
return 0;

string Exists(string relativePath) =>
    File.Exists(Path.Combine(projectDir, relativePath)) ? string.Empty : " (not found)";

string DescribeSqlMcp()
{
    var mcpPath = Path.Combine(projectDir, ".mcp.json");
    if (!File.Exists(mcpPath))
    {
        return "none configured (.mcp.json missing) — fall back to read-only sqlcmd queries.";
    }

    try
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(mcpPath));
        if (doc.RootElement.TryGetProperty("mcpServers", out var servers) && servers.ValueKind == JsonValueKind.Object)
        {
            var sqlServers = servers.EnumerateObject()
                .Where(s => s.Name.Contains("sql", StringComparison.OrdinalIgnoreCase)
                            || s.Value.GetRawText().Contains("sql", StringComparison.OrdinalIgnoreCase))
                .Select(s => s.Name)
                .ToList();
            if (sqlServers.Count > 0)
            {
                return $"configured in .mcp.json ({string.Join(", ", sqlServers)}); their tools are named mcp__<server>__*.";
            }
        }
    }
    catch (JsonException)
    {
        return ".mcp.json is not valid JSON — check it.";
    }

    return "no SQL Server entry in .mcp.json — fall back to read-only sqlcmd queries.";
}
