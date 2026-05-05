type FocusTargetIconProps = {
  className?: string;
};

type TodayFocusIndicatorProps = {
  className?: string;
};

export function FocusTargetIcon({ className = 'h-5 w-5' }: FocusTargetIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9">
      <circle cx="12" cy="12" r="6.6" />
      <circle cx="12" cy="12" r="1.8" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2" strokeLinecap="round" />
    </svg>
  );
}

export function TodayFocusIndicator({ className = '' }: TodayFocusIndicatorProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 text-[0.66rem] font-medium leading-4 text-violet-300 ${className}`.trim()}
    >
      <FocusTargetIcon className="h-[0.72rem] w-[0.72rem] shrink-0" />
      <span>Focus</span>
    </span>
  );
}
