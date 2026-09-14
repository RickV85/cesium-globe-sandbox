import { ONE_DAY_IN_MS } from '@/constants';

export function getAverageFlashTime(flashes: Record<string, unknown>[]): string | null {
  if (!flashes || !flashes.length) return null;
  const totals = flashes.reduce(
    (result: { totalMs: number; validCount: number }, flash) => {
      if (!flash.flash_time || typeof flash.flash_time !== 'string') return result;
      // Create MDT offset ISO string with 3 digit precision (from 6 digit UTC)
      const flashIsoString = flash.flash_time.slice(0, 23) + '-0600';
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
    const hours = String(resultDate.getUTCHours()).padStart(2, '0');
    const minutes = String(resultDate.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  return null;
}
