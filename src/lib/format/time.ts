/**
 * Formats a duration in seconds as zero-padded `MM:SS` using total minutes
 * (e.g. `2576` -> `"42:56"`, `4200` -> `"70:00"`).
 */
export function formatTimeTaken(
  seconds: number | null | undefined,
  emptyFallback = '—',
): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return emptyFallback;
  }

  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}
