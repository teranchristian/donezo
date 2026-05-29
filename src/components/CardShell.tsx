import { ComponentPropsWithoutRef, PropsWithChildren } from 'react';

type CardShellProps = PropsWithChildren<ComponentPropsWithoutRef<'section'> & {
  className?: string;
}>;

export function CardShell({ children, className = '', ...props }: CardShellProps) {
  return (
    <section
      {...props}
      className={`rounded-[var(--radius-card)] border border-white/[0.06] bg-[var(--card-bg)] px-4 py-3.5 shadow-[var(--shadow-card)] backdrop-blur-[var(--card-blur)] ${className}`}
    >
      {children}
    </section>
  );
}
