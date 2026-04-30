import { formatFullDate, getGreeting } from '../lib/date';

type DashboardHeaderProps = {
  name: string;
};

export function DashboardHeader({ name }: DashboardHeaderProps) {
  return (
    <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p className="font-display text-4xl tracking-tight text-stone-100 sm:text-5xl">
          {getGreeting()}, {name}
        </p>
        <p className="mt-2 text-sm uppercase tracking-[0.28em] text-textSoft">
          {formatFullDate(new Date())}
        </p>
      </div>

      <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#2d2b2b] bg-[#1b1a1f] px-4 py-2 text-sm text-stone-300 shadow-glow">
        <span className="text-base leading-none text-amber-200">•</span>
        Personal dashboard
      </div>
    </header>
  );
}
