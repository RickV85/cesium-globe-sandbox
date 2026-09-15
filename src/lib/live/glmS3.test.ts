import { dayOfYear, hourPrefix, hourPrefixesBetween, parseKeyTimes, parseListKeys } from './glmS3';

test('it should compute the UTC day of year, including leap years', () => {
  expect(dayOfYear(Date.UTC(2026, 0, 1))).toBe(1);
  expect(dayOfYear(Date.UTC(2026, 8, 14, 23, 59))).toBe(257);
  expect(dayOfYear(Date.UTC(2024, 11, 31, 12))).toBe(366);
});

test('it should build the hour folder for a timestamp', () => {
  expect(hourPrefix(Date.UTC(2026, 8, 14, 20, 44))).toBe('GLM-L2-LCFA/2026/257/20/');
  expect(hourPrefix(Date.UTC(2026, 0, 5, 3))).toBe('GLM-L2-LCFA/2026/005/03/');
});

test('it should list every hour folder across a year rollover', () => {
  const start = Date.UTC(2025, 11, 31, 23, 30);
  const end = Date.UTC(2026, 0, 1, 0, 10);
  expect(hourPrefixesBetween(start, end)).toEqual(['GLM-L2-LCFA/2025/365/23/', 'GLM-L2-LCFA/2026/001/00/']);
});

test('it should return a single folder when the range sits inside one hour', () => {
  const start = Date.UTC(2026, 8, 14, 20, 1);
  expect(hourPrefixesBetween(start, start + 60_000)).toEqual(['GLM-L2-LCFA/2026/257/20/']);
});

test('it should parse start and end times from a GLM key', () => {
  const key = 'GLM-L2-LCFA/2026/257/20/OR_GLM-L2-LCFA_G19_s20262572044000_e20262572044200_c20262572044220.nc';
  expect(parseKeyTimes(key)).toEqual({
    startMs: Date.UTC(2026, 8, 14, 20, 44, 0),
    endMs: Date.UTC(2026, 8, 14, 20, 44, 20),
  });
});

test('it should pull keys out of a listing', () => {
  const xml = `<?xml version="1.0"?><ListBucketResult>
    <Contents><Key>GLM-L2-LCFA/2026/257/20/a.nc</Key></Contents>
    <Contents><Key>GLM-L2-LCFA/2026/257/20/b.nc</Key></Contents>
  </ListBucketResult>`;
  expect(parseListKeys(xml)).toEqual(['GLM-L2-LCFA/2026/257/20/a.nc', 'GLM-L2-LCFA/2026/257/20/b.nc']);
});

// Sad paths

test('it should return null for keys that are not GLM file names', () => {
  expect(parseKeyTimes('GLM-L2-LCFA/2026/257/20/')).toBeNull();
});

test('it should return no keys for an empty listing', () => {
  expect(parseListKeys('<ListBucketResult><KeyCount>0</KeyCount></ListBucketResult>')).toEqual([]);
});
