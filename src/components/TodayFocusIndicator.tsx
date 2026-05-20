type FocusTargetIconProps = {
  className?: string;
};

type TodayFocusIndicatorProps = {
  className?: string;
  rank?: number;
  totalRanks?: number;
};

const FOCUS_INDICATOR_HUE = 254;
const FOCUS_INDICATOR_SATURATION = 52;
const FOCUS_INDICATOR_TOP_LIGHTNESS = 72;
const FOCUS_INDICATOR_BOTTOM_LIGHTNESS = 54;

export function FocusTargetIcon({ className = 'h-5 w-5' }: FocusTargetIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9">
      <circle cx="12" cy="12" r="6.6" />
      <circle cx="12" cy="12" r="1.8" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2" strokeLinecap="round" />
    </svg>
  );
}

export function TodayFocusIndicator({
  className = '',
  rank,
  totalRanks,
}: TodayFocusIndicatorProps) {
  const label = typeof rank === 'number' ? `Focus #${rank}` : 'Focus';
  const title =
    typeof rank === 'number' ? `Today Focus priority ${rank}` : 'Today Focus';
  const color = getTodayFocusIndicatorColor(rank, totalRanks);

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 text-[0.66rem] font-medium leading-4 ${className}`.trim()}
      style={{ color }}
      title={title}
      aria-label={title}
    >
      <FocusTargetIcon className="h-[0.72rem] w-[0.72rem] shrink-0 opacity-75" />
      <span>{label}</span>
    </span>
  );
}

export function getTodayFocusIndicatorColor(rank?: number, totalRanks?: number) {
  if (typeof rank !== 'number') {
    return `hsl(${FOCUS_INDICATOR_HUE} ${FOCUS_INDICATOR_SATURATION}% 68%)`;
  }

  const normalizedTotalRanks =
    typeof totalRanks === 'number' && totalRanks > 1 ? totalRanks : rank;
  const progress =
    normalizedTotalRanks > 1
      ? (rank - 1) / (normalizedTotalRanks - 1)
      : 0;
  const lightness =
    FOCUS_INDICATOR_TOP_LIGHTNESS -
    (FOCUS_INDICATOR_TOP_LIGHTNESS - FOCUS_INDICATOR_BOTTOM_LIGHTNESS) *
      clamp(progress, 0, 1);

  return `hsl(${FOCUS_INDICATOR_HUE} ${FOCUS_INDICATOR_SATURATION}% ${lightness}%)`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
