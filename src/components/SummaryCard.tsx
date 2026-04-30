import { CardShell } from './CardShell';
import { SectionHeading } from './SectionHeading';

export function SummaryCard() {
  return (
    <CardShell className="overflow-hidden">
      <SectionHeading
        eyebrow="Day Summary"
        title="A clear start to the day"
        description="Keep the high-level picture visible before you drop into tools."
      />

      <div className="relative rounded-[24px] border border-white/5 bg-panelAlt/90 p-5 shadow-glow">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
        <p className="text-lg leading-8 text-stone-200">
          Today: 2 PRs open, 1 Jira ticket in progress, 3 meetings.
        </p>
      </div>
    </CardShell>
  );
}
