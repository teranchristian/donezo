import type { DashboardAlertItem } from '../lib/dashboardPageDomain';

export function DashboardAlerts({
  alerts,
}: {
  alerts: DashboardAlertItem[];
}) {
  const [primaryAlert, ...secondaryAlerts] = alerts;

  return (
    <div className="summary-cards-grid">
      {primaryAlert ? <DashboardAlert alert={primaryAlert} /> : null}
      {secondaryAlerts.map((alert) => (
        <DashboardAlert key={alert.title} alert={alert} />
      ))}
    </div>
  );
}

function DashboardAlert({ alert }: { alert: DashboardAlertItem }) {
  const iconWrapClass =
    alert.tone === 'amber'
      ? 'bg-amber-500/14 text-amber-300'
      : alert.tone === 'rose'
        ? 'bg-rose-500/14 text-rose-300'
        : alert.tone === 'emerald'
          ? 'bg-emerald-500/14 text-emerald-300'
          : 'bg-sky-500/14 text-sky-300';

  const content = (
    <div className="flex h-full min-h-[84px] items-center gap-2.5 rounded-[var(--radius-card)] border border-white/[0.06] bg-[rgba(255,255,255,0.028)] px-3 py-2.5 shadow-[var(--shadow-card)] backdrop-blur-[var(--card-blur)]">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconWrapClass}`}
        aria-hidden="true"
      >
        <DashboardAlertIcon tone={alert.tone} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <p className="shrink-0 text-[1.7rem] font-semibold leading-none tracking-[-0.045em] text-primary">
            {alert.value}
          </p>
          <p className="min-w-0 truncate text-[0.82rem] font-medium leading-4 text-primary">
            {alert.title}
          </p>
        </div>
        <p className="mt-0.5 text-[0.72rem] leading-4 text-secondary">
          {alert.detail}
        </p>
      </div>
    </div>
  );

  if (!alert.onClick) {
    return content;
  }

  return (
    <button
      type="button"
      onClick={alert.onClick}
      className="dashboard-summary-button text-left transition hover:translate-y-[-1px] hover:opacity-100"
    >
      {content}
    </button>
  );
}

function DashboardAlertIcon({ tone }: { tone: DashboardAlertItem['tone'] }) {
  if (tone === 'amber') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (tone === 'rose') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v5" strokeLinecap="round" />
        <circle cx="12" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (tone === 'emerald') {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <circle cx="12" cy="12" r="8" />
        <path
          d="m8.5 12 2.4 2.4L15.8 9.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="6.5" cy="6.5" r="1.6" />
      <circle cx="17.5" cy="6.5" r="1.6" />
      <circle cx="12" cy="17.5" r="1.6" />
      <path d="M8 7.4h8" strokeLinecap="round" />
      <path d="M7.4 8l3.5 7.2" strokeLinecap="round" />
      <path d="M16.6 8 13 15.2" strokeLinecap="round" />
    </svg>
  );
}
