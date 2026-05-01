import { CardShell } from './CardShell';
import { SectionHeading } from './SectionHeading';

export type SummaryContent =
  | {
      type: 'segments';
      items: Array<{
        value: number;
        label: string;
      }>;
    }
  | {
      type: 'text';
      lines: string[];
    };

type SummaryCardProps = {
  summary: SummaryContent;
};

export function SummaryCard({ summary }: SummaryCardProps) {
  return (
    <CardShell className="overflow-hidden">
      <SectionHeading
        eyebrow="Day Summary"
        title="A clear start to the day"
        description="Keep the high-level picture visible before you drop into tools."
      />

      <div className="relative rounded-[24px] border border-white/5 bg-panelAlt/90 p-5 shadow-glow">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
        {summary.type === 'segments' ? (
          <div className="flex flex-col gap-1 text-sm sm:text-base">
            <div className="font-medium text-stone-200">
              <span className="summary-item whitespace-nowrap">
                <span className="font-semibold text-stone-100">{summary.items[0]?.value ?? 0}</span>{' '}
                {summary.items[0]?.label ?? ''}
              </span>
              <span className="mx-2 opacity-60">/</span>
              <span className="summary-item whitespace-nowrap">
                <span className="font-semibold text-stone-100">{summary.items[1]?.value ?? 0}</span>{' '}
                {summary.items[1]?.label ?? ''}
              </span>
            </div>

            <div className="text-stone-400">
              <span className="summary-item whitespace-nowrap">
                <span className="font-semibold text-stone-100">{summary.items[2]?.value ?? 0}</span>{' '}
                {summary.items[2]?.label ?? ''}
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 text-base leading-7 text-stone-200">
            {summary.lines.map((line) => (
              <p key={line}>{renderSummaryLine(line)}</p>
            ))}
          </div>
        )}
      </div>
    </CardShell>
  );
}

function renderSummaryLine(line: string) {
  return line.split(/(\d+)/).map((segment, index) => {
    if (/^\d+$/.test(segment)) {
      return (
        <span key={`${segment}-${index}`} className="font-semibold text-stone-100">
          {segment}
        </span>
      );
    }

    return <span key={`${segment}-${index}`}>{segment}</span>;
  });
}
