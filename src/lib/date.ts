const DATE_FORMATTER = new Intl.DateTimeFormat('en-AU', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric'
});

export function getGreeting(date = new Date()) {
  const hour = date.getHours();

  if (hour < 12) {
    return 'Good morning';
  }

  if (hour < 18) {
    return 'Good afternoon';
  }

  return 'Good evening';
}

export function formatFullDate(date: Date) {
  return DATE_FORMATTER.format(date);
}

export function formatRelativeTime(dateString: string) {
  const timestamp = new Date(dateString).getTime();
  const diffMs = Date.now() - timestamp;

  if (!Number.isFinite(timestamp) || diffMs < 0) {
    return new Date(dateString).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return new Date(dateString).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
