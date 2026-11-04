type AdsResult = { results?: unknown[] };

type AdsStatement = {
  bind: (...values: unknown[]) => AdsStatement;
  all: () => Promise<AdsResult>;
};

type AdsDatabase = {
  prepare: (query: string) => AdsStatement;
};

type AdsEnv = {
  DB?: AdsDatabase;
};

export async function onRequestGet({
  request,
  env,
}: {
  request: Request;
  env: AdsEnv;
}) {
  // Do not report an empty ad inventory when the database is unavailable.
  // Schema creation is centralized in the Worker bootstrap.
  if (!env.DB) {
    return Response.json(
      { error: "database_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

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
    return Response.json(
      { error: "ads_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
