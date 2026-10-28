# Testing Standards

## General

- Every new feature must include appropriate tests.
- Existing tests must continue to pass.
- Do not remove, disable, or weaken tests simply to make the test suite pass.
- Tests must verify meaningful behavior.
- Include positive, negative, validation, and important edge cases.

## .NET Backend

- Test business/service logic independently.
- Test important API endpoints.
- Test request validation.
- Test expected error cases.
- Test important SQLite/database integration behavior where appropriate.
- Verify HTTP status codes and important response structures.
- Use the testing framework already established by the project.

## React Frontend

- Test important user interactions.
- Test form behavior and validation.
- Test loading, success, empty, and error states where relevant.
- Test important API integration behavior.
- Test filters and user-visible state changes for important workflows.
- Use the frontend testing tools already established by the project.

## SQLServer

- Use an isolated test database where database tests could modify data.
- Do not run destructive tests against the normal development database.
- Ensure test data is deterministic.
- Clean up test data where appropriate.
- Test migrations/schema changes when they affect important behavior.

## Test Strategy

Prefer:

1. Many small, fast unit tests.
2. Fewer integration tests for interactions between application layers.
3. A small number of end-to-end tests for critical workflows.

## Before Completion

- Run all relevant tests.
- Fix failures introduced by the implementation.
- Report which tests were executed.
- Report any unresolved failures.
- Do not claim the feature is complete without verification.