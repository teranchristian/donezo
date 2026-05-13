import { useEffect } from 'react';
import type { GitHubSummaryMetrics } from '../components/GitHubCard';

type FaviconSize = '16x16' | '32x32';

type FaviconPaths = Record<FaviconSize, string>;

type FaviconVariant = {
  key: string;
  matches: (metrics: GitHubSummaryMetrics) => boolean;
  count: (metrics: GitHubSummaryMetrics) => number;
  paths: FaviconPaths;
};

const DEFAULT_TITLE = 'Donezo';

const DEFAULT_FAVICON_PATHS: FaviconPaths = {
  '16x16': '/icons/icon-16.png',
  '32x32': '/icons/icon-32.png'
};

const PR_READY_FAVICON_PATHS: FaviconPaths = {
  '16x16': '/icons/icon-16-pr-ready.png',
  '32x32': '/icons/icon-32-pr-ready.png'
};

const PR_WARNING_FAVICON_PATHS: FaviconPaths = {
  '16x16': '/icons/icon-16-pr-warning.png',
  '32x32': '/icons/icon-32-pr-warning.png'
};

const PR_COMMENT_FAVICON_PATHS: FaviconPaths = {
  '16x16': '/icons/icon-16-pr-comment.png',
  '32x32': '/icons/icon-32-pr-comment.png'
};

const PR_ERROR_FAVICON_PATHS: FaviconPaths = {
  '16x16': '/icons/icon-16-pr-error.png',
  '32x32': '/icons/icon-32-pr-error.png'
};

const FAVICON_VARIANTS: FaviconVariant[] = [
  {
    key: 'pr-error',
    matches: (metrics) => metrics.failedBuildBadgeCount > 0,
    count: (metrics) => metrics.failedBuildBadgeCount,
    paths: PR_ERROR_FAVICON_PATHS
  },
  {
    key: 'pr-warning',
    matches: (metrics) => metrics.highlightedWarningCount > 0,
    count: (metrics) => metrics.highlightedWarningCount,
    paths: PR_WARNING_FAVICON_PATHS
  },
  {
    key: 'pr-comment',
    matches: (metrics) => metrics.highlightedCommentCount > 0,
    count: (metrics) => metrics.highlightedCommentCount,
    paths: PR_COMMENT_FAVICON_PATHS
  },
  {
    key: 'pr-ready',
    matches: (metrics) => metrics.highlightedReadyCount > 0,
    count: (metrics) => metrics.highlightedReadyCount,
    paths: PR_READY_FAVICON_PATHS
  }
];

export function useFaviconState(metrics: GitHubSummaryMetrics) {
  useEffect(() => {
    const variant = selectFaviconVariant(metrics);
    syncFaviconVariant(variant);
    syncDocumentTitle(variant, metrics);
  }, [metrics]);
}

function selectFaviconVariant(metrics: GitHubSummaryMetrics) {
  return FAVICON_VARIANTS.find((variant) => variant.matches(metrics)) ?? {
    key: 'default',
    matches: () => true,
    count: () => 0,
    paths: DEFAULT_FAVICON_PATHS
  };
}

function syncFaviconVariant(variant: FaviconVariant) {
  updateFaviconLink('16x16', variant.paths['16x16']);
  updateFaviconLink('32x32', variant.paths['32x32']);
}

function updateFaviconLink(size: FaviconSize, href: string) {
  if (typeof document === 'undefined') {
    return;
  }

  const selector = `link[rel="icon"][sizes="${size}"]`;
  const existingLink = document.querySelector<HTMLLinkElement>(selector);

  if (existingLink) {
    existingLink.href = href;
    return;
  }

  const nextLink = document.createElement('link');
  nextLink.rel = 'icon';
  nextLink.type = 'image/png';
  nextLink.sizes = size;
  nextLink.href = href;
  document.head.append(nextLink);
}

function syncDocumentTitle(variant: FaviconVariant, metrics: GitHubSummaryMetrics) {
  if (typeof document === 'undefined') {
    return;
  }

  const count = variant.count(metrics);
  document.title = count > 0 ? `(${count}) ${DEFAULT_TITLE}` : DEFAULT_TITLE;
}
