import { PropsWithChildren } from 'react';

type InfoBannerProps = PropsWithChildren<{
  title: string;
  className?: string;
}>;

export function InfoBanner({ title, className = '', children }: InfoBannerProps) {
  return (
    <div
      className={`rounded-2xl border border-indigo-400/20 bg-indigo-400/10 px-4 py-4 shadow-glow ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-indigo-300/20 bg-indigo-300/10 text-indigo-100">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 10v6" />
            <path d="M12 7h.01" />
          </svg>
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-medium text-indigo-50">{title}</h3>
          <div className="mt-2 text-sm leading-6 text-indigo-100/90">{children}</div>
        </div>
      </div>
    </div>
  );
}
