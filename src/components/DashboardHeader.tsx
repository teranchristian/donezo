import { getGreeting } from '../lib/date';

type DashboardHeaderProps = {
  name: string;
};

export function DashboardHeader({ name: _name }: DashboardHeaderProps) {
  const greeting = getGreeting();
  const trimmedName = _name.trim();

  return (
    <header>
      <div className="flex items-center gap-2 sm:gap-2">
        <img
          src="/icons/icon-48.png"
          alt=""
          aria-hidden="true"
          className="h-9 w-9 shrink-0 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.28)] sm:h-11 sm:w-11"
        />
        <p className="text-[2rem] font-semibold tracking-[-0.04em] text-primary sm:text-[2.35rem]">
          {trimmedName ? `${greeting}, ${trimmedName}` : `${greeting},`}
        </p>
      </div>
    </header>
  );
}
