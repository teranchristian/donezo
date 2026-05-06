import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

type HeaderMenuProps = {
  mockScenarioKey?: string | null;
  onClearMockScenario?: () => void;
};

export function HeaderMenu({ mockScenarioKey = null, onClearMockScenario }: HeaderMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-primary shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] transition hover:bg-white/10"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Open menu"
      >
        <span className="flex flex-col gap-1">
          <span className="block h-0.5 w-5 rounded-full bg-current" />
          <span className="block h-0.5 w-5 rounded-full bg-current" />
          <span className="block h-0.5 w-5 rounded-full bg-current" />
        </span>
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-14 z-20 min-w-[180px] rounded-2xl bg-panel p-2 shadow-glow">
          {mockScenarioKey ? (
            <div className="mb-1 rounded-xl bg-white/[0.03] px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.66rem] font-medium uppercase tracking-[0.14em] text-white/38">
                    Using mock data
                  </p>
                  <p className="mt-1 truncate text-sm text-primary">{mockScenarioKey}</p>
                </div>
                {onClearMockScenario ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClearMockScenario();
                      setIsOpen(false);
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/42 transition hover:bg-white/5 hover:text-white/72"
                    aria-label="Clear mock data"
                    title="Clear mock data"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M4.5 7h15" strokeLinecap="round" />
                      <path d="M9.5 3.75h5" strokeLinecap="round" />
                      <path d="M8 7v11.25c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V7" strokeLinecap="round" />
                      <path d="M10 10.25v5.5M14 10.25v5.5" strokeLinecap="round" />
                    </svg>
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          <Link
            to="/settings"
            onClick={() => setIsOpen(false)}
            className="block rounded-xl px-4 py-3 text-sm text-primary transition hover:bg-white/5"
          >
            Settings
          </Link>
        </div>
      ) : null}
    </div>
  );
}
