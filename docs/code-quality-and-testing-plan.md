# Code Quality And Testing Plan

## Goal

Keep improving maintainability and add meaningful regression protection without disrupting current behavior.

This document reflects the current codebase, not the earlier baseline. Several structural improvements have already landed, so the remaining work is now mostly about testing, finishing a few extractions, and tightening module boundaries.

## Current State

### Completed Since The Original Plan

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
- Storage has already been split out of the old monolithic `src/lib/storage.ts` into:
  - `src/lib/storage/backend.ts`
  - `src/lib/storage/settings.ts`
  - `src/lib/storage/preferences.ts`
  - `src/lib/storage/focusItems.ts`
  - `src/lib/storage/notes.ts`
  - `src/lib/storage/defaults.ts`
  - `src/lib/storage/keys.ts`
  - `src/lib/storage/types.ts`

### Still Missing

- There is still no unit test harness in the repo.
- `package.json` has no `test` script and no Vitest or Testing Library dependencies.
- `README.md` does not document any test workflow.
- Some modules are still large enough that they remain expensive to reason about and test:
  - `src/components/GitHubCard.tsx`
  - `src/pages/DashboardPage.tsx`
  - `src/hooks/useTodayFocusState.ts`
  - `src/hooks/useGitHubDashboard.ts`
  - `src/hooks/useJiraDashboard.ts`
- Some pure helper logic still lives inside component and hook files instead of dedicated library modules.

## Main Remaining Problems

### 1. Testing infrastructure has not started

The earlier extraction work created good test targets, but the repo still cannot run unit tests.

### 2. Large modules still mix rendering and view-specific behavior

The biggest remaining hotspot is `src/components/GitHubCard.tsx`. It still owns:

- list shaping and filtering
- summary metric calculation
- notification highlighting logic
- persistent PR ready and warning state orchestration
- notification PR resolution behavior
- rendering for multiple views

`src/pages/DashboardPage.tsx` is also still large and includes alert composition and integration-specific dashboard framing that could be easier to verify if extracted.

### 3. Today focus behavior is only partially modularized

`src/lib/todayFocusSync.ts` now holds important reconciliation rules, but `src/hooks/useTodayFocusState.ts` still contains a large amount of pure manipulation logic:

- add/remove behavior
- nesting rules
- reorder logic
- duplicate detection
- default item seeding
- PR-to-Jira grouping behavior

That logic is testable in principle, but it is still embedded in a hook file.

### 4. API and hook modules still combine fetch behavior with transformation logic

`src/lib/githubApi.ts`, `src/lib/jiraApi.ts`, `src/hooks/useGitHubDashboard.ts`, and `src/hooks/useJiraDashboard.ts` still contain logic that would be easier to test if more normalization and state-transition helpers were extracted into pure modules.

## Guiding Principles

- Prefer finishing testability work over starting another broad refactor.
- Extract pure helpers before adding component-heavy tests.
- Keep production behavior stable while shrinking large modules.
- Add tests around existing boundaries before introducing new abstractions.
- Update this document as phases are completed so it stays status-aware.

## Status By Original Phase

### Phase 1: Establish Test Foundations

Status: not started

Missing:

- `vitest`
- `@testing-library/react`
- `@testing-library/jest-dom`
- `jsdom`
- test scripts in `package.json`
- test setup file
- test documentation

### Phase 2: Extract Pure Domain Logic

Status: mostly complete

Completed:

- GitHub domain rules extracted to `src/lib/githubDomain.ts`
- Jira domain rules extracted to `src/lib/jiraDomain.ts`
- dashboard hash parsing/building extracted to `src/lib/dashboardRouting.ts`
- today focus reconciliation extracted to `src/lib/todayFocusSync.ts`

Still missing:

- move remaining pure list and metric helpers out of `src/components/GitHubCard.tsx`
- move remaining pure alert helpers out of `src/pages/DashboardPage.tsx` if we want them directly unit-tested
- extract pure Today focus mutation helpers out of `src/hooks/useTodayFocusState.ts`

### Phase 3: Add First Unit Tests

Status: not started

Good first targets already exist:

- `src/lib/dashboardRouting.ts`
- `src/lib/todayFocusSync.ts`
- `src/lib/githubDomain.ts`
- `src/lib/jiraDomain.ts`
- storage normalization helpers in `src/lib/storage/*`

### Phase 4: Split Storage Responsibilities

Status: largely complete

Completed:

- storage backend abstraction exists
- settings logic is split out
- navigation and GitHub preference state are split into `preferences.ts`
- today focus persistence is split into `focusItems.ts`
- notes persistence is split into `notes.ts`
- types/defaults/keys are split into dedicated modules

Still missing or worth reconsidering:

- if GitHub state keeps growing, `preferences.ts` may still be too broad and could be split again by concern
- storage normalization helpers currently remain private to their modules and have no direct tests yet

### Phase 5: Extract App-Level Hooks

Status: mostly complete

Completed:

- `useGitHubDashboard`
- `useJiraDashboard`
- `useGitHubMockMode`
- `useDashboardNavigation`
- `useTodayFocusState`
- `useTodayFocusFallbacks`

Still missing:

- some hook internals are still large and may need second-level helper extraction
- the hooks exist, but they are not yet backed by tests

## Revised Next Phases

## Phase A: Add The Test Harness

### Deliverables

- add `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, and `jsdom`
- add `test` and `test:watch` scripts to `package.json`
- add a shared test setup file
- document test commands in `README.md`

### Expected Outcome

The repo can run unit tests locally and in CI once CI is added.

## Phase B: Cover Existing Pure Modules First

### First Test Targets

- `src/lib/dashboardRouting.ts`
  - parse valid hash states
  - reject invalid hash states
  - build route hashes correctly
  - keep defaults when params are missing
- `src/lib/todayFocusSync.ts`
  - Jira reconciliation
  - GitHub reconciliation
  - terminal PR state behavior
  - missing Jira and PR detection
- `src/lib/githubDomain.ts`
  - ready-to-merge rules
  - warning-state transitions
  - focus status labels and tones
  - Jira key extraction
- `src/lib/jiraDomain.ts`
  - in-progress rules
  - high-priority rules
  - focus tone decisions
  - tooltip formatting
- `src/lib/storage/*`
  - settings normalization
  - focus item migration and normalization
  - preference fallback/default behavior

### Expected Outcome

The app gains regression coverage around the rules that are already cleanly extracted.

## Phase C: Extract Remaining Pure Helpers From Large UI And Hook Files

### Candidate Extractions

- from `src/components/GitHubCard.tsx`
  - PR list filtering and sorting helpers
  - summary metric calculation
  - notification grouping/count helpers
  - view-model shaping helpers
- from `src/hooks/useTodayFocusState.ts`
  - add/remove helpers
  - nesting and reorder helpers
  - grouping and duplicate detection helpers
- from `src/pages/DashboardPage.tsx`
  - dashboard alert derivation
  - review alert detail formatting

### Expected Outcome

The largest files lose non-UI logic and become easier to test with smaller, targeted unit tests.

## Phase D: Add Hook And Component-Level Tests Only Where They Pay Off

### Candidate Targets

- `useDashboardNavigation`
- `useGitHubMockMode`
- `useTodayFocusState`
- `SettingsPage` save and validation flows
- focused rendering tests for `GitHubCard` and `JiraCard` only after more helper extraction

### Expected Outcome

Behavior with real user impact gets covered without making the test suite brittle.

## Priority Order

1. Add the test harness.
2. Test the already-extracted pure modules.
3. Extract the remaining pure helpers from `GitHubCard`, `DashboardPage`, and `useTodayFocusState`.
4. Add hook and selective component tests.

## Definition Of Done For This Plan

This plan is in good shape when:

- local unit tests are part of normal development
- core GitHub, Jira, routing, storage, and Today focus rules are covered by unit tests
- the remaining very large files have had their pure logic reduced further
- this document no longer describes already-completed refactors as future work
