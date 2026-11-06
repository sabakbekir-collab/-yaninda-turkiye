export function healthResponse(
  databaseAvailable: boolean,
  databaseQuerySucceeded: boolean,
  commit: string,
): Response {
  const database = databaseAvailable && databaseQuerySucceeded;
  const error = !databaseAvailable ? "d1_not_bound" : !databaseQuerySucceeded ? "d1_unavailable" : undefined;
  return Response.json(
    {
      ok: database,
      database,
      ...(error ? { error } : {}),
      commit: commit || "unknown",
    },
    {
      status: database ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
