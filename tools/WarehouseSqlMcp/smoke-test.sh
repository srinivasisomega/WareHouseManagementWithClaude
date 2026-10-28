#!/usr/bin/env bash
# Smoke test: drives the MCP server over stdio and prints each JSON-RPC response.
# Usage (from repo root): bash tools/WarehouseSqlMcp/smoke-test.sh
set -euo pipefail
dir="$(cd "$(dirname "$0")" && pwd)"
export WAREHOUSE_MCP_CONNECTION='Server=(localdb)\MSSQLLocalDB;Database=WarehouseInventory;Integrated Security=True;TrustServerCertificate=True'

call() { printf '{"jsonrpc":"2.0","id":%s,"method":"tools/call","params":{"name":"%s","arguments":%s}}\n' "$1" "$2" "$3"; }

{
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}'
  echo '{"jsonrpc":"2.0","method":"notifications/initialized"}'
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
  call 3 list_tables '{}'
  call 4 describe_table '{"table":"StockLevels"}'
  # Writes target a non-existent row so the smoke test never changes data (expect rowsAffected 0).
  call 5 execute '{"sql":"UPDATE Items SET Name = Name WHERE Id = -1"}'
  call 6 query '{"sql":"SELECT TOP 5 Id, Sku, IsActive FROM Items ORDER BY Id"}'
  call 7 query '{"sql":"SELECT Username, PasswordHash FROM Users"}'
  call 8 execute '{"sql":"UPDATE StockLevels SET Quantity = 999 WHERE Id = -1"}'
  call 9 query '{"sql":"SELECT 1; SELECT 2"}'
  call 10 execute '{"sql":"REVERT"}'
  call 11 query '{"sql":"SELECT USER_NAME() AS dbUser"}'
} | dotnet "$dir/bin/Release/net8.0/WarehouseSqlMcp.dll"
