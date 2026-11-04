export function healthResponse(databaseAvailable: boolean, databaseQuerySucceeded: boolean, version: string): Response {
  const database = databaseAvailable && databaseQuerySucceeded;
  return Response.json(
    { ok: database, database, version },
    {
      status: database ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
