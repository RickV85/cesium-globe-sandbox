import { flashesSample } from '../flashesSample';
import { Flash } from '../types';
import { getAverageFlashTime } from './hiker';

test('it should return average 24HR UTC time of day for an array of flashes', () => {
  const result = getAverageFlashTime(flashesSample);
  expect(result).toBe('14:00');
});

test('it should return the time of the flash if only one flash is returned', () => {
  const result = getAverageFlashTime([flashesSample[1]]);
  expect(result).toBe('10:00');
});

test('it should truncate the time, removing seconds from the average time', () => {
  const case1 = [
    { flash_time: '2026-08-01T00:00:00.000000Z' },
    { flash_time: '2026-08-01T00:03:00.000000Z' },
  ] as Flash[];

  const case2 = [
    { flash_time: '2026-08-01T00:00:00.000000Z' },
    { flash_time: '2026-08-01T00:03:59.000000Z' },
  ] as Flash[];

  expect(getAverageFlashTime(case1)).toBe('06:01');
  expect(getAverageFlashTime(case2)).toBe('06:01');
});

// Sad paths

test('it should return null if there are no flashes', () => {
  expect(getAverageFlashTime([])).toBeNull();
});

test('it should skip flashes that are not ISO strings', () => {
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
  expect(getAverageFlashTime(badData1)).toBe('06:30');
});
