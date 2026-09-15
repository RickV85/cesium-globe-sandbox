import { ONE_DAY_IN_MS } from '@/constants';

/*
 * NOAA's public GOES-19 bucket, read straight from the browser.
 *
 * The bucket answers ListObjectsV2 and GET with `Access-Control-Allow-Origin: *`,
 * so live mode needs no server of its own. GLM-L2-LCFA files land every 20 s
 * under GLM-L2-LCFA/<year>/<day-of-year>/<hour>/, named by their start (s),
 * end (e) and creation (c) times.
 */

const BUCKET_URL = 'https://noaa-goes19.s3.amazonaws.com';
const PRODUCT = 'GLM-L2-LCFA';
const ONE_HOUR_MS = 60 * 60 * 1000;

const pad = (n: number, width: number) => String(n).padStart(width, '0');

/** 1-based UTC day of the year. */
export function dayOfYear(ms: number): number {
  const year = new Date(ms).getUTCFullYear();
  return Math.floor((ms - Date.UTC(year, 0, 1)) / ONE_DAY_IN_MS) + 1;
}

export function hourPrefix(ms: number): string {
  const date = new Date(ms);
  return `${PRODUCT}/${date.getUTCFullYear()}/${pad(dayOfYear(ms), 3)}/${pad(date.getUTCHours(), 2)}/`;
}

/** Every hour folder touching [startMs, endMs], oldest first. */
export function hourPrefixesBetween(startMs: number, endMs: number): string[] {
  const prefixes: string[] = [];
  for (let t = Math.floor(startMs / ONE_HOUR_MS) * ONE_HOUR_MS; t <= endMs; t += ONE_HOUR_MS) {
    prefixes.push(hourPrefix(t));
  }
  return prefixes;
}

export type GlmKeyTimes = { startMs: number; endMs: number };

const STAMP = '(\\d{4})(\\d{3})(\\d{2})(\\d{2})(\\d{2})(\\d)';
const KEY_TIMES_RE = new RegExp(`_s${STAMP}_e${STAMP}_c\\d{14}\\.nc$`);

function stampToMs(parts: string[]): number {
  const [year, day, hour, minute, second, tenths] = parts.map(Number);
  return Date.UTC(year, 0, day, hour, minute, second, tenths * 100);
}

/** "..._s20262572044000_e20262572044200_c20262572044220.nc" -> epoch ms for s and e. */
export function parseKeyTimes(key: string): GlmKeyTimes | null {
  const match = KEY_TIMES_RE.exec(key);
  if (!match) return null;
  return { startMs: stampToMs(match.slice(1, 7)), endMs: stampToMs(match.slice(7, 13)) };
}

/**
 * Keys out of a ListObjectsV2 response. A regex rather than DOMParser, which
 * does not exist in workers. An hour folder holds 180 files and S3 returns up
 * to 1000 keys per page, so a listing is never truncated.
 */
export const parseListKeys = (xml: string) => [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]);

export const fileUrl = (key: string) => `${BUCKET_URL}/${key}`;

/** Every key in one hour folder, oldest first. */
export async function listKeys(prefix: string): Promise<string[]> {
  const params = new URLSearchParams({ 'list-type': '2', prefix });
  const response = await fetch(`${BUCKET_URL}/?${params}`);
  if (!response.ok) throw new Error(`S3 listing returned ${response.status}`);
  return parseListKeys(await response.text());
}
