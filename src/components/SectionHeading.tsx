type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
};

export function SectionHeading({ eyebrow, title, description }: SectionHeadingProps) {
  return (
    <div className="mb-4">
      <p className="text-[0.72rem] uppercase tracking-[0.28em] text-[var(--text-tertiary)]">{eyebrow}</p>
      <h2 className="mt-2 text-[1.05rem] font-semibold text-primary sm:text-[1.2rem]">{title}</h2>
      {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">{description}</p> : null}
    </div>
  );
}
