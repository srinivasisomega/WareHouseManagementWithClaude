# .NET Backend Standards

## C# Standards

- Follow standard C# naming and formatting conventions.
- Use strong typing.
- Use appropriate access modifiers.
- Keep methods focused on a single responsibility.
- Prefer simple and readable implementations.
- Use async/await for I/O-bound operations where appropriate.

## API Standards

- Keep API endpoints/controllers thin.
- Put business logic in the appropriate service/domain layer.
- Use DTOs for API contracts where appropriate.
- Validate all incoming API data before processing.
- Return appropriate HTTP status codes.
- Use consistent request and response structures.
- Return clear and consistent API error responses.
- Do not expose stack traces or internal exception details to clients.

## Dependency Management

- Use dependency injection for services and dependencies.
- Do not manually construct dependencies throughout the application.
- Reuse existing services and utilities where possible.
- Do not add NuGet packages unless they are clearly required.

## SQLSERVER / Data Access

- Use the existing SQLSERVER data-access pattern used by the project.
- Keep persistence logic outside controllers.
- Use parameterized queries or the project's ORM/data-access abstraction.
- Never build SQL using untrusted user input.
- Preserve existing data when applying schema changes.
- Use migrations when the existing project uses migrations.
- Avoid unnecessary database calls.
- Use asynchronous database operations where supported and appropriate.
- Use Entity Framework core

## Configuration

- Keep configuration outside source code.
- Do not hard-code connection strings containing credentials or environment-specific secrets.
- Use appsettings, environment variables, or the project's established configuration mechanism.

## Error Handling

- Handle expected exceptions appropriately.
- Do not silently ignore failures.
- Log useful diagnostic information without exposing sensitive data.

## Verification

- Add unit tests for business logic.
- Add integration tests for important API/database behavior.
- Run relevant backend tests after changes.
- Do not modify unrelated production code.