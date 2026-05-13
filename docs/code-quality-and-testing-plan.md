# Code Quality And Testing Plan

## Goal

Improve maintainability, reduce coupling in the React app, and add test coverage in a staged way without disrupting current behavior.

This plan is intentionally incremental. Each phase should leave the app buildable, reviewable, and easier to test than before.

## Current State

- The production build is currently clean.
- The app works, but several large files carry too many responsibilities.
- There is no unit test harness yet.
- Most orchestration logic lives inside React components instead of testable hooks or pure utility modules.

## Main Problems

### 1. App orchestration is concentrated in large components

The two main hotspots are:

- `src/App.tsx`
- `src/pages/DashboardPage.tsx`

These files currently mix:

- data loading
- polling
- cache sync
- storage sync
- mock mode
- navigation state
- page composition

This makes changes slower and increases the cost of testing.

### 2. Domain rules are duplicated

Some GitHub and Jira business rules are implemented inside UI components instead of shared library modules.

Examples:

- GitHub PR state and warning logic in `src/components/GitHubCard.tsx`
- Jira status and priority logic split between `src/lib/jiraApi.ts` and `src/components/JiraCard.tsx`

This creates drift risk when behavior changes in one place but not another.

### 3. Storage logic is too broad

`src/lib/storage.ts` currently includes:

- storage access
- normalization
- migrations
- type definitions
- note helpers
- settings merge logic
- focus item handling

It is a useful module, but it is carrying too much unrelated responsibility.

### 4. Testable logic is trapped inside components

Several pure functions are embedded inside large component files, which makes them harder to test directly.

Examples:

- dashboard route parsing and building
- today focus reconciliation
- GitHub filtering and sorting
- GitHub PR warning and ready-state logic
- Jira focus-item mapping

## Guiding Principles

- Keep each change small enough to review safely.
- Prefer extracting pure functions before adding component-heavy tests.
- Move business rules into shared lib modules.
- Add tests as modules become easier to isolate.
- Avoid large rewrites that combine cleanup and feature changes.

## Phase 1: Establish Test Foundations

### Goal

Set up the project so unit tests can be added immediately.

### Deliverables

- Add a unit test runner:
  - `vitest`
  - `@testing-library/react`
  - `@testing-library/jest-dom`
  - `jsdom`
- Add test scripts in `package.json`
- Add a basic test setup file
- Document the test commands in `README.md` or a dedicated testing doc if needed

### Expected Outcome

The repo can run unit tests locally before any large refactor begins.

## Phase 2: Extract Pure Domain Logic

### Goal

Move business logic out of large UI components into testable utility modules.

### Candidate Extractions

- `src/lib/githubDomain.ts`
  - PR filtering
  - PR sorting
  - PR ready-to-merge rules
  - PR warning-state rules
  - notification-to-PR identity parsing

- `src/lib/jiraDomain.ts`
  - in-progress detection
  - high-priority detection
  - focus tone decisions
  - related issue tooltip formatting

- `src/lib/focusMapping.ts`
  - Jira issue to focus item mapping
  - GitHub PR to focus item mapping
  - focus item URL helpers

### Expected Outcome

UI components become thinner and the most fragile business rules become easy to unit test.

## Phase 3: Add First Unit Tests

### Goal

Cover the modules that already have strong pure-function boundaries.

### First Test Targets

- `src/lib/dashboardRouting.ts`
  - parse valid hash states
  - reject invalid hash states
  - build route hashes correctly
  - preserve default behavior when params are missing

- `src/lib/todayFocusSync.ts`
  - Jira item reconciliation
  - GitHub item reconciliation
  - terminal PR state behavior
  - missing Jira and PR detection

- Extracted GitHub domain helpers
  - ready-to-merge rules
  - warning-state transitions
  - filter behavior
  - sort behavior

- Extracted Jira domain helpers
  - in-progress rules
  - high-priority rules
  - mapping and formatting behavior

### Expected Outcome

The codebase gains useful regression protection around the logic most likely to break during cleanup.

## Phase 4: Split Storage Responsibilities

### Goal

Reduce the size and responsibility of `src/lib/storage.ts`.

### Suggested Breakdown

- `src/lib/storage/adapter.ts`
  - `chrome.storage` vs `localStorage`

- `src/lib/storage/settings.ts`
  - settings read/write
  - settings normalization

- `src/lib/storage/navigation.ts`
  - saved GitHub/Jira active view state

- `src/lib/storage/focus.ts`
  - today focus item persistence

- `src/lib/storage/githubState.ts`
  - PR warning state
  - PR ready state
  - notification seen state
  - mock mode state

- `src/lib/storage/notes.ts`
  - notes persistence and helpers

### Expected Outcome

Storage becomes easier to reason about and easier to test in isolation.

## Phase 5: Extract App-Level Hooks

### Goal

Move orchestration out of `App.tsx` and `DashboardPage.tsx` into focused hooks.

### Candidate Hooks

- `useGitHubDashboard`
  - initial load
  - refresh
  - polling
  - owner option loading
  - cache sync

- `useJiraDashboard`
  - initial load
  - refresh
  - polling
  - connection test state

- `useGitHubMockMode`
  - stored dev mode
  - scenario selection
  - mock state application

- `useDashboardNavigation`
  - hash parsing
  - storage fallback
  - state persistence

- `useTodayFocusState`
  - load/save
  - reconciliation with Jira/GitHub data
  - fallback refresh logic

### Expected Outcome

The top-level components become much more declarative and the orchestration paths become easier to unit test.

## Phase 6: Add Hook And Component Tests

### Goal

Test the newly extracted hooks and the most important interactive UI flows.

### Candidate Coverage

- hook tests for:
  - GitHub dashboard refresh logic
  - Jira refresh logic
  - mock mode transitions
  - navigation state behavior

- component tests for:
  - settings save behavior
  - notes add/delete behavior
  - dashboard view switching
  - today focus empty and populated states

### Expected Outcome

Behavioral coverage expands beyond pure functions without jumping straight to full end-to-end tests.

## Phase 7: Prepare For End-To-End Tests

### Goal

Define stable E2E targets after the app structure is cleaner.

### Recommended E2E Scope

- settings save and reload
- GitHub mock mode enable/disable
- mock scenario switching
- today focus drag and drop
- persistence across reload
- dashboard refresh behavior

### Notes

- E2E should come after the hook and domain cleanup, not before.
- The extension runtime will likely need a dedicated E2E strategy because this is not just a normal web app.
- Chrome extension testing may require a different harness than standard Vite app E2E.

## Suggested Execution Order

1. Add test tooling.
2. Extract pure GitHub and Jira domain helpers.
3. Add unit tests for routing, today focus sync, and extracted helpers.
4. Split `storage.ts`.
5. Extract app-level hooks from `App.tsx`.
6. Extract dashboard-level hooks from `DashboardPage.tsx`.
7. Add hook and component tests.
8. Design the E2E approach for the Chrome extension runtime.

## Definition Of Done For This Cleanup Track

- Large orchestration logic is moved out of top-level components.
- Shared business rules live in pure library modules.
- Unit tests cover core domain behavior and routing behavior.
- Storage responsibilities are split into smaller modules.
- The project has a clear path to later E2E coverage.

## Immediate Next Step

Start with Phase 1 only:

- add the test stack
- add test scripts
- add one small passing test file for `dashboardRouting`

That creates a safe base for the refactor phases that follow.
