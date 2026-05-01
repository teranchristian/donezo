import { getGreeting } from '../lib/date';

type DashboardHeaderProps = {
  name: string;
};

export function DashboardHeader({ name: _name }: DashboardHeaderProps) {
  return (
    <header>
      <p className="font-display text-4xl tracking-tight text-stone-100 sm:text-5xl">
        {getGreeting()},
      </p>
    </header>
  );
}
