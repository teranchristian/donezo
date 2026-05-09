type CardTabMenuItem = {
  key: string;
  label: string;
  value?: string;
  isActive: boolean;
  onClick: () => void;
  title?: string;
};

type CardTabMenuProps = {
  items: CardTabMenuItem[];
  className?: string;
};

export function CardTabMenu({ items, className = '' }: CardTabMenuProps) {
  return (
    <div
      className={`flex min-w-0 items-center gap-0.5 overflow-x-auto overflow-y-hidden border-b border-white/[0.035] pb-0 ${className}`}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={item.onClick}
          title={item.title}
          className={`group relative shrink-0 whitespace-nowrap rounded-[10px] px-3 py-2 text-[0.94rem] transition ${
            item.isActive
              ? 'text-primary'
              : 'text-secondary hover:bg-white/[0.025] hover:text-primary'
          }`}
        >
          <span className={item.isActive ? 'font-semibold' : 'font-medium'}>{item.label}</span>
          {item.value ? (
            <span
              className={`ml-1 ${item.isActive ? 'text-white/52' : 'text-[var(--text-tertiary)]'}`}
            >
              ({item.value})
            </span>
          ) : null}
          <span
            aria-hidden="true"
            className={`absolute inset-x-2 bottom-[-1px] h-0.5 rounded-full transition ${
              item.isActive ? 'bg-emerald-300/90' : 'bg-transparent group-hover:bg-white/8'
            }`}
          />
        </button>
      ))}
    </div>
  );
}
