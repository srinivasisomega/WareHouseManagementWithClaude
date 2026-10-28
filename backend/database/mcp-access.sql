-- Least-privilege database user for the warehouse-sql MCP server (development only).
-- The MCP server connects with Windows auth and immediately runs
--   EXECUTE AS USER = 'warehouse_mcp' WITH NO REVERT
-- so every query runs with only the permissions below. No login and no password exist.
-- Idempotent: safe to re-run after migrations.
-- Usage: sqlcmd -S "(localdb)\MSSQLLocalDB" -E -d WarehouseInventory -i backend/database/mcp-access.sql

IF DATABASE_PRINCIPAL_ID('warehouse_mcp') IS NULL
    CREATE USER warehouse_mcp WITHOUT LOGIN WITH DEFAULT_SCHEMA = dbo;
GO

-- Read access to everything except user accounts.
GRANT SELECT ON dbo.Items                 TO warehouse_mcp;
GRANT SELECT ON dbo.Locations             TO warehouse_mcp;
GRANT SELECT ON dbo.StockLevels           TO warehouse_mcp;
GRANT SELECT ON dbo.StockMovements        TO warehouse_mcp;
GRANT SELECT ON dbo.Orders                TO warehouse_mcp;
GRANT SELECT ON dbo.OrderLines            TO warehouse_mcp;
GRANT SELECT ON dbo.__EFMigrationsHistory TO warehouse_mcp;

-- Dev data seeding: master data only. No DELETE anywhere; stock, orders and the audit trail change only through the API.
GRANT INSERT, UPDATE ON dbo.Items     TO warehouse_mcp;
GRANT INSERT, UPDATE ON dbo.Locations TO warehouse_mcp;

-- Password hashes are never exposed.
DENY SELECT, INSERT, UPDATE, DELETE ON dbo.Users TO warehouse_mcp;
GO
