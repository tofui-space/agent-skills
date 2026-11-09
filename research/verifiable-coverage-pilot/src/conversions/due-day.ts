export function dueDayOf(dueAt: Date): number {
  return Math.floor(dueAt.getTime() / 86_400_000)
}
