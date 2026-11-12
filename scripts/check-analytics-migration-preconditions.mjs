import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationFiles = readdirSync(path.join(root, 'migrations'))
  .filter((file) => /^\d+_analytics_events\.sql$/.test(file))
  .sort();

if (migrationFiles.length !== 1) {
  throw new Error(`Expected exactly one analytics-events migration; found ${migrationFiles.length}`);
}

const sql = readFileSync(path.join(root, 'migrations', migrationFiles[0]), 'utf8');
const alterations = [...sql.matchAll(/ALTER\s+TABLE\s+([A-Za-z_][A-Za-z0-9_]*)\s+ADD\s+COLUMN\s+([A-Za-z_][A-Za-z0-9_]*)/gi)]
  .map((match) => ({ table: match[1], column: match[2] }));

if (alterations.length === 0) {
  throw new Error('Analytics migration has no ALTER TABLE ADD COLUMN statements to preflight');
}

const tables = [...new Set(alterations.map(({ table }) => table))];
const existingColumns = new Map();

for (const table of tables) {
  const output = execFileSync('npx', [
    'wrangler', 'd1', 'execute', 'DB', '--local', '--config', './wrangler.jsonc',
    '--json', '--command', `PRAGMA table_info(${table})`,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const parsed = JSON.parse(output);
  const columns = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
    } else if (value && typeof value === 'object') {
      if (typeof value.cid === 'number' && typeof value.name === 'string') columns.add(value.name);
      for (const item of Object.values(value)) visit(item);
    }
  };
  visit(parsed);
  if (columns.size === 0) throw new Error(`Base schema table missing or unreadable: ${table}`);
  existingColumns.set(table, columns);
}

const conflicts = alterations.filter(({ table, column }) => existingColumns.get(table)?.has(column));
if (conflicts.length > 0) {
  throw new Error(`Analytics migration columns already exist before apply: ${conflicts.map((item) => `${item.table}.${item.column}`).join(', ')}`);
}

process.stdout.write(`PASS  PRAGMA preflight: ${alterations.length} analytics columns are absent before migration apply.\n`);
