import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

export function HeaderMenu() {
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
        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-stone-200 transition hover:border-white/20 hover:bg-white/10"
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
        <div className="absolute right-0 top-14 z-20 min-w-[180px] rounded-2xl border border-white/10 bg-panel p-2 shadow-glow">
          <Link
            to="/settings"
            onClick={() => setIsOpen(false)}
            className="block rounded-xl px-4 py-3 text-sm text-stone-200 transition hover:bg-white/5"
          >
            Settings
          </Link>
        </div>
      ) : null}
    </div>
  );
}
