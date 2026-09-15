import { decodeGlm, formatIsoMicros, makeUnpacker, parseEpochMicros, type RawGlmFile } from './decodeGlm';

// Packing attributes copied from a real GOES-19 file (s20262572059400).
const TIME_ATTRS = {
  scale_factor: new Float32Array([0.00038147560553625226]),
  add_offset: new Float32Array([-5]),
  _Unsigned: 'true',
  units: 'seconds since 2026-09-14 20:59:40.000',
};
const AREA_ATTRS = { _FillValue: new Int16Array([-1]), scale_factor: new Float32Array([152601.859375]), add_offset: new Float32Array([0]), _Unsigned: 'true', units: 'm2' };

test('it should read int16 bits as uint16 when _Unsigned is set', () => {
  const read = makeUnpacker({ data: new Int16Array([-4204, 12]), attrs: { _Unsigned: 'true' } });
  expect(read(0)).toBe(61332);
  expect(read(1)).toBe(12);
});

test('it should not lose 25.000385 s on negative packed times', () => {
  const data = new Int16Array([-100]);
  const unsigned = makeUnpacker({ data, attrs: TIME_ATTRS })(0)!;
  const signed = makeUnpacker({ data, attrs: { ...TIME_ATTRS, _Unsigned: 'false' } })(0)!;
  expect(unsigned - signed).toBeCloseTo(25.000385, 5);
});

test('it should apply scale_factor and add_offset', () => {
  const read = makeUnpacker({ data: new Int16Array([11825]), attrs: TIME_ATTRS });
  expect(read(0)).toBeCloseTo(11825 * 0.00038147560553625226 - 5, 6);
});

test('it should parse the epoch from the units attribute to microseconds', () => {
  expect(parseEpochMicros('seconds since 2026-09-14 20:59:40.000')).toBe(Date.UTC(2026, 8, 14, 20, 59, 40) * 1000);
});

test('it should format timestamps with microsecond precision', () => {
  const micros = Date.UTC(2026, 7, 1, 0, 0, 3) * 1000 + 447777;
  expect(formatIsoMicros(micros)).toBe('2026-08-01T00:00:03.447777Z');
  expect(formatIsoMicros(Date.UTC(2026, 7, 1) * 1000 + 5)).toBe('2026-08-01T00:00:00.000005Z');
});

test('it should decode flashes inside the bbox and convert area to km²', () => {
  const raw: RawGlmFile = {
    flash_id: { data: new Int16Array([-4204, 7, 8]), attrs: { _Unsigned: 'true' } },
    flash_time_offset_of_first_event: { data: new Int16Array([13108, 13108, 13108]), attrs: TIME_ATTRS },
    flash_lat: { data: new Float32Array([45.5, 45.5, 10]), attrs: {} },
    flash_lon: { data: new Float32Array([-110.25, -110.25, -60]), attrs: {} },
    flash_energy: { data: new Int16Array([31, 31, 31]), attrs: { scale_factor: new Float32Array([1e-15]), add_offset: new Float32Array([0]), _Unsigned: 'true' } },
    flash_area: { data: new Int16Array([1395, -1, 1395]), attrs: AREA_ATTRS },
    flash_quality_flag: { data: new Int16Array([0, 0, 0]), attrs: { _Unsigned: 'true' } },
  };

  const flashes = decodeGlm(raw, { west: -117, south: 41, east: -105, north: 49 });

  expect(flashes).toHaveLength(2);
  expect(flashes[0].flash_id).toBe(61332);
  expect(flashes[0].flash_time.startsWith('2026-09-14T20:59:40.00')).toBe(true);
  expect(flashes[0].area_km2).toBeCloseTo(212.88, 2);
  expect(flashes[0].energy_j).toBeCloseTo(3.1e-14, 20);
  expect(flashes[1].area_km2).toBeNull();
});

// Sad paths

test('it should return null for fill values', () => {
  const read = makeUnpacker({ data: new Int16Array([-1]), attrs: AREA_ATTRS });
  expect(read(0)).toBeNull();
});

test('it should throw on time units it does not understand', () => {
  expect(() => parseEpochMicros('days since 2026-09-14')).toThrow('Unrecognised GLM time units');
  expect(() => parseEpochMicros(undefined)).toThrow('Unrecognised GLM time units');
});
