import { useState } from "react";
import { Activity, ExternalLink, RefreshCw, Search } from "lucide-react";

type ApiEntry = { id: string; name: string; category: string; description: string; docsUrl: string; termsNote: string; testable: boolean };
type TestResult = { ok: boolean; httpStatus?: number; latencyMs: number; checkedAt: string; detail: string };

export default function AdminApiExplorer() {
  const [apis, setApis] = useState<ApiEntry[]>([]);
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [category, setCategory] = useState("Tümü");
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);

  async function load() {
    setError("");
    try {
      const response = await fetch("/api/admin/api-catalog", { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 401 ? "Oturum süresi dolmuş. Yeniden giriş yap." : "API kataloğu alınamadı.");
      const data = await response.json() as { apis?: ApiEntry[] };
      setApis(Array.isArray(data.apis) ? data.apis : []);
      setLoaded(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Bağlantı hatası."); }
  }

  async function testApi(id: string) {
    setLoading(v => ({ ...v, [id]: true }));
    setError("");
    try {
      const response = await fetch("/api/admin/api-catalog", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }),
      });
      const result = await response.json() as TestResult;
      setResults(v => ({ ...v, [id]: result }));
    } catch { setError("Test isteği tamamlanamadı."); }
    finally { setLoading(v => ({ ...v, [id]: false })); }
  }

  const categories = ["Tümü", ...Array.from(new Set(apis.map(api => api.category)))];
  const filtered = apis.filter(api => (category === "Tümü" || api.category === category) && (api.name + " " + api.description).toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")));

  return <div className="panel admin-api-explorer">
    <div className="panel-title"><div><h2><Activity/> API Keşif ve Test Merkezi</h2><p>Yanımda Türkiye için seçilmiş açık API kaynaklarını keşfet ve bağlantılarını yönetici oturumunda test et.</p></div><button type="button" onClick={() => void load()}><RefreshCw/> {loaded ? "Yenile" : "Kataloğu Yükle"}</button></div>
    {error && <div className="error" role="alert">{error}</div>}
    {!loaded ? <p>API kataloğunu görüntülemek için yükle düğmesine bas.</p> : <>
      <label className="admin-api-search"><Search/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="API veya kategori ara…"/></label>
      <div className="admin-api-categories">{categories.map(item => <button type="button" key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
      <div className="admin-api-grid">{filtered.map(api => {
        const result = results[api.id];
        return <article className="admin-api-card" key={api.id}>
          <div className="admin-api-card-head"><div><small>{api.category}</small><h3>{api.name}</h3></div>{result && <span className={result.ok ? "api-status api-ok" : "api-status api-fail"}>{result.ok ? "Çalışıyor" : "Kontrol gerekli"}</span>}</div>
          <p>{api.description}</p><small className="admin-api-terms">{api.termsNote}</small>
          {result && <p className="admin-api-result" role="status">{result.detail} {result.httpStatus ? "HTTP " + result.httpStatus + " · " : ""}{result.latencyMs} ms</p>}
          <div className="admin-api-actions"><a href={api.docsUrl} target="_blank" rel="noreferrer">Belgeler <ExternalLink size={14}/></a><button type="button" disabled={!!loading[api.id]} onClick={() => void testApi(api.id)}><Activity size={15}/>{loading[api.id] ? "Test ediliyor…" : "Bağlantıyı Test Et"}</button></div>
        </article>;
      })}</div>
      <p className="admin-api-footnote">Bu ilk sürüm doğrulanmış bir API dizini değil, seçilmiş kaynakların keşif listesidir. Bağlantı testi yalnızca örnek uç noktaya erişimi ve JSON yanıtını kontrol eder; lisans, kota, veri doğruluğu veya ticari kullanım iznini onaylamaz. Her API entegrasyondan önce ayrıca incelenmelidir.</p>
    </>}
  </div>;
}
