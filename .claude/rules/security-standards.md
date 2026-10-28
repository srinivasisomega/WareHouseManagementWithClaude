# Security Standards

## Secrets and Configuration

- Never hard-code passwords, API keys, tokens, secrets, or database credentials.
- Use environment variables or the project's approved configuration mechanism.
- Do not commit sensitive configuration to source control.

## Input Validation

- Validate all untrusted user input.
- Backend validation is mandatory for API requests.
- Do not rely only on frontend validation.
- Use parameterized database operations.
- Never concatenate untrusted user input into SQL.

## API Security

- Do not expose stack traces or internal implementation details to users.
- Return safe and appropriate error messages.
- Apply authentication and authorization where required by the application.
- Do not expose sensitive information in API responses.

## Database Security

- Follow least-privilege principles for SQLite/database access.
- Give tools and integrations only the permissions they require.
- Use read-only access for inspection tools such as database MCP connections when writes are unnecessary.
- Do not make destructive schema or data changes without explicit need.

## Logging

- Do not log:
  - passwords
  - tokens
  - credentials
  - sensitive user information
- Log only information required for diagnostics.

## Dependencies

- Avoid unnecessary dependencies.
- Review security-sensitive dependencies and changes when appropriate.

## Completion

- Security-sensitive changes require additional review.
- Do not weaken existing security controls to make a feature work.