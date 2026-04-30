import { PropsWithChildren } from 'react';

type CardShellProps = PropsWithChildren<{
  className?: string;
}>;

export function CardShell({ children, className = '' }: CardShellProps) {
  return (
    <section
      className={`rounded-[28px] border border-line bg-panel/95 p-6 shadow-panel backdrop-blur-sm ${className}`}
    >
      {children}
    </section>
  );
}
