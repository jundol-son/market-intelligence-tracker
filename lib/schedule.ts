const SEOUL_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
});

export function scheduledCollectionTasks(now: Date) {
  const parts = SEOUL_TIME.formatToParts(now).reduce<Record<string, string>>((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});
  const hour = Number(parts.hour === '24' ? '0' : parts.hour);
  const minute = Number(parts.minute);
  return {
    calendar: hour === 9 && minute === 0,
    keylessMacro: (hour === 9 || hour === 10) && minute === 15,
    news: hour % 6 === 0 && (minute === 0 || minute === 30),
  };
}
