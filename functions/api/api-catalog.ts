import type { Env } from "../lib/types";
import { strictSameOrigin, validSession } from "../lib/auth.ts";

type ApiEntry = {
  id: string;
  name: string;
  category: string;
  description: string;
  docsUrl: string;
  termsNote: string;
  testUrl: string;
};

const CATALOG: ApiEntry[] = [
  { id: "open-meteo", name: "Open-Meteo", category: "Hava Durumu", description: "Saatlik ve günlük hava tahmini; hava durumu ekranları ve uyarılar için.", docsUrl: "https://open-meteo.com/en/docs", termsNote: "Ücretsiz kullanım koşulları ve ticari kullanım şartları entegrasyondan önce kontrol edilmeli.", testUrl: "https://api.open-meteo.com/v1/forecast?latitude=38.7432&longitude=41.5064&current=temperature_2m" },
  { id: "nominatim", name: "OpenStreetMap Nominatim", category: "Harita ve Adres", description: "Adres arama ve koordinattan adres bulma (geocoding).", docsUrl: "https://nominatim.org/release-docs/latest/api/Overview/", termsNote: "Kamu sunucusu sıkı kullanım politikası uygular: en fazla 1 istek/sn, uygun User-Agent, önbellek ve atıf gerekir; yoğun kullanım için kendi servisiniz veya sağlayıcı tercih edin.", testUrl: "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=Mus%2C%20Turkiye" },
  { id: "rest-countries", name: "REST Countries", category: "Kamu Verileri", description: "Ülke, başkent, para birimi ve bölge bilgileri.", docsUrl: "https://restcountries.com/", termsNote: "Servis kullanılabilirliği ve lisans koşulları kontrol edilmeli.", testUrl: "https://restcountries.com/v3.1/name/turkey?fields=name,capital,currencies" },
  { id: "frankfurter", name: "Frankfurter", category: "Döviz", description: "Referans döviz kurları; bilgilendirme ve dönüştürme ekranları için.", docsUrl: "https://frankfurter.dev/", termsNote: "Referans kurları ticari banka alış/satış fiyatı değildir; kaynak ve güncellik kullanıcıya açıklanmalı.", testUrl: "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=TRY" },
  { id: "open-meteo-geocoding", name: "Open-Meteo Geocoding", category: "Harita ve Adres", description: "Şehir ve yer adı aramasıyla koordinat bulma.", docsUrl: "https://open-meteo.com/en/docs/geocoding-api", termsNote: "Ücretsiz kullanım ve ticari kullanım koşulları entegrasyondan önce kontrol edilmeli.", testUrl: "https://geocoding-api.open-meteo.com/v1/search?name=Mus&count=1&language=tr&format=json" },
];

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function onRequestGet({ request, env }: { request: Request; env: Env }) {
  if (!(await validSession(request, env))) return json({ error: "unauthorized" }, 401);
  return json({ apis: CATALOG.map(({ testUrl: _testUrl, ...entry }) => ({ ...entry, testable: true })) });
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  if (!strictSameOrigin(request)) return json({ error: "forbidden", detail: "İstek aynı kaynaktan gelmelidir." }, 403);
  if (!(await validSession(request, env))) return json({ error: "unauthorized" }, 401);
  let body: { id?: unknown };
  try { body = await request.json() as { id?: unknown }; } catch { return json({ error: "bad_request" }, 400); }
  if (typeof body.id !== "string") return json({ error: "invalid_api_id" }, 400);
  const entry = CATALOG.find((item) => item.id === body.id);
  if (!entry) return json({ error: "api_not_found" }, 404);

  const started = Date.now();
  try {
    const response = await fetch(entry.testUrl, {
      headers: { Accept: "application/json", "User-Agent": "YanimdaTurkiye-ApiCatalog/1.0" },
      redirect: "manual",
      signal: AbortSignal.timeout(7000),
    });
    if (response.status >= 300 && response.status < 400) {
      return json({ id: entry.id, ok: false, httpStatus: response.status, latencyMs: Date.now() - started, checkedAt: new Date().toISOString(), error: "redirect_blocked", detail: "Güvenlik nedeniyle yönlendirme engellendi." });
    }
    const contentType = response.headers.get("content-type") || "";
    const bodyText = await response.text();
    let validJson = false;
    if (contentType.includes("json") || bodyText.trim().startsWith("{") || bodyText.trim().startsWith("[")) {
      try { JSON.parse(bodyText); validJson = true; } catch { validJson = false; }
    }
    return json({
      id: entry.id,
      ok: response.ok && validJson,
      httpStatus: response.status,
      latencyMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
      contentType,
      detail: response.ok ? (validJson ? "API yanıt verdi ve JSON geçerli." : "HTTP yanıtı geldi ancak JSON doğrulanamadı.") : "API HTTP hata durumu döndürdü.",
    });
  } catch (error) {
    return json({
      id: entry.id,
      ok: false,
      latencyMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
      detail: error instanceof Error && error.name === "TimeoutError" ? "Test zaman aşımına uğradı." : "API bağlantısı kurulamadı.",
    }, 502);
  }
}
