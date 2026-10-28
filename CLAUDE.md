# Warehouse Inventory

Inventory and fulfilment app: item/SKU master data, warehouse locations, receiving, stock moves,
pick → pack → dispatch, inventory search and low-stock alerts.

| Layer    | Tech                                                                    |
|----------|-------------------------------------------------------------------------|
| Backend  | ASP.NET Core 8 Web API, EF Core 8, SQL Server (LocalDB in development)  |
| Frontend | React 19 + TypeScript, Vite, React Router                               |
| Auth     | JWT bearer tokens, roles `Admin` and `Staff`                            |
| Tests    | xUnit (unit + integration against LocalDB), Vitest + Testing Library    |

Coding rules live in `.claude/rules/` and apply to all work.

## Roles and domain rules

| Role  | Can do |
|-------|--------|
| Admin | Maintain items/SKUs, warehouse locations and low-stock thresholds (`/admin/*`). May also use operations pages. |
| Staff | Receive stock, move stock between locations, create orders, pick, pack, dispatch, search inventory, review alerts. |

- **Low stock** = threshold > 0 and total on hand across all locations ≤ threshold. Threshold 0 disables alerts.
- **Order workflow:** `Open → Picking → Picked → Packed → Dispatched`. Picking removes stock from a chosen location; packing needs every line fully picked; dispatch needs the order packed.
- Every receipt, transfer and pick is written to an audit trail (`/api/stock/movements`).
- Items and locations are deactivated, never deleted; a location holding stock cannot be deactivated.

## Project layout

```
backend/
  src/WarehouseInventory.Api/
    Controllers/     thin HTTP endpoints
    Services/        business rules (items, locations, stock, inventory, orders, auth)
    Data/            EF Core DbContext, migrations, startup initializer, stock helpers
    Domain/          entities
    Dtos/            request/response contracts with validation attributes
    Common/          domain exceptions → ProblemDetails mapping
    Configuration/   options classes and auth policy names
  tests/WarehouseInventory.Tests/
    Unit/            service tests (EF Core InMemory)
    Integration/     HTTP tests against a throwaway LocalDB database
frontend/
  src/api/           API client + typed endpoint functions (only place that calls fetch)
  src/auth/          session storage, auth context, role guard
  src/components/    shared UI (form field, status messages, layout, ...)
  src/hooks/         data-loading / mutation hooks
  src/features/      admin/* and staff/* pages
```

## Setup

Prerequisites: .NET SDK 8, SQL Server LocalDB (or any SQL Server), Node.js 20+.

Secrets are **not** stored in source. In development they live in .NET user-secrets:

```powershell
cd backend/src/WarehouseInventory.Api
dotnet user-secrets set "Jwt:Key" "<random string of at least 32 characters>"
dotnet user-secrets set "SeedUsers:AdminPassword" "<admin password>"
dotnet user-secrets set "SeedUsers:StaffPassword" "<staff password>"
```

On first start the API applies migrations (Development only) and, if the user table is empty, creates users
`admin` and `staff` with those passwords. Other environments use env vars (`ConnectionStrings__WarehouseDb`,
`Jwt__Key`, `SeedUsers__AdminPassword`, `SeedUsers__StaffPassword`) and `dotnet ef database update`.
The dev connection string (integrated auth, no credentials) is in `appsettings.Development.json`.

## Commands

```powershell
cd backend/src/WarehouseInventory.Api; dotnet run --launch-profile http    # API http://localhost:5041, /swagger
cd frontend; npm install; npm run dev                                     # UI  http://localhost:5173, proxies /api → :5041

cd backend;  dotnet build; dotnet test        # integration tests create and drop a temp LocalDB database
cd frontend; npm test; npm run build; npm run lint
cd backend/src/WarehouseInventory.Api; dotnet ef migrations add <Name> -o Data/Migrations
```

## API

| Method | Route | Role |
|--------|-------|------|
| POST | `/api/auth/login` | anonymous (rate-limited) |
| GET | `/api/items`, `/api/items/{id}` | Staff, Admin |
| POST / PUT | `/api/items`, `/api/items/{id}`, `/api/items/{id}/threshold` | Admin |
| GET | `/api/locations`, `/api/locations/{id}` | Staff, Admin |
| POST / PUT | `/api/locations`, `/api/locations/{id}` | Admin |
| POST | `/api/stock/receipts`, `/api/stock/transfers` | Staff, Admin |
| GET | `/api/stock/movements?itemId&locationId&take` | Staff, Admin |
| GET | `/api/inventory?search&locationId&lowStockOnly`, `/api/inventory/alerts` | Staff, Admin |
| GET / POST | `/api/orders?status`, `/api/orders/{id}`, `/api/orders` | Staff, Admin |
| POST | `/api/orders/{id}/pick`, `/pack`, `/dispatch` | Staff, Admin |

Errors are RFC 7807 problem details: 400 validation (field `errors`), 401, 403, 404, 409 conflict
(duplicate SKU/location code, concurrent stock update), 422 business rule (insufficient stock, invalid status transition).

## Skills and agents — use them

- Backend endpoint/filter work → `create-api` skill.
- Frontend page/component/form/route/API work → `create-react-feature` skill.
- After frontend changes → `react-standards-reviewer` agent; for missing C# XML docs → `docstring-writer` agent.

## Hooks (`.claude/settings.json`, sources in `.claude/hooks/`)

- **SessionStart** — `session-start.cs` (run via `dotnet run`) prints a short orientation (architecture, routes, MCP status, API-vs-MCP guidance). A second SessionStart command builds `protect-tables`.
- **PreToolUse** (`Bash|PowerShell|mcp__.*`) — `protect-tables.cs` (run as the prebuilt DLL, ~0.6 s) blocks DROP/TRUNCATE of the app tables, `DELETE` without `WHERE` on them, EF `DropTable` of them, `DROP DATABASE WarehouseInventory` and `dotnet ef database drop`. Changes to the hook take effect next session. Checks: `bash .claude/hooks/test-protect-tables.sh`.

## SQL Server MCP (`.mcp.json` → `warehouse-sql`)

- In-repo server `tools/WarehouseSqlMcp` (.NET 8, stdio). Tools: `list_tables`, `describe_table`, `query` (one SELECT), `execute` (one INSERT/UPDATE).
- Connects with Windows auth, then `EXECUTE AS USER = 'warehouse_mcp' WITH NO REVERT`. Grants (`backend/database/mcp-access.sql`, re-run after migrations): SELECT on all app tables except `Users` (denied); INSERT/UPDATE on `Items` and `Locations` only; no DELETE or DDL. Change stock/orders via the API so audit rows are written.
- After editing the server: `dotnet build tools/WarehouseSqlMcp -c Release` (with the server stopped), then `bash tools/WarehouseSqlMcp/smoke-test.sh`.

## Backend conventions

- `Controllers/` are thin: bind DTO, call one service method, return status. No EF or business logic there.
- Business rules live in `Services/` (interface + implementation, registered scoped in `Program.cs`). Services use `WarehouseDbContext` via EF Core; shared stock helpers are in `Data/StockLevelExtensions.cs` (`GetOrAddStockLevelAsync`, `GetStockForRemovalAsync`, `RecordMovement`).
- Signal failures by throwing `NotFoundException` (404), `ConflictException` (409) or `BusinessRuleException` (422) from `Common/Exceptions.cs`; `GlobalExceptionHandler` turns them into ProblemDetails. Never return exception details for 500s.
- Request DTOs are classes with DataAnnotations (`[ApiController]` returns 400 automatically); responses are records.
- Every stock change goes through one `SaveChangesAsync` together with its `StockMovement` audit row. `StockLevel.RowVersion` gives optimistic concurrency (409 on conflict).
- SKU and location codes are trimmed and upper-cased (`ItemService.NormalizeCode`).
- The low-stock rule lives only in the backend (`InventoryService.IsLowStock`).
- Inject `TimeProvider` for timestamps (tests use `FixedTimeProvider`); store UTC.
- Session: the JWT is set by `POST /api/auth/login` in the `wh_auth` cookie (HttpOnly, SameSite=Strict, Secure outside plain-HTTP dev, Path=/api) and is never returned in a body. `GET /api/auth/me` restores the session; `POST /api/auth/logout` clears it. A Bearer header still works for Swagger/tooling. The frontend keeps no auth data in localStorage/sessionStorage and only redirects after login to same-app paths (`safeRedirectPath`).
- Auth: JWT with short claim names (`sub`, `name`, `role`, `MapInboundClaims = false`). Policies in `Configuration/Options.cs`: `AdminOnly` (master-data writes) and `WarehouseOperations` (Staff + Admin). Use `User.GetUsername()` for audit fields.
- Schema changes: add an EF migration; Development applies migrations on startup (`Database:ApplyMigrationsOnStartup`).

## Frontend conventions

- Only `src/api/client.ts` calls `fetch`. Add endpoint functions to `src/api/warehouseApi.ts` and types to `src/api/types.ts`, matching backend DTOs exactly.
- Load data with `useApiData(loader, key)` and render through `<AsyncContent>` (loading / error+retry / empty / data). Mutations use `useAsyncAction` (`pending`, `error`, `fieldErrors` from server validation).
- Forms: `<FormField label error hint>{(p) => <input {...p} />}</FormField>`; validate required fields client-side, show server field errors, keep input on failure, disable submit while pending.
- Pickers: `OptionSelect` with `itemOption` / `locationOption` from `src/utils/format.ts`; reference data via `useActiveItems` / `useActiveLocations`. Debounce search inputs with `useDebouncedValue`.
- Routes are in `src/App.tsx`; admin pages are wrapped in `<RequireRole roles={['Admin']}>`. Nav links are in `components/Layout.tsx`.
- Status is conveyed by text, not colour only (`StockStatus`, `OrderStatusBadge`). Reuse classes from `src/index.css`; no new UI or state libraries.
- Tests: Vitest + Testing Library next to the component (`*.test.tsx`), import from `vitest` explicitly, mock `src/api/warehouseApi` (not fetch), render with `src/test/renderWithProviders.tsx`.

## Known decisions

- `.claude/rules/architecture.md` lists SQLite under "Technology Stack", but the project uses SQL Server (as the rest of the rules and the requirements state).
- Admins may use warehouse operations pages/endpoints; tighten `AuthPolicies.WarehouseOperations` if that should be Staff-only.
