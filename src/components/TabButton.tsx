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
      className={`min-w-0 max-w-full rounded-full px-3.5 py-2 text-xs transition ${
        isActive
          ? 'bg-white/10 text-primary shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
          : 'bg-white/[0.035] text-secondary hover:bg-white/[0.07] hover:text-primary'
      }`}
    >
      <span className="font-medium">{label}</span>
      <span className={`ml-1 ${isActive ? 'text-secondary' : 'text-[var(--text-tertiary)]'}`}>({value})</span>
    </button>
  );
}
