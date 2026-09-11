import { flashesSample } from '../flashesSample';
import { Flash } from '../types';
import { getAverageFlashTime } from './hiker';

test('it should return average 24HR UTC time of day for an array of flashes', () => {
  const result = getAverageFlashTime(flashesSample);
  expect(result).toBe('08:00');
});

test('it should return the time of the flash if only one flash is returned', () => {
  const result = getAverageFlashTime([flashesSample[1]]);
  expect(result).toBe('04:00');
});

test('it should correctly round to the nearest minute', () => {
  const shouldRoundDown = [
    { flash_time: '2026-08-01T00:00:00.000000Z' },
    { flash_time: '2026-08-01T00:02:59.999999Z' },
  ] as Flash[];

  const shouldRoundUp = [
    { flash_time: '2026-08-01T00:00:00.000000Z' },
    { flash_time: '2026-08-01T00:03:00.000000Z' },
  ] as Flash[];
  expect(getAverageFlashTime(shouldRoundDown)).toBe('00:01');
  expect(getAverageFlashTime(shouldRoundUp)).toBe('00:02');
});

// Sad paths

test('it should return null if there are no flashes', () => {
  expect(getAverageFlashTime([])).toBeNull();
});

test.only('it should skip flashes that are not ISO strings', () => {
  const badData1 = [
    { flash_time: '2026-08-01T00:00:00.000000Z' },
    { flash_time: 1785542459000 },
    { flash_time: undefined },
    { flash_time: null },
    { flash_time: '' },
    { flash_time: 'not an ISO string' },
    {},
    { flash_time: '2026-08-01T01:00:00.000000Z' },
  ] as Flash[];
  expect(getAverageFlashTime(badData1)).toBe('00:30');
});
