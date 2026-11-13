/**
 * Parse Wrangler D1 --json PRAGMA table_info output.
 * Supports both array-of-result-envelopes (remote) and object.results (local).
 * Exit codes: 0 column present, 1 column absent, 2 invalid/unexpected output.
 */
export function parsePragmaOutput(input, column) {
  if (typeof input !== "string" || input.trim() === "") {
    throw new Error("PRAGMA JSON çıktısı boş");
  }
  let decoded;
  try {
    decoded = JSON.parse(input);
  } catch {
    throw new Error("PRAGMA JSON ayrıştırılamadı");
  }

  const envelopes = Array.isArray(decoded) ? decoded : [decoded];
  if (envelopes.length === 0) throw new Error("PRAGMA results alanı bulunamadı");

  let sawResults = false;
  let found = false;
  for (const envelope of envelopes) {
    if (!envelope || typeof envelope !== "object" || !Array.isArray(envelope.results)) {
      throw new Error("PRAGMA results alanı eksik veya geçersiz");
    }
    sawResults = true;
    for (const row of envelope.results) {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        throw new Error("PRAGMA sonuç satırı geçersiz");
      }
      if (row.name === column) found = true;
    }
  }
  if (!sawResults) throw new Error("PRAGMA results alanı bulunamadı");
  return found;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , table, column] = process.argv;
  if (!table || !column) {
    process.stderr.write("PRAGMA tablo/sütun argümanı eksik\n");
    process.exit(2);
  }
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  try {
    process.exit(parsePragmaOutput(input, column) ? 0 : 1);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(2);
  }
}
