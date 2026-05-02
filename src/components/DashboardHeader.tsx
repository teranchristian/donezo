import { getGreeting } from '../lib/date';

type DashboardHeaderProps = {
  name: string;
};

export function DashboardHeader({ name: _name }: DashboardHeaderProps) {
  return (
    <header>
      <p className="text-[2rem] font-semibold tracking-[-0.04em] text-primary sm:text-[2.35rem]">
        {getGreeting()},
      </p>
    </header>
  );
}
