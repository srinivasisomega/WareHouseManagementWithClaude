using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;

namespace WarehouseSqlMcp;

/// <summary>
/// The MCP tools. The statement-type checks here are a convenience to give clear errors;
/// the real boundary is the warehouse_mcp database user's permissions.
/// </summary>
internal sealed partial class SqlTools
{
    private const int MaxRows = 200;
    private const string ImpersonatedUser = "warehouse_mcp";

    private readonly string _connectionString;

    public SqlTools(string connectionString)
    {
        // NO REVERT connections cannot be safely returned to a pool.
        _connectionString = new SqlConnectionStringBuilder(connectionString) { Pooling = false }.ConnectionString;
    }

    public static JsonArray Definitions() => new(
        Tool("list_tables", "List the tables this connection can read, with row counts.", new JsonObject()),
        Tool("describe_table", "Describe a table's columns (name, type, nullability, max length).", new JsonObject
        {
            ["table"] = new JsonObject { ["type"] = "string", ["description"] = "Table name, e.g. Items or dbo.StockLevels" },
        }, "table"),
        Tool("query", $"Run one read-only SELECT (or WITH ... SELECT) statement. Returns at most {MaxRows} rows as JSON.", new JsonObject
        {
            ["sql"] = new JsonObject { ["type"] = "string", ["description"] = "A single SELECT statement" },
        }, "sql"),
        Tool("execute", "Run one INSERT or UPDATE statement (permitted on Items and Locations only). Returns rows affected.", new JsonObject
        {
            ["sql"] = new JsonObject { ["type"] = "string", ["description"] = "A single INSERT or UPDATE statement" },
        }, "sql"));

    public async Task<(string Text, bool IsError)> CallAsync(string name, JsonObject args)
    {
        try
        {
            return name switch
            {
                "list_tables" => (await ListTablesAsync(), false),
                "describe_table" => (await DescribeTableAsync(RequiredString(args, "table")), false),
                "query" => (await QueryAsync(RequiredString(args, "sql")), false),
                "execute" => (await ExecuteAsync(RequiredString(args, "sql")), false),
                _ => ($"Unknown tool '{name}'.", true),
            };
        }
        catch (ArgumentException ex)
        {
            return (ex.Message, true);
        }
        catch (SqlException ex)
        {
            // SQL errors (including permission denials) are safe and useful to show to the caller.
            return ($"SQL error {ex.Number}: {ex.Message}", true);
        }
    }

    private async Task<string> ListTablesAsync()
    {
        const string sql = """
            SELECT s.name + '.' + t.name AS [table], SUM(p.rows) AS [rows]
            FROM sys.tables t
            JOIN sys.schemas s ON s.schema_id = t.schema_id
            JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
            WHERE HAS_PERMS_BY_NAME(s.name + '.' + t.name, 'OBJECT', 'SELECT') = 1
            GROUP BY s.name, t.name
            ORDER BY t.name
            """;
        return await ReadAsJsonAsync(sql, null);
    }

    private async Task<string> DescribeTableAsync(string table)
    {
        var name = table.Contains('.') ? table[(table.LastIndexOf('.') + 1)..] : table;
        name = name.Trim('[', ']', '"');
        const string sql = """
            SELECT COLUMN_NAME AS [column], DATA_TYPE AS [type], IS_NULLABLE AS [nullable], CHARACTER_MAXIMUM_LENGTH AS [maxLength]
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @name
            ORDER BY ORDINAL_POSITION
            """;
        var json = await ReadAsJsonAsync(sql, cmd => cmd.Parameters.AddWithValue("@name", name));
        return json == "[]" ? throw new ArgumentException($"Table '{table}' not found or not readable.") : json;
    }

    private async Task<string> QueryAsync(string sql)
    {
        EnsureSingleStatement(sql);
        if (!ReadOnlyStart().IsMatch(sql))
        {
            throw new ArgumentException("The query tool accepts a single SELECT (or WITH ... SELECT) statement. Use execute for INSERT/UPDATE.");
        }

        return await ReadAsJsonAsync(sql, null);
    }

    private async Task<string> ExecuteAsync(string sql)
    {
        EnsureSingleStatement(sql);
        if (!WriteStart().IsMatch(sql))
        {
            throw new ArgumentException("The execute tool accepts a single INSERT or UPDATE statement.");
        }

        await using var connection = await OpenAsync();
        await using var command = new SqlCommand(sql, connection);
        var affected = await command.ExecuteNonQueryAsync();
        return JsonSerializer.Serialize(new { rowsAffected = affected });
    }

    private async Task<string> ReadAsJsonAsync(string sql, Action<SqlCommand>? configure)
    {
        await using var connection = await OpenAsync();
        await using var command = new SqlCommand(sql, connection);
        configure?.Invoke(command);
        await using var reader = await command.ExecuteReaderAsync();

        var rows = new JsonArray();
        var truncated = false;
        while (await reader.ReadAsync())
        {
            if (rows.Count == MaxRows)
            {
                truncated = true;
                break;
            }

            var row = new JsonObject();
            for (var i = 0; i < reader.FieldCount; i++)
            {
                row[reader.GetName(i)] = reader.IsDBNull(i) ? null : ToJson(reader.GetValue(i));
            }

            rows.Add(row);
        }

        var json = rows.ToJsonString();
        return truncated ? $"{json}\n(truncated to {MaxRows} rows — add a WHERE or TOP clause)" : json;
    }

    private async Task<SqlConnection> OpenAsync()
    {
        var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();
        await using var impersonate = new SqlCommand($"EXECUTE AS USER = '{ImpersonatedUser}' WITH NO REVERT;", connection);
        await impersonate.ExecuteNonQueryAsync();
        return connection;
    }

    private static JsonNode? ToJson(object value) => value switch
    {
        byte[] bytes => JsonValue.Create(Convert.ToBase64String(bytes)),
        DateTime dt => JsonValue.Create(dt.ToString("O")),
        _ => JsonSerializer.SerializeToNode(value),
    };

    private static void EnsureSingleStatement(string sql)
    {
        var body = sql.Trim().TrimEnd(';');
        if (body.Contains(';') || GoSeparator().IsMatch(body))
        {
            throw new ArgumentException("Send exactly one statement per call.");
        }
    }

    private static string RequiredString(JsonObject args, string key)
    {
        var value = args[key]?.GetValue<string>();
        return string.IsNullOrWhiteSpace(value) ? throw new ArgumentException($"'{key}' is required.") : value;
    }

    private static JsonObject Tool(string name, string description, JsonObject properties, params string[] required) => new()
    {
        ["name"] = name,
        ["description"] = description,
        ["inputSchema"] = new JsonObject
        {
            ["type"] = "object",
            ["properties"] = properties,
            ["required"] = new JsonArray(required.Select(r => (JsonNode)JsonValue.Create(r)!).ToArray()),
            ["additionalProperties"] = false,
        },
    };

    [GeneratedRegex(@"^\s*(SELECT|WITH)\b", RegexOptions.IgnoreCase)]
    private static partial Regex ReadOnlyStart();

    [GeneratedRegex(@"^\s*(INSERT|UPDATE)\b", RegexOptions.IgnoreCase)]
    private static partial Regex WriteStart();

    [GeneratedRegex(@"^\s*GO\s*$", RegexOptions.IgnoreCase | RegexOptions.Multiline)]
    private static partial Regex GoSeparator();
}
