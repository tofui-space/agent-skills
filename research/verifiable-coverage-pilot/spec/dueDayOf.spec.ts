export const requirement =
  'The due day is the number of whole days from the start of 1970 in UTC to the due moment. A moment before 1970 counts back, so the last millisecond of 1969 is day -1. An invalid date gives no day (NaN), which the predicate that names the day must refuse.'

export function expected(dueAt: Date): number {
  return Math.floor(dueAt.getTime() / (24 * 60 * 60 * 1000))
}
