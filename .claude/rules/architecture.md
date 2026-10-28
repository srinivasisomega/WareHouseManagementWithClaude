# Architecture Standards

## Technology Stack

- Backend: .NET / ASP.NET Core
- Frontend: React
- Database: SQLite

## Backend Architecture

- Keep controllers/endpoints thin.
- Do not place business logic directly inside controllers/endpoints.
- Separate responsibilities between:
  - API/endpoints
  - business/service logic
  - data access
  - models/DTOs
  - configuration
- Use DTOs for API request and response contracts where appropriate.
- Follow the existing .NET project structure.
- Do not introduce a different architecture unless explicitly required.

## Frontend Architecture

- Use React as the frontend technology.
- Follow the existing React component structure.
- Keep presentation logic separate from API/data-access logic where practical.
- Keep components small and focused.
- Reuse existing components before creating new ones.
- Do not place backend business rules inside React components.

## Database Architecture

- Use SQLServer as the project database.
- Keep database access separate from controllers and frontend code.
- Use the project's established .NET data-access approach consistently.
- Do not scatter raw database access throughout the application.
- Keep database configuration outside source code where appropriate.
- Use migrations/schema changes consistently with the existing project approach.

## General

- Keep frontend, backend, and persistence responsibilities clearly separated.
- Prefer simple, maintainable, modular solutions.
- Reuse existing project patterns before introducing new ones.
- New features must follow the established project architecture.
- Do not modify unrelated parts of the application.