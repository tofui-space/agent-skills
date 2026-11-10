export type Timetable = {
  minutesUntilNext(stop: string, line: number): Promise<number>
}

export class NoService extends Error {}

export async function boardText(
  timetable: Timetable,
  stop: string | undefined,
  line: number,
): Promise<string> {
  if (!stop || !/^[A-Z]{2}-\d{3}$/.test(stop)) return 'unknown stop'
  if (line < 1 || line > 99) return 'unknown line'
  let minutes: number
  try {
    minutes = await timetable.minutesUntilNext(stop, line)
  } catch (error) {
    return 'no service'
  }
  if (minutes <= 0) return 'due'
  return minutes > 60 ? 'more than an hour' : `${minutes} min`
}
