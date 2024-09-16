export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "0");
  const limit = parseInt(searchParams.get("limit") || "10");

  const items = Array.from({ length: limit }, (_, i) => ({
    id: page * limit + i,
    name: `Item ${page * limit + i}`,
  }));
  return Response.json(items);
}
