# React Frontend Standards

## React

- Use React as the frontend framework.
- Follow the existing React structure and conventions in the project.
- Use functional components and hooks where consistent with the existing codebase.
- Do not migrate the frontend to another framework.
- Do not introduce unnecessary frontend libraries.

## Components

- Keep components small and focused.
- Reuse existing components before creating duplicates.
- Separate reusable UI components from feature-specific components.
- Avoid placing large amounts of business logic inside components.
- Extract reusable logic into hooks, utilities, or services where appropriate.

## State Management

- Follow the state-management approach already used by the project.
- Do not introduce a new state-management library without a clear requirement.
- Keep state as local as practical.
- Avoid unnecessary duplicated state.

## API Integration

- Keep API communication separate from presentation logic where practical.
- Use the project's existing API service/client pattern.
- Do not duplicate backend business logic in the frontend.
- Handle:
  - loading states
  - success states
  - empty states
  - error states
- Display useful feedback when API requests fail.

## Forms and Validation

- Validate required fields on the frontend for immediate feedback.
- Backend validation remains authoritative.
- Display clear validation messages.
- Do not unnecessarily duplicate complex backend business rules.
- Preserve user input when validation fails where practical.

## UI Consistency

- Reuse existing styles and UI patterns.
- Keep typography, spacing, buttons, forms, cards, and filters consistent.
- Do not introduce visually inconsistent components unnecessarily.

## Accessibility

- Use semantic HTML.
- Provide meaningful labels for form controls.
- Ensure buttons and controls are keyboard accessible.
- Provide accessible names where required.
- Do not rely only on color to communicate status.

## Responsive Design

- Keep important todo items usable on desktop and smaller screens.
- Avoid unnecessary fixed dimensions that break responsive layouts.

## Code Quality

- Use meaningful component, variable, function, and file names.
- Remove debugging statements before completion.
- Do not change unrelated frontend functionality.