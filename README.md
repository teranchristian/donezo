# Chrome Home Page

A personal Chrome new tab dashboard built with React, TypeScript, Vite, and Tailwind CSS.

This project replaces the default Chrome new tab page with a work dashboard focused on:

- GitHub pull requests and notifications
- Jira active work
- A drag-and-drop "Today focus" area
- Quick notes stored locally

The extension is currently tailored to a personal workflow, but the code is structured around configurable local settings for GitHub and Jira.

## What It Does

When the extension is loaded in Chrome, opening a new tab shows a dashboard with:

- A greeting header
- A GitHub card with:
  - Your open PRs
  - Review-requested PRs
  - Notifications
  - Status signals such as review state, CI state, merge state, and draft state
- A Jira card with:
  - Active assigned issues
  - In Progress issues
  - Blocking issues
  - High Priority issues
- A Today focus card where you can drag Jira issues and GitHub PRs to define the top items for the day
- A Quick capture notes card for short local notes
- A Settings page for profile name and integration credentials

## How It Works

The app has two layers:

1. The React UI in `src/`
2. A Chrome extension background service worker in [`public/background.js`](/Users/xtian/dev/chrome-home-page/public/background.js)

The UI does not call GitHub or Jira directly for the main dashboard data. Instead it sends messages through `chrome.runtime.sendMessage(...)` to the background script, and the background script performs the API requests.

This matters because:

- Full GitHub and Jira integration only works when the app is running as a Chrome extension
- Plain Vite dev mode is useful for UI work, but the full message bridge is not available there

## Integrations

### GitHub

The GitHub integration uses:

- REST API calls for notifications and connection checks
- GraphQL API calls for pull request search and metadata

The dashboard fetches:

- Recent notifications from the last 7 days
- PRs authored by you
- PRs requesting your review
- Review decision state
- Merge state
- CI/check state

It also polls GitHub roughly every 60 seconds to detect activity changes and refresh the dashboard when needed.

### Jira

The Jira integration uses the Atlassian REST API with basic auth using:

- Jira base URL
- Jira account email
- Jira API token

The main Jira query currently used by the app is:

```text
assignee = currentUser() AND statusCategory != Done ORDER BY priority DESC, updated DESC
```

The dashboard also derives:

- In-progress issue counts
- Blocking relationships
- High-priority subsets
- Browse links back to Jira

Jira data is also refreshed on an interval of about 60 seconds.

## Today Focus

The "Today focus" area is a small daily planning board.

- You can drag Jira issues into it
- You can drag GitHub PRs into it
- You can nest PRs under Jira items
- The list is capped at 3 top-level items
- Jira-backed focus items are reconciled with fresh Jira data so their title/status stay up to date

This makes it possible to track a Jira task and attach the related PRs underneath it.

## Storage

Settings and dashboard-local state are stored in local browser storage.

Depending on runtime, the app uses:

- `chrome.storage.local` inside the extension
- `localStorage` as a fallback for local browser UI usage

Stored data includes:

- Name
- GitHub username, token, and owner/org filter
- Jira base URL, email, and API token
- Notes
- Today focus items
- Active tab/view selections
- Some cached dashboard data

## Token Setup

### GitHub Token

The settings page expects a GitHub Personal Access Token (classic).

Create it here:

- `https://github.com/settings/tokens`
- Choose `Tokens (classic)`

Scopes currently documented by the app:

- `repo`
- `notifications`
- `read:user`
- `read:org`

You should also enter:

- Your GitHub username
- An optional default owner/org filter

The extension validates the token from the settings page before using it.

### Jira Token

The Jira integration expects:

- Your Jira site URL, for example `https://your-company.atlassian.net`
- Your Atlassian account email
- An Atlassian API token

Create the Jira token here:

- `https://id.atlassian.com/manage-profile/security/api-tokens`

Setup flow:

1. Create an API token in Atlassian
2. Use your Jira email address
3. Use the API token, not your Atlassian password
4. Save the values in Settings
5. Test the Jira connection from the settings page

## Development

### Prerequisites

- Node.js
- npm
- Google Chrome

Install dependencies:

```bash
npm install
```

### Run in Dev Mode

Start the Vite dev server:

```bash
npm run dev
```

Important limitation:

- This runs the React app in normal browser dev mode
- The Chrome extension background runtime is not active there
- GitHub and Jira API flows that depend on `chrome.runtime.sendMessage(...)` will not fully work

Dev mode is mainly for:

- Layout work
- Styling changes
- Component development
- Non-extension local state behavior

### Dev Mode Mock Data

The dashboard also supports a stored developer mode for GitHub mock data.

How it works:

- `dev_mode=true` in the URL enables dev mode as a bootstrap step
- After that, dev mode is stored locally and no longer depends on the URL
- The active mock scenario is selected from the header menu dropdown
- The Settings page includes an `Enable dev mode` toggle

Example bootstrap URL:

```text
chrome-extension://<extension-id>/index.html#github?view=prs&dev_mode=true
```

Notes:

- `dev_mode=true` turns on dev mode, but scenario selection still happens in the menu
- Tab and filter navigation should not carry mock flags in the hash anymore
- Clearing dev mode returns the dashboard to live GitHub data
- Legacy `mock=true` and older scenario-style mock URLs may still be recognized for compatibility

## Production Build

Build the extension assets:

```bash
npm run build
```

This outputs the packaged app to `dist/`.

## Load the Extension in Chrome

After building:

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click `Load unpacked`
4. Select the `dist/` folder

Once loaded, opening a new Chrome tab should show this dashboard instead of the default new tab page.

If you make code changes:

1. Re-run `npm run build`
2. Reload the extension in `chrome://extensions`

## Project Structure

Key files:

- [`src/App.tsx`](/Users/xtian/dev/chrome-home-page/src/App.tsx): app state, loading, polling, routing
- [`src/pages/DashboardPage.tsx`](/Users/xtian/dev/chrome-home-page/src/pages/DashboardPage.tsx): main dashboard composition and today-focus behavior
- [`src/pages/SettingsPage.tsx`](/Users/xtian/dev/chrome-home-page/src/pages/SettingsPage.tsx): credentials and preferences UI
- [`src/lib/githubApi.ts`](/Users/xtian/dev/chrome-home-page/src/lib/githubApi.ts): UI-side GitHub bridge helpers
- [`src/lib/jiraApi.ts`](/Users/xtian/dev/chrome-home-page/src/lib/jiraApi.ts): UI-side Jira bridge helpers
- [`src/lib/storage.ts`](/Users/xtian/dev/chrome-home-page/src/lib/storage.ts): settings, notes, focus, and UI storage helpers
- [`src/lib/todayFocusSync.ts`](/Users/xtian/dev/chrome-home-page/src/lib/todayFocusSync.ts): focus/Jira reconciliation logic
- [`public/manifest.json`](/Users/xtian/dev/chrome-home-page/public/manifest.json): Chrome extension manifest
- [`public/background.js`](/Users/xtian/dev/chrome-home-page/public/background.js): background service worker and external API access

## Current Focus

From the current codebase, the product focus is a compact daily work cockpit:

- Centralize GitHub and Jira into one new-tab view
- Surface active PR and review work quickly
- Keep a lightweight daily focus list
- Preserve notes and dashboard preferences locally
- Refresh data automatically without turning the dashboard into a full project-management app

## Scripts

- `npm run dev` - run the Vite development server
- `npm run build` - type-check and build to `dist/`
- `npm run preview` - preview the built Vite app locally

## Notes

- The extension requests host permissions for `https://api.github.com/*` and `https://*.atlassian.net/*`
- Cached GitHub and Jira dashboard data use a short TTL of about 5 minutes
- The project currently appears to be intentionally optimized for one personal workflow rather than multi-user deployment
