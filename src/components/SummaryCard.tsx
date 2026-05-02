import { CardShell } from './CardShell';

export type SummaryContent =
  | {
      type: 'segments';
      items: Array<{
        value: number | string;
        label: string;
        onClick?: () => void;
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
      <div className="mb-4">
        <h2 className="text-[1.05rem] font-semibold text-primary sm:text-[1.2rem]">A clear start to the day</h2>
      </div>

      <div className="rounded-[calc(var(--radius-card)-4px)] bg-[var(--card-bg-soft)] px-4 py-4">
        {summary.type === 'segments' ? (
          <div className="flex flex-col gap-1 text-sm sm:text-base">
            <div className="font-medium text-primary">
              <SummarySegment item={summary.items[0]} />
              <span className="mx-2 text-secondary">/</span>
              <SummarySegment item={summary.items[1]} />
            </div>

            <div className="text-secondary">
              <SummarySegment item={summary.items[2]} />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 text-base leading-7 text-primary">
            {summary.lines.map((line) => (
              <p key={line}>{renderSummaryLine(line)}</p>
            ))}
          </div>
        )}
      </div>
    </CardShell>
  );
}

function SummarySegment({
  item
}: {
  item?: {
    value: number | string;
    label: string;
    onClick?: () => void;
  };
}) {
  if (!item) {
    return null;
  }

  const content = (
    <>
      <span className="font-semibold text-primary">{item.value}</span> {item.label}
    </>
  );

  if (!item.onClick) {
    return <span className="summary-item whitespace-nowrap">{content}</span>;
  }

  return (
    <button
      type="button"
      onClick={item.onClick}
      className="summary-item cursor-pointer whitespace-nowrap text-left transition hover:text-primary hover:underline"
    >
      {content}
    </button>
  );
}

function renderSummaryLine(line: string) {
  return line.split(/(\d+)/).map((segment, index) => {
    if (/^\d+$/.test(segment)) {
      return (
        <span key={`${segment}-${index}`} className="font-semibold text-primary">
          {segment}
        </span>
      );
    }

    return <span key={`${segment}-${index}`}>{segment}</span>;
  });
}
