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
