# GitHub Polling Optimization Plan

## Goal

Reduce steady-state GitHub API cost during the 60-second background poll without regressing dashboard freshness.

## Current State

- Initial/manual refresh does:
  - `GET /notifications` for all needed pages
  - one GraphQL query for pull requests
  - one GraphQL query for notification PR author enrichment
- The 60-second poll now does:
  - `GET /notifications` for all needed pages
  - one GraphQL query for pull requests
- The old duplicate `poll -> full refresh` path has already been removed.
- The old unstable signal comparison bug has already been fixed.

## Problem

The poll path is now correct, but it still fetches more data than necessary when nothing changes.

This matters more when:

- notifications span multiple pages
- the PR poll query requests fields that are only needed for rendering, not change detection
- the extension stays open for long periods

## Proposed Follow-Up

### 1. Split poll queries from full refresh queries

Use a lighter poll query for pull requests that only requests fields needed for change detection.

Candidate PR poll fields:

- `url`
- `updatedAt`
- `reviewDecision`
- `isDraft`
- CI rollup state
- merge state / merge queue state only if they are part of refresh sensitivity

Keep the richer query for full refresh/manual refresh.

### 2. Make notification polling shallow first

During the 60-second poll:

- fetch only notification page 1 first
- compare the newest notification signals from page 1 against cached signals
- stop if page 1 is unchanged

Only fetch deeper notification pages when page 1 indicates a likely change.

This preserves fast detection for new or recently updated notifications while avoiding repeated full pagination scans.

### 3. Keep full refresh behavior unchanged

Manual refresh and initial full refresh should still load the complete dashboard payload so the UI remains exact.

## Suggested Implementation Order

1. Extract a dedicated GraphQL query for PR polling.
2. Split notification fetch into:
   - shallow poll fetch
   - full dashboard fetch
3. Reuse the existing signal comparison on the shallow poll results.
4. If shallow poll detects a change, either:
   - do the deeper notification fetch, or
   - continue building full dashboard data from the poll path if enough data is already available.

## Notes

- Signal comparison must stay explicit and in sync with the signal shape.
- If new signal fields are introduced later, the comparison contract should continue to fail loudly until updated.
- `README.md` should stay user-facing; engineering follow-ups like this belong under `docs/`.
