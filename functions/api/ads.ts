type AdsRow = {
  id?: unknown;
  title?: unknown;
  text?: unknown;
  image_url?: unknown;
  target_url?: unknown;
  placement?: unknown;
};

type AdsResult = { results?: unknown[] };
type AdsStatement = {
  bind: (...values: unknown[]) => AdsStatement;
  all: () => Promise<AdsResult>;
};
type AdsDatabase = { prepare: (query: string) => AdsStatement };
type AdsEnv = { DB?: AdsDatabase };

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function failure(error: string): Response {
  return Response.json(
    { ads: [], error },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function onRequestGet({
  request,
  env,
}: {
  request: Request;
  env: AdsEnv;
}) {
  if (!env.DB) return failure("database_unavailable");

  try {
    const url = new URL(request.url);
    const placement = (url.searchParams.get("placement") || "home_top")
      .replace(/[^a-z_]/g, "")
      .slice(0, 30);

    const rows = await env.DB
      .prepare(
        "SELECT id,title,text,image_url,target_url,placement FROM ads WHERE status='active' AND placement=? AND (starts_at IS NULL OR starts_at<=date('now')) AND (ends_at IS NULL OR ends_at>=date('now')) ORDER BY id DESC LIMIT 10",
      )
      .bind(placement)
      .all();

    const ads = (Array.isArray(rows.results) ? rows.results : [])
      .filter((row): row is AdsRow => Boolean(row) && typeof row === "object")
      .filter((row) => typeof row.title === "string" && row.title.trim().length > 0)
      .map((row) => ({
        id: row.id,
        title: row.title,
        text: typeof row.text === "string" ? row.text : "",
        image_url: safeHttpUrl(row.image_url),
        target_url: safeHttpUrl(row.target_url),
        placement: row.placement,
      }));

    return Response.json(
      { ads },
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  } catch {
    return failure("ads_unavailable");
  }
}
