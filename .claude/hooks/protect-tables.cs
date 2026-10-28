// PreToolUse hook: blocks commands that would delete the application's important tables or database.
// Covers shell commands (Bash/PowerShell) and MCP tool calls (e.g. a SQL Server MCP "execute query" tool).
// Exit code 2 blocks the tool call and shows stderr to Claude; exit 0 allows it.
// Built once per session by a SessionStart hook, then run per tool call as `dotnet .../protect-tables.dll`
// (avoids `dotnet run`'s per-call build check). Edits here take effect from the next session.
// Regression checks: bash .claude/hooks/test-protect-tables.sh

using System.Text.Json;
using System.Text.RegularExpressions;

string[] protectedTables =
[
    "Items", "Locations", "StockLevels", "StockMovements", "Orders", "OrderLines", "Users", "__EFMigrationsHistory",
];

string input;
string toolName;
string payload;
try
{
    input = Console.In.ReadToEnd();
    using var doc = JsonDocument.Parse(input);
    var root = doc.RootElement;
    toolName = root.TryGetProperty("tool_name", out var t) ? t.GetString() ?? "" : "";
    if (!root.TryGetProperty("tool_input", out var toolInput))
    {
        return 0;
    }

    // Shell tools carry the command string; for MCP tools scan every string value (query, sql, statement, ...).
    payload = toolInput.TryGetProperty("command", out var cmd) && cmd.ValueKind == JsonValueKind.String
        ? cmd.GetString() ?? ""
        : string.Join("\n", StringValues(toolInput));
}
catch (JsonException)
{
    Console.Error.WriteLine("protect-tables hook: could not parse hook input; allowing the call.");
    return 0;
}

// Optional schema/database prefixes and [..], "..", `..` quoting: dbo.Items, [dbo].[Items], WarehouseInventory.dbo.Items
const string Quoted = @"[\[""`]?";
const string QuotedEnd = @"[\]""`]?";
var tableAlternation = string.Join("|", protectedTables.Select(Regex.Escape));
var tableRef = $@"(?:{Quoted}\w+{QuotedEnd}\.){{0,2}}{Quoted}(?<table>{tableAlternation}){QuotedEnd}(?![\w])";
const RegexOptions Options = RegexOptions.IgnoreCase | RegexOptions.CultureInvariant;

(string Rule, Regex Pattern)[] rules =
[
    ("DROP TABLE on a protected table", new Regex($@"\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:[^;]*?,\s*)?{tableRef}", Options)),
    ("TRUNCATE TABLE on a protected table", new Regex($@"\bTRUNCATE\s+TABLE\s+{tableRef}", Options)),
    ("DELETE without a WHERE clause on a protected table", new Regex($@"\bDELETE\s+(?:TOP\s*\(\s*\d+\s*\)\s+)?(?:FROM\s+)?{tableRef}(?![^;]*\bWHERE\b)", Options)),
    ("EF Core migration that drops a protected table", new Regex($@"DropTable\s*\(\s*(?:name\s*:\s*)?""(?<table>{tableAlternation})""", Options)),
    ("dropping the application database", new Regex(@"\bDROP\s+DATABASE\s+[\[""`]?WarehouseInventory[\]""`]?(?![\w])", Options)),
    ("dotnet ef database drop (drops the whole database)", new Regex(@"\bdotnet\s+ef\s+database\s+drop\b", Options)),
];

foreach (var (rule, pattern) in rules)
{
    var match = pattern.Match(payload);
    if (!match.Success)
    {
        continue;
    }

    var table = match.Groups["table"].Success ? $" '{match.Groups["table"].Value}'" : string.Empty;
    Console.Error.WriteLine(
        $"Blocked by protect-tables hook ({toolName}): {rule}{table}. " +
        "Important warehouse tables and the WarehouseInventory database must not be deleted. " +
        "Use a filtered DELETE ... WHERE, an EF Core migration that preserves data, or ask the user to run it manually if it is truly intended.");
    return 2;
}

return 0;

static IEnumerable<string> StringValues(JsonElement element)
{
    switch (element.ValueKind)
    {
        case JsonValueKind.String:
            yield return element.GetString() ?? "";
            break;
        case JsonValueKind.Object:
            foreach (var property in element.EnumerateObject())
            {
                foreach (var value in StringValues(property.Value))
                {
                    yield return value;
                }
            }
            break;
        case JsonValueKind.Array:
            foreach (var item in element.EnumerateArray())
            {
                foreach (var value in StringValues(item))
                {
                    yield return value;
                }
            }
            break;
    }
}
