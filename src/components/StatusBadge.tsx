type StatusBadgeProps = {
  label: string;
  className?: string;
};

export function StatusBadge({ label, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`rounded-full bg-sky-400/16 px-1.5 py-0.5 text-[0.58rem] uppercase tracking-[0.12em] text-sky-100 ${className}`.trim()}
    >
      {label}
    </span>
  );
}
