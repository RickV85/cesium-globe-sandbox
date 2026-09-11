import { ONE_DAY_IN_MS } from '@/constants';

export function getAverageFlashTime(flashes: Record<string, unknown>[]): string | null {
  if (!flashes || !flashes.length) return null;
  const totals = flashes.reduce(
    (result: { totalMs: number; validCount: number }, flash) => {
      const flashIsoString = flash.flash_time;
      if (!flashIsoString || typeof flashIsoString !== 'string') return result;

      const flashMidnightEpoch = new Date(flashIsoString.slice(0, 10)).getTime();
      if (Number.isNaN(flashMidnightEpoch)) return result;

      const flashTimeEpoch = Date.parse(flashIsoString);
      if (!flashMidnightEpoch || !flashTimeEpoch || flashTimeEpoch < flashMidnightEpoch) return result;
      const timeOfDayInMs = flashTimeEpoch - flashMidnightEpoch;
      if (timeOfDayInMs < 0) return result;

      result.totalMs += timeOfDayInMs;
      result.validCount++;
      return result;
    },
    {
      totalMs: 0,
      validCount: 0,
    },
  );

  const averageTimeOfDayMs = totals.totalMs / totals.validCount;
  if (averageTimeOfDayMs > 0 && averageTimeOfDayMs <= ONE_DAY_IN_MS) {
    // MS are floored by ignoring them below, precision not needed at that level
    const resultDate = new Date(averageTimeOfDayMs);
    const seconds = resultDate.getUTCSeconds();
    const roundUpMinutes = seconds < 30 ? 0 : 1;
    const hours = String(resultDate.getUTCHours()).padStart(2, '0');
    const minutes = String(resultDate.getUTCMinutes() + roundUpMinutes).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  return null;
}
