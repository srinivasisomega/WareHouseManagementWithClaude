```markdown
---
name: create-react-feature
description: Use this skill whenever the user asks to create, add, or modify a React page, component, form, filter, route, or API integration in this project's frontend.
---

# Create React Feature Workflow

1. Inspect the existing React structure and conventions:
   - folder layout (pages/features, shared components, hooks, api)
   - routing setup and role-based route guards
   - existing API client/service pattern
   - existing styles and UI patterns
2. Identify the backend API endpoint(s) and DTO shapes the feature depends on.
   Do not invent fields; match the backend contract.
3. Add or update the API service function in the API layer (e.g. `src/api/`).
   - Use the shared API client (auth token, error parsing).
   - Never call `fetch` directly from components.
4. Reuse existing components first (form fields, status messages, tables,
   layout). Only create a new shared component if it is genuinely reusable.
5. Build the feature component(s):
   - Functional components and hooks.
   - Keep components small and focused; extract logic into hooks/utilities.
   - Do not put backend business rules in components.
6. Handle all UI states:
   - loading
   - success (with clear feedback)
   - empty
   - error (show a useful message from the API response)
7. Forms and validation:
   - Validate required fields on the frontend for immediate feedback.
   - Treat backend validation as authoritative; show server validation errors.
   - Preserve user input when validation fails.
   - Disable submit while a request is in flight.
8. Routing and access:
   - Register the route in the existing router.
   - Apply the correct role guard (Admin vs Warehouse Staff).
   - Add navigation entries only for roles that can use the page.
9. Accessibility and responsiveness:
   - Semantic HTML; every form control has a label.
   - Buttons and controls are keyboard accessible with accessible names.
   - Do not rely on color alone for status (e.g. low-stock flags need text).
   - Avoid fixed widths that break small screens.
10. Add tests using the project's existing tools (e.g. Vitest + React Testing Library):
    - important user interactions
    - form validation and submit behavior
    - loading, success, empty, and error states
    - filters and visible state changes
    - mock the API layer, not `fetch` internals
11. Run the frontend tests, lint, and type-check/build. Fix any failures you introduced.
12. Remove debugging statements and update documentation if required.

Follow the rules in `.claude/rules/frontend-standards.md`, `architecture.md`,
`security-standards.md`, and `testing-standards.md`.
Do not introduce new libraries or state-management tools without a clear requirement.
Do not modify unrelated functionality.
```

The `name` and `description` lines at the top are what Claude Code uses to decide when to load the skill, so keep the description specific to frontend tasks. Steps 3 and 10 assume the layout planned for this app: a `src/api/` service layer, Vitest, and React Testing Library. If the frontend ends up structured differently, update those lines to match.