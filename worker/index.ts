import { onRequestGet as getPlaces } from "../functions/api/places";
import { onRequestGet as getAds } from "../functions/api/ads";
import { onRequestPost as postEvents } from "../functions/api/events";
import { onRequestGet as getAdmin, onRequestPost as postAdmin } from "../functions/api/admin";
import { onRequestPost as postSubmissions } from "../functions/api/submissions";
import { onRequestPost as postReports } from "../functions/api/reports";
import { onRequestPost as postAiChat } from "../functions/api/ai";
import { onRequestPost as postAdminAi } from "../functions/api/admin-ai";
import type { Env } from "../functions/lib/types";
import { ensureSchema } from "../functions/lib/schema";

type RuntimeEnv = Env & {
  ASSETS: { fetch(request: Request): Promise<Response> };
};

type CfLocation = {
  latitude?: string | null;
  longitude?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
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
          return Response.json({ ok: true, database: false, version: "2026.10.03" });
        }
        try {
          await env.DB.prepare("SELECT 1 AS ok").first();
          return Response.json({ ok: true, database: true, version: "2026.10.03" });
        } catch {
          return Response.json({ ok: false, database: false, version: "2026.10.03" }, { status: 503 });
        }
      }

      // Browser GPS can fail on iPhone/Safari with TIMEOUT or POSITION_UNAVAILABLE
      // even when the site has permission. Expose Cloudflare's approximate
      // request geolocation as a recovery path. The frontend only uses this
      // after a real GPS attempt fails; explicit permission denial never bypasses
      // the user's choice.
      if (path === "/api/location" && request.method === "GET") {
        const cf = (request as Request & { cf?: CfLocation }).cf;
        const latitude = cf?.latitude ?? null;
        const longitude = cf?.longitude ?? null;

        if (latitude == null || longitude == null) {
          return Response.json({ error: "location_unavailable" }, { status: 503 });
        }

        return Response.json({
          latitude,
          longitude,
          city: cf?.city ?? null,
          region: cf?.region ?? null,
          country: cf?.country ?? null,
          approximate: true,
        }, {
          headers: {
            "Cache-Control": "no-store",
            "Permissions-Policy": "geolocation=(self)",
          },
        });
      }

      if (path === "/api/admin/ai" && request.method === "POST") {
        return await postAdminAi({ request, env });
      }

      if ((path === "/api/ai/chat" || path === "/api/ai") && request.method === "POST") {
        return await postAiChat({ request, env });
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

      // All non-API requests must be served by the Vite build.
      // Explicitly allow this top-level site to use browser geolocation on
      // Safari/iPhone. This also makes the policy visible in production
      // instead of relying on the browser default.
      const assetResponse = await env.ASSETS.fetch(request);
      const headers = new Headers(assetResponse.headers);
      headers.set("Permissions-Policy", "geolocation=(self)");
      return new Response(assetResponse.body, {
        status: assetResponse.status,
        statusText: assetResponse.statusText,
        headers,
      });
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
