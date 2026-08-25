import { queryBounds } from "@/lib/flashes";

/**
 * GET /api/bounds
 *
 * The time window the dataset actually covers, plus a total count. The UI uses
 * this to seed its time picker and the Cesium clock.
 */
export async function GET() {
  try {
    const bounds = await queryBounds();
    return Response.json(bounds, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (error) {
    console.error("[/api/bounds]", error);
    return Response.json({ error: "Failed to read dataset bounds." }, { status: 500 });
  }
}
