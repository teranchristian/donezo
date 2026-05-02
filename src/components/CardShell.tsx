import { PropsWithChildren } from 'react';

type CardShellProps = PropsWithChildren<{
  className?: string;
}>;

export function CardShell({ children, className = '' }: CardShellProps) {
  return (
    <section
      className={`rounded-[var(--radius-card)] bg-[var(--card-bg)] px-5 py-4 shadow-[var(--shadow-card)] backdrop-blur-[var(--card-blur)] ${className}`}
    >
      {children}
    </section>
  );
}
