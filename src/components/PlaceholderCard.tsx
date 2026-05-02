import { CardShell } from './CardShell';
import { SectionHeading } from './SectionHeading';

type PlaceholderCardProps = {
  title: string;
  subtitle: string;
  description: string;
  className?: string;
};

export function PlaceholderCard({
  title,
  subtitle,
  description,
  className = ''
}: PlaceholderCardProps) {
  return (
    <CardShell className={className}>
      <SectionHeading eyebrow={subtitle} title={title} description={description} />

      <div className="flex min-h-[140px] items-end rounded-[14px] bg-[var(--card-bg-soft)] p-4">
        <p className="max-w-sm text-sm leading-6 text-secondary">
          Ready for future integration. The component boundary is already in place.
        </p>
      </div>
    </CardShell>
  );
}
