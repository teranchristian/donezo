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
      <div className="mb-3 border-b border-white/5 pb-3">
        <h2 className="text-lg font-semibold text-stone-100 sm:text-xl">A clear start to the day</h2>
      </div>

      <div className="rounded-xl bg-panelAlt/40 px-4 py-3">
        {summary.type === 'segments' ? (
          <div className="flex flex-col gap-1 text-sm sm:text-base">
            <div className="font-medium text-stone-200">
              <SummarySegment item={summary.items[0]} />
              <span className="mx-2 opacity-60">/</span>
              <SummarySegment item={summary.items[1]} />
            </div>

            <div className="text-stone-400">
              <SummarySegment item={summary.items[2]} />
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
      <span className="font-semibold text-stone-100">{item.value}</span> {item.label}
    </>
  );

  if (!item.onClick) {
    return <span className="summary-item whitespace-nowrap">{content}</span>;
  }

  return (
    <button
      type="button"
      onClick={item.onClick}
      className="summary-item whitespace-nowrap text-left transition hover:text-stone-100 hover:underline cursor-pointer"
    >
      {content}
    </button>
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
