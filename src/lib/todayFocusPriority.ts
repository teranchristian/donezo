import type { FocusItem } from './storage';

export type TodayFocusPullRequestRankMap = ReadonlyMap<string, number>;

export type TodayFocusPullRequestRanks = {
  ranks: TodayFocusPullRequestRankMap;
  totalRanks: number;
};

export function buildTodayFocusPullRequestRanks(
  items: FocusItem[],
): TodayFocusPullRequestRanks {
  const ranks = new Map<string, number>();

  items.forEach((item, index) => {
    const rank = index + 1;

    if (item.source === 'github') {
      setRankIfAbsent(ranks, item.id, rank);
      return;
    }

    if (item.source === 'jira') {
      item.children.forEach((child) => {
        setRankIfAbsent(ranks, child.id, rank);
      });
    }
  });

  return {
    ranks,
    totalRanks: items.length,
  };
}

function setRankIfAbsent(ranks: Map<string, number>, id: string, rank: number) {
  if (!ranks.has(id)) {
    ranks.set(id, rank);
  }
}
