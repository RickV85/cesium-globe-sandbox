import { MAX_LIMIT, queryBounds, queryFlashes } from "@/lib/flashes";

/**
 * GET /api/flashes?start=<iso>&end=<iso>&limit=<n>
 *
 * Flat flash records for a time window — the same payload drives the table and
 * the globe, so there is deliberately no second "map" endpoint.
 *
 * `start` is inclusive, `end` exclusive. Both default to the full extent of the
 * dataset, so a bare /api/flashes returns everything currently ingested.
 */

function parseInstant(value: string | null, label: string): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new RangeError(`'${label}' is not a valid ISO-8601 timestamp: ${value}`);
  }
  return new Date(parsed).toISOString();
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  let start: string | null;
  let end: string | null;
  let limit: number | undefined;

  try {
    start = parseInstant(params.get("start"), "start");
    end = parseInstant(params.get("end"), "end");

    const rawLimit = params.get("limit");
    if (rawLimit !== null) {
      const n = Number(rawLimit);
      if (!Number.isInteger(n) || n < 1) {
        throw new RangeError(`'limit' must be a positive integer: ${rawLimit}`);
      }
      limit = Math.min(n, MAX_LIMIT);
    }
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid query parameters." },
      { status: 400 },
    );
  }

  try {
    // Fall back to the dataset's own extent so the endpoint is useful bare.
    if (!start || !end) {
      const bounds = await queryBounds();
      if (!bounds.earliest || !bounds.latest) {
        return Response.json({ start: null, end: null, count: 0, flashes: [] });
      }
      start ??= bounds.earliest;
      // `end` is exclusive, so nudge past the final flash to include it.
      end ??= new Date(Date.parse(bounds.latest) + 1000).toISOString();
    }

    if (Date.parse(end) <= Date.parse(start)) {
      return Response.json({ error: "'end' must be after 'start'." }, { status: 400 });
    }

    const flashes = await queryFlashes({ start, end, limit });
    return Response.json(
      { start, end, count: flashes.length, truncated: flashes.length === (limit ?? MAX_LIMIT), flashes },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch (error) {
    // Never surface driver errors to the client — they leak schema and host.
    console.error("[/api/flashes]", error);
    return Response.json({ error: "Failed to query flashes." }, { status: 500 });
  }
}
