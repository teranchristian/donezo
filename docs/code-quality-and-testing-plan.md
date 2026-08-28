# Code Quality And Testing Plan

## Goal

Keep improving maintainability and add meaningful regression protection without disrupting current behavior.

This version reflects the codebase as it exists now. Earlier extractions and the initial test harness have landed, so the remaining work is no longer a broad structural rewrite. The priority is to extend meaningful regression coverage while finishing a smaller set of refactors.

## Current State

### Completed

- App-level orchestration is no longer concentrated only in `src/App.tsx`.
- The dashboard now uses focused hooks for major workflows:
  - `src/hooks/useGitHubDashboard.ts`
  - `src/hooks/useJiraDashboard.ts`
  - `src/hooks/useGitHubMockMode.ts`
  - `src/hooks/useDashboardNavigation.ts`
  - `src/hooks/useTodayFocusState.ts`
  - `src/hooks/useTodayFocusFallbacks.ts`
- Shared domain logic has already been extracted into:
  - `src/lib/githubDomain.ts`
  - `src/lib/jiraDomain.ts`
  - `src/lib/dashboardRouting.ts`
  - `src/lib/todayFocusSync.ts`
  - `src/lib/githubCardDomain.ts`
  - `src/lib/dashboardPageDomain.ts`
  - `src/lib/focusMapping.ts`
  - `src/lib/githubRepoSearchDomain.ts`
- Storage has already been split out of the old monolithic `src/lib/storage.ts` into:
  - `src/lib/storage/backend.ts`
  - `src/lib/storage/settings.ts`
  - `src/lib/storage/preferences.ts`
  - `src/lib/storage/focusItems.ts`
  - `src/lib/storage/notes.ts`
  - `src/lib/storage/defaults.ts`
  - `src/lib/storage/keys.ts`
  - `src/lib/storage/types.ts`
- Vitest is configured with `test` and `test:watch` scripts.
- GitHub Actions runs the type-check, unit tests, and production build for pull
  requests and pushes to `main`.
- Initial unit coverage protects:
  - `src/lib/dashboardRouting.ts`
  - `src/lib/githubDomain.ts`
  - `src/lib/todayFocusSync.ts`
- Chrome background requests and responses now share a typed protocol in
  `src/lib/backgroundMessages.ts` and a single message bridge in
  `src/lib/backgroundBridge.ts`.
- `README.md` documents the local test workflow.

### Still Missing

- Hook, component, and background-worker behavior is not covered yet.
- Testing Library, a DOM test environment, and a shared browser-test setup are
  not configured because the current tests only exercise pure modules.
- Several large files still mix orchestration, UI behavior, and pure helpers in ways that make them expensive to reason about and test.

## What Needs Refactor

This is the remaining code-quality work that is still worth doing.

### 1. Extract pure Today focus mutations out of the hook

`src/hooks/useTodayFocusState.ts` is still one of the clearest refactor targets.

The hook now has a reasonable public boundary, but it still contains a large block of pure logic that should move out into a dedicated library module:

- item add/remove behavior
- duplicate detection
- Jira-to-PR grouping behavior
- nesting rules
- top-level reorder logic
- nested PR reorder logic
- default item seeding

The hook should ideally keep:

- storage loading and saving
- React state and refs
- effect wiring
- command handlers that call extracted pure helpers

### 2. Split the long API modules by concern

`src/lib/githubApi.ts` and `src/lib/jiraApi.ts` are both now doing multiple jobs at once.

#### `src/lib/githubApi.ts`

It currently mixes:

- domain-facing integration calls
- cache lookup behavior
- cache token creation

Worth extracting later:

- cache helpers
- integration-specific request builders if they keep growing

#### `src/lib/jiraApi.ts`

It currently mixes:

- connection and dashboard loading
- URL and query helpers
- issue normalization
- linked-issue relationship interpretation

Worth extracting later:

- Jira normalization/link parsing helpers
- Jira URL/query helpers

The important change here is separation by concern, not just moving files from `lib/` to `services/`. A `services/` folder is reasonable for transport-facing modules, but normalization and domain helpers should not stay bundled into the same long service file.

### 3. Shrink the dashboard hooks another step

The app-level hooks were a good extraction, but some of them still combine several responsibilities.

#### `src/hooks/useGitHubDashboard.ts`

Still combines:

- initial load orchestration
- mock mode application
- cache sync from storage events
- foreground visibility sync
- settings connection test state
- refresh loading state
- debug logging

#### `src/hooks/useJiraDashboard.ts`

Still combines:

- initial load orchestration
- automatic connection verification
- cache sync from storage events
- foreground visibility sync
- refresh state transitions

These hooks do not need a large redesign, but they are good candidates for second-level extraction of pure refresh/state-transition helpers and event-sync helpers.

### 4. Keep tracking the biggest UI hotspots honestly

The remaining big files are not all equally urgent, but they should stay visible in the plan.

#### `src/components/SummaryCard.tsx`

This is now one of the biggest UI files in the repo and should be tracked explicitly.

It currently mixes:

- drag and drop behavior
- top-level reorder behavior
- nested PR reorder behavior
- nest-target validation
- focus-item rendering
- helper formatting and status logic

#### `src/components/GitHubCard.tsx`

This has already improved because a lot of shaping logic now lives in `src/lib/githubCardDomain.ts`, but it is still large and still owns:

- persistent PR ready and warning state orchestration
- notification PR resolution behavior
- multiple list and row render paths
- view-level interaction behavior

#### `src/pages/DashboardPage.tsx`

This is in better shape now that alert derivation lives in `src/lib/dashboardPageDomain.ts`. It is no longer the strongest extraction candidate, but it is still a large integration page and should be kept under review if more dashboard-specific orchestration gets added.

## Testing Setup

The pure-module test foundation is in place:

- Vitest runs in its default Node environment.
- `npm test` runs the suite once.
- `npm run test:watch` runs it in watch mode.
- CI verifies type-checking, tests, and the production build.

Add Testing Library, `@testing-library/jest-dom`, `jsdom`, and a shared setup
file only when component or hook tests become a concrete next target.

## Next Unit Tests To Add

The initial suite now covers dashboard routing, GitHub attention rules, Jira-key
mapping, and Today Focus Jira/GitHub reconciliation.

Good next targets are:

- `src/lib/jiraDomain.ts`
- storage normalization helpers in `src/lib/storage/*`
- `src/lib/githubCardDomain.ts`
- `src/lib/dashboardPageDomain.ts`

## Recommended Order

1. Extract pure Today focus mutation helpers out of `src/hooks/useTodayFocusState.ts`.
2. Add unit coverage for the extracted mutations.
3. Split `src/lib/githubApi.ts` and `src/lib/jiraApi.ts` by concern.
4. Add coverage for storage normalization and the remaining pure domain modules.
5. Reassess whether hook and component-level tests are worth adding after those extractions.

## Definition Of Done For This Plan

The test-foundation phase is complete because local unit tests are part of
normal development, CI runs them automatically, the workflow is documented,
and the first domain modules are covered. The broader plan is in good shape
when:

- additional pure modules follow with regression coverage
- `useTodayFocusState` no longer owns most of the Today focus mutation rules
- `githubApi.ts` and `jiraApi.ts` no longer mix transport, normalization, and helper concerns in one file
- the largest UI hotspots are tracked accurately in this document
