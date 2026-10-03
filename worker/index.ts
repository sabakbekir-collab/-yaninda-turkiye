import { onRequestGet as getPlaces } from "../functions/api/places";
import { onRequestGet as getAds } from "../functions/api/ads";
import { onRequestPost as postEvents } from "../functions/api/events";
import { onRequestGet as getAdmin, onRequestPost as postAdmin } from "../functions/api/admin";
import { onRequestPost as postSubmissions } from "../functions/api/submissions";
import { onRequestPost as postReports } from "../functions/api/reports";
import type { Env } from "../functions/lib/types";
import { ensureSchema } from "../functions/lib/schema";

type RuntimeEnv = Env & {
  ASSETS: { fetch(request: Request): Promise<Response> };
};

const json404 = () => Response.json({ error: "not_found" }, { status: 404 });

export default {
  async fetch(request: Request, env: RuntimeEnv): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Health must be independent of schema initialization so a broken/missing D1
      // binding reports a useful 503 instead of being hidden by ensureSchema().
      if (path === "/api/health" && request.method === "GET") {
        if (!env.DB) {
          return Response.json({ ok: true, database: false, version: "2026.10.01" });
        }
        try {
          await env.DB.prepare("SELECT 1 AS ok").first();
          return Response.json({ ok: true, database: true, version: "2026.10.01" });
        } catch {
          return Response.json({ ok: false, database: false, version: "2026.10.01" }, { status: 503 });
        }
      }

      if (path.startsWith("/api/") && env.DB) {
        await ensureSchema(env);
      }

      if (path === "/api/places" && request.method === "GET") {
        return await getPlaces({ request, env });
      }

      if (path === "/api/ads" && request.method === "GET") {
        return await getAds({ request, env });
      }

      if (path === "/api/events" && request.method === "POST") {
        return await postEvents({ request, env });
      }

      if (path === "/api/admin" && request.method === "GET") {
        return await getAdmin({ request, env });
      }

      if (path === "/api/admin" && request.method === "POST") {
        return await postAdmin({ request, env });
      }

      if (path === "/api/submissions" && request.method === "POST") {
        return await postSubmissions({ request, env });
      }

      if (path === "/api/reports" && request.method === "POST") {
        return await postReports({ request, env });
      }

      // All non-API requests must be served by the Vite build. Without this
      // fallback the Worker returns 404 for the homepage and Safari reports
      // that the page cannot be opened even though the deployment succeeds.
      return await env.ASSETS.fetch(request);
    } catch (error) {
      console.error("Yanımda Türkiye Worker request error", {
        path,
        method: request.method,
        error,
      });
      return Response.json({ error: "server_error" }, { status: 500 });
    }
  },
};
