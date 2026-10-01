type D1Result = { results?: unknown[] };
type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  run: () => Promise<unknown>;
  all: () => Promise<D1Result>;
};
type D1DatabaseLike = {
  prepare: (query: string) => D1Statement;
};

export async function onRequestGet({
  request,
  env,
}: {
  request: Request;
  env: { DB?: D1DatabaseLike };
}) {
  if (!env.DB) return Response.json({ ads: [] });

  await env.DB
    .prepare(
      "CREATE TABLE IF NOT EXISTS ads (id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,text TEXT,image_url TEXT,target_url TEXT,placement TEXT NOT NULL DEFAULT 'home_top',status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
    )
    .run();

  try {
    const url = new URL(request.url);
    const placement = (url.searchParams.get("placement") || "home_top")
      .replace(/[^a-z_]/g, "")
      .slice(0, 30);

    const rows = await env.DB
      .prepare(
        "SELECT id,title,text,image_url,target_url,placement FROM ads WHERE status='active' AND placement=? ORDER BY id DESC LIMIT 10"
      )
      .bind(placement)
      .all();

    return Response.json(
      { ads: rows.results || [] },
      { headers: { "cache-control": "public, max-age=60" } }
    );
  } catch {
    return Response.json({ ads: [] });
  }
}
