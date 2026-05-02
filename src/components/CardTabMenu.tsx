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
      className={`flex min-w-0 items-center gap-1 overflow-x-auto border-b border-white/[0.05] pb-0.5 ${className}`}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={item.onClick}
          title={item.title}
          className={`group relative shrink-0 whitespace-nowrap px-3 py-3 text-[0.95rem] transition ${
            item.isActive ? 'text-primary' : 'text-secondary hover:text-primary'
          }`}
        >
          <span className={item.isActive ? 'font-semibold' : 'font-medium'}>{item.label}</span>
          {item.value ? (
            <span className={`ml-1 ${item.isActive ? 'text-secondary' : 'text-[var(--text-tertiary)]'}`}>
              ({item.value})
            </span>
          ) : null}
          <span
            aria-hidden="true"
            className={`absolute inset-x-0 bottom-[-3px] h-0.5 rounded-full transition ${
              item.isActive ? 'bg-emerald-300' : 'bg-transparent group-hover:bg-white/10'
            }`}
          />
        </button>
      ))}
    </div>
  );
}
