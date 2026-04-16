import Database from 'better-sqlite3';
import { MemorySnapshot, MemoryQuery } from './types';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  facts TEXT NOT NULL,
  decisions TEXT NOT NULL,
  context TEXT NOT NULL,
  importance REAL NOT NULL DEFAULT 0.5,
  created_at TEXT NOT NULL,
  last_accessed TEXT NOT NULL,
  access_count INTEGER NOT NULL DEFAULT 0,
  aaak TEXT
);
CREATE INDEX IF NOT EXISTS idx_session ON snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_importance ON snapshots(importance);
CREATE INDEX IF NOT EXISTS idx_created ON snapshots(created_at);
`;

export class StorageEngine {
  private db: Database.Database;

  constructor(dbPath: string = ':memory:') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(SCHEMA);
  }

  save(snapshot: MemorySnapshot): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO snapshots (id, session_id, facts, decisions, context, importance, created_at, last_accessed, access_count, aaak)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      snapshot.id,
      snapshot.sessionId,
      JSON.stringify(snapshot.facts),
      JSON.stringify(snapshot.decisions),
      JSON.stringify(snapshot.context),
      snapshot.importance,
      snapshot.createdAt,
      snapshot.lastAccessed,
      snapshot.accessCount,
      snapshot.aaak || null
    );
  }

  get(id: string): MemorySnapshot | null {
    const row = this.db.prepare('SELECT * FROM snapshots WHERE id = ?').get(id) as any;
    if (!row) return null;
    const now = new Date().toISOString();
    this.db.prepare('UPDATE snapshots SET access_count = access_count + 1, last_accessed = ? WHERE id = ?')
      .run(now, id);
    row.access_count += 1;
    row.last_accessed = now;
    return this.rowToSnapshot(row);
  }

  query(q: MemoryQuery): MemorySnapshot[] {
    const conditions: string[] = [];
    const params: any[] = [];

    if (q.sessionId) { conditions.push('session_id = ?'); params.push(q.sessionId); }
    if (q.minImportance !== undefined) { conditions.push('importance >= ?'); params.push(q.minImportance); }
    if (q.before) { conditions.push('created_at < ?'); params.push(q.before); }
    if (q.after) { conditions.push('created_at > ?'); params.push(q.after); }

    let sql = 'SELECT * FROM snapshots';
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY importance DESC, created_at DESC';
    if (q.limit) { sql += ' LIMIT ?'; params.push(q.limit); }

    const rows = this.db.prepare(sql).all(...params) as any[];
    let results = rows.map(r => this.rowToSnapshot(r));

    if (q.keyword) {
      const kw = q.keyword.toLowerCase();
      results = results.filter(s =>
        s.facts.some(f => f.toLowerCase().includes(kw)) ||
        s.decisions.some(d => d.toLowerCase().includes(kw)) ||
        (s.aaak && s.aaak.toLowerCase().includes(kw))
      );
    }

    return results;
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM snapshots WHERE id = ?').run(id);
    return result.changes > 0;
  }

  count(): number {
    return (this.db.prepare('SELECT COUNT(*) as c FROM snapshots').get() as any).c;
  }

  all(): MemorySnapshot[] {
    return (this.db.prepare('SELECT * FROM snapshots ORDER BY importance DESC').all() as any[])
      .map(r => this.rowToSnapshot(r));
  }

  close(): void {
    this.db.close();
  }

  private rowToSnapshot(row: any): MemorySnapshot {
    return {
      id: row.id,
      sessionId: row.session_id,
      facts: JSON.parse(row.facts),
      decisions: JSON.parse(row.decisions),
      context: JSON.parse(row.context),
      importance: row.importance,
      createdAt: row.created_at,
      lastAccessed: row.last_accessed,
      accessCount: row.access_count,
      aaak: row.aaak || undefined,
    };
  }
}
