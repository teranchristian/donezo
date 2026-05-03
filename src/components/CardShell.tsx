import { PropsWithChildren } from 'react';

type CardShellProps = PropsWithChildren<{
  className?: string;
}>;

export function CardShell({ children, className = '' }: CardShellProps) {
  return (
    <section
      className={`rounded-[var(--radius-card)] border border-white/[0.06] bg-[var(--card-bg)] px-4 py-3.5 shadow-[var(--shadow-card)] backdrop-blur-[var(--card-blur)] ${className}`}
    >
      {children}
    </section>
  );
}
