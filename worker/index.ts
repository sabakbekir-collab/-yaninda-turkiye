import { onRequestGet as getPlaces, onRequestAreaGet as getLocationArea } from "../functions/api/places";
import { onRequestGet as getAds } from "../functions/api/ads";
import { onRequestPost as postEvents } from "../functions/api/events";
import { onRequestGet as getAdmin, onRequestPost as postAdmin } from "../functions/api/admin";
import { onRequestPost as postSubmissions } from "../functions/api/submissions";
import { onRequestPost as postReports } from "../functions/api/reports";
import { onRequestPost as postAiChat } from "../functions/api/ai";
import { onRequestPost as postAdminAi } from "../functions/api/admin-ai";
import { isTelegramWebhookPath, onRequest as postTelegram } from "../functions/api/telegram";
import type { Env } from "../functions/lib/types";
import { ensureSchema } from "../functions/lib/schema";
import { validSession } from "../functions/lib/auth";
import { healthResponse } from "../functions/lib/health";
import { sendMissingRosterReminder } from "../functions/lib/telegramFlow";

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
      // Health must be independent of schema initialization. Missing or
      // unreachable D1 is an unhealthy service and must return HTTP 503.
      if (path === "/api/health" && request.method === "GET") {
        if (!env.DB) return healthResponse(false, false, env.COMMIT_SHA || "unknown");
        try {
          await env.DB.prepare("SELECT 1 AS ok").first();
          return healthResponse(true, true, env.COMMIT_SHA || "unknown");
        } catch {
          return healthResponse(true, false, env.COMMIT_SHA || "unknown");
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

      // Diagnostic endpoint: admin-only (it exposes raw provider responses).
      if (path === "/api/duty-check" && request.method === "GET") {
        if (!(await validSession(request, env))) return Response.json({ error: "unauthorized" }, { status: 401 });
        const city = (url.searchParams.get("city") || "istanbul").trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) || "istanbul";
        const provider = new URL("https://eczaneadresi.com/api/public/v1/duty-pharmacies");
        provider.searchParams.set("city", city);
        provider.searchParams.set("limit", "5");
        try {
          const response = await fetch(provider, {
            headers: { Accept: "application/json", "User-Agent": "YanindaTurkiye/1.0" },
            signal: AbortSignal.timeout(10000),
          });
          const body = await response.text();
          return new Response(JSON.stringify({
            ok: response.ok,
            status: response.status,
            city,
            provider: provider.toString(),
            body: body.slice(0, 20000),
          }), {
            status: response.ok ? 200 : 502,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        } catch (error) {
          return Response.json({
            ok: false,
            city,
            error: error instanceof Error ? error.message : "provider_error",
          }, { status: 502, headers: { "Cache-Control": "no-store" } });
        }
      }

      if (isTelegramWebhookPath(path)) return await postTelegram({ request, env });

      // Schema first so rate limiting (api_cache) also works on the very first AI/admin call.
      if (path.startsWith("/api/") && env.DB) {
        try {
          await ensureSchema(env);
        } catch (error) {
          console.error("ensureSchema failed", error);
          return Response.json(
            { error: "database_schema_unavailable" },
            { status: 503, headers: { "Cache-Control": "no-store" } },
          );
        }
      }

      if (path === "/api/admin/ai" && request.method === "POST") {
        return await postAdminAi({ request, env });
      }

      if ((path === "/api/ai/chat" || path === "/api/ai") && request.method === "POST") {
        return await postAiChat({ request, env });
      }

      if (path === "/api/location/area" && request.method === "GET") {
        return await getLocationArea({ request });
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
      // HTML must always revalidate so a new deploy shows up immediately (hashed /assets/* stay cacheable).
      if ((headers.get("Content-Type") || "").includes("text/html")) headers.set("Cache-Control", "no-cache");
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
  scheduled(_controller: ScheduledController, env: RuntimeEnv, context: ExecutionContext) {
    context.waitUntil(sendMissingRosterReminder(env));
  },
};
