type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
};

export function SectionHeading({ eyebrow, title, description }: SectionHeadingProps) {
  return (
    <div className="mb-5">
      <p className="text-[0.7rem] uppercase tracking-[0.28em] text-textSoft">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-medium text-stone-100">{title}</h2>
      {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-400">{description}</p> : null}
    </div>
  );
}
