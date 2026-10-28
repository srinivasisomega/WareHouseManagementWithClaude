#!/usr/bin/env bash
# Regression checks for the protect-tables PreToolUse hook.
# Usage: bash .claude/hooks/test-protect-tables.sh   (expects: all PASS)
set -u
dir="$(cd "$(dirname "$0")" && pwd)"
dotnet build "$dir/protect-tables.csproj" -v q --nologo >/dev/null || { echo "build failed"; exit 1; }
dll="$dir/bin/protect-tables/Debug/net8.0/protect-tables.dll"
fails=0

check() { # expected_exit tool_name json_tool_input
  local expected=$1 tool=$2 input=$3 actual
  printf '{"hook_event_name":"PreToolUse","tool_name":"%s","tool_input":%s}' "$tool" "$input" | dotnet "$dll" 2>/dev/null
  actual=$?
  if [ "$actual" -eq "$expected" ]; then echo "PASS ($actual) $tool $input"; else echo "FAIL (got $actual, want $expected) $tool $input"; fails=$((fails+1)); fi
}

# Blocked (exit 2)
check 2 Bash       '{"command":"sqlcmd -S (localdb)\\\\MSSQLLocalDB -d WarehouseInventory -Q \"DROP TABLE dbo.Items\""}'
check 2 PowerShell '{"command":"sqlcmd -Q \"drop table if exists [dbo].[StockLevels]\""}'
check 2 Bash       '{"command":"sqlcmd -Q \"TRUNCATE TABLE Orders\""}'
check 2 Bash       '{"command":"sqlcmd -Q \"DELETE FROM dbo.StockMovements\""}'
check 2 Bash       '{"command":"sqlcmd -Q \"DELETE Users; SELECT 1\""}'
check 2 Bash       '{"command":"sqlcmd -Q \"DROP TABLE dbo.Foo, dbo.OrderLines\""}'
check 2 Bash       '{"command":"sqlcmd -Q \"DROP DATABASE [WarehouseInventory]\""}'
check 2 Bash       '{"command":"dotnet ef database drop --force"}'
check 2 mcp__sqlserver__execute_sql '{"sql":"DROP TABLE [WarehouseInventory].[dbo].[__EFMigrationsHistory]"}'
check 2 mcp__sqlserver__query '{"params":{"statements":["select 1","truncate table Locations"]}}'

# Allowed (exit 0)
check 0 Bash       '{"command":"sqlcmd -Q \"DELETE FROM dbo.Items WHERE Id = 5\""}'
check 0 Bash       '{"command":"sqlcmd -Q \"SELECT * FROM dbo.Items\""}'
check 0 Bash       '{"command":"sqlcmd -Q \"DROP TABLE dbo.ItemsArchive\""}'
check 0 Bash       '{"command":"sqlcmd -Q \"DROP DATABASE WarehouseInventory_Test_abc\""}'
check 0 Bash       '{"command":"dotnet test"}'
check 0 mcp__sqlserver__query '{"sql":"SELECT TOP 10 * FROM Orders"}'
check 0 Bash       'not-json'

echo "failures: $fails"
exit $fails
