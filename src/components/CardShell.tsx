import { PropsWithChildren } from 'react';

type CardShellProps = PropsWithChildren<{
  className?: string;
}>;

export function CardShell({ children, className = '' }: CardShellProps) {
  return (
    <section
      className={`rounded-[var(--radius-card)] bg-[var(--card-bg)] px-5 py-4 shadow-[var(--shadow-card)] backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:bg-[var(--card-bg-strong)] ${className}`}
    >
      {children}
    </section>
  );
}
