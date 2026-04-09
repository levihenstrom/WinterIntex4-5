/**
 * Canonical program areas aligned with Lighthouse seed data (`donation_allocations.program_area`)
 * and reporting groupings. "General" covers allocations without a specific program line.
 */
export const ALLOCATION_PROGRAM_AREA_PRESETS = [
  'Education',
  'General',
  'Maintenance',
  'Operations',
  'Outreach',
  'Transport',
  'Wellbeing',
] as const;

/** Presets plus any values already stored (edit legacy rows, imports). */
export function mergeAllocationProgramAreas(
  extras: Iterable<string | null | undefined>,
): string[] {
  const set = new Set<string>(ALLOCATION_PROGRAM_AREA_PRESETS);
  for (const x of extras) {
    const t = x?.trim();
    if (t) set.add(t);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
