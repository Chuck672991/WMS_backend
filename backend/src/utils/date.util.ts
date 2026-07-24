export function daysBetween(from: Date, to: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((to.getTime() - from.getTime()) / msPerDay);
}

export function isFutureDate(date: Date): boolean {
  return date.getTime() > Date.now();
}
