/* The Node server's short links (links.ts), in a SQLite file through node:sqlite: the same table as D1's on
   Cloudflare, made by the same migrations (migrations/*.sql), each applied once and noted in the file as
   wrangler notes them in D1. */
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ROOT } from '../pipeline/paths.ts';
import { today, type LinkStore, type StoredLink } from './links.ts';

export function sqliteLinks(file: string, migrations = join(ROOT, 'migrations')): LinkStore & { close(): void } {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY)');
  const done = new Set((db.prepare('SELECT name FROM migrations').all() as { name: string }[]).map(r => r.name));
  for (const name of readdirSync(migrations).filter(f => f.endsWith('.sql')).sort()) {
    if (done.has(name)) continue;
    db.exec('BEGIN');
    try {
      db.exec(readFileSync(join(migrations, name), 'utf8'));
      db.prepare('INSERT INTO migrations (name) VALUES (?)').run(name);
      db.exec('COMMIT');
    } catch (err) { db.exec('ROLLBACK'); throw err; }
  }
  const select = db.prepare('SELECT layout, state AS s FROM links WHERE id = ?');
  const insert = db.prepare('INSERT INTO links (id, layout, state, created) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO NOTHING');
  const get = (id: string) => { const r = select.get(id) as StoredLink | undefined; return r ? { layout: r.layout, s: r.s } : null; };
  return {
    get: async id => get(id),
    add: async (id, link) => { insert.run(id, link.layout, link.s, today()); return get(id)!; },
    close: () => db.close(),
  };
}
