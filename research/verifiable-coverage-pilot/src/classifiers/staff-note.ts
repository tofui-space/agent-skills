export function mentionsStaff(note: string): boolean {
  return /\bstaff\b/i.test(note)
}
