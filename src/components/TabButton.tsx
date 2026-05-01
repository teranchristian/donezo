type TabButtonProps = {
  label: string;
  value: string;
  isActive: boolean;
  onClick: () => void;
  title?: string;
};

export function TabButton({ label, value, isActive, onClick, title }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`min-w-0 max-w-full rounded-full border px-3 py-2 text-xs transition ${
        isActive
          ? 'border-white/20 bg-white/10 text-stone-100'
          : 'border-white/8 bg-black/10 text-stone-400 hover:border-white/15 hover:bg-black/20 hover:text-stone-200'
      }`}
    >
      <span className="font-medium">{label}</span>
      <span className={`ml-1 ${isActive ? 'text-stone-200' : 'text-stone-500'}`}>({value})</span>
    </button>
  );
}
