import { MemoryCompressor } from '../src/compressor';
import { StorageEngine } from '../src/storage';
import { ReplayEngine } from '../src/replay';
import { DecayManager } from '../src/decay';

describe('MemoryCompressor', () => {
  const compressor = new MemoryCompressor();

  test('extracts facts from messages', () => {
    const facts = compressor.extractFacts([
      'The system is built with TypeScript. It uses SQLite for storage.',
      'This has nothing interesting.'
    ]);
    expect(facts.length).toBeGreaterThanOrEqual(1);
    expect(facts.some(f => f.includes('TypeScript') || f.includes('SQLite'))).toBe(true);
  });

  test('extracts decisions from messages', () => {
    const decisions = compressor.extractDecisions([
      'We decided to use PostgreSQL. Going with Redis for caching.'
    ]);
    expect(decisions.length).toBeGreaterThanOrEqual(1);
    expect(decisions.some(d => d.includes('PostgreSQL') || d.includes('Redis'))).toBe(true);
  });

  test('compresses messages into a snapshot with AAAK', () => {
    const snapshot = compressor.compress('sess-1', [
      'The project is a memory layer. We decided to use SQLite.',
      'It requires Node.js 18+.'
    ], { project: 'mem-pattern' });

    expect(snapshot.id).toBeDefined();
    expect(snapshot.sessionId).toBe('sess-1');
    expect(snapshot.facts.length).toBeGreaterThan(0);
    expect(snapshot.aaak).toBeDefined();
    expect(snapshot.aaak).toContain('S:sess-1');
    expect(snapshot.importance).toBeGreaterThan(0);
  });

  test('AAAK round-trip parse', () => {
    const snapshot = compressor.compress('sess-rt', [
      'The API is RESTful. We decided to use Express.'
    ], { env: 'prod' });

    const parsed = MemoryCompressor.fromAAK(snapshot.aaak!);
    expect(parsed.sessionId).toBe('sess-rt');
    expect(parsed.importance).toBeCloseTo(snapshot.importance, 1);
    expect(parsed.facts).toBeDefined();
    expect(parsed.context).toHaveProperty('env');
  });
});

describe('StorageEngine', () => {
  let storage: StorageEngine;
  const compressor = new MemoryCompressor();

  beforeEach(() => { storage = new StorageEngine(); });
  afterEach(() => { storage.close(); });

  test('save and retrieve snapshot', () => {
    const snap = compressor.compress('s1', ['The database is SQLite.']);
    storage.save(snap);
    const retrieved = storage.get(snap.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.sessionId).toBe('s1');
    expect(retrieved!.accessCount).toBe(1); // get increments
  });

  test('query by session and importance', () => {
    const s1 = compressor.compress('alpha', ['System is complex. It uses microservices. Architecture was redesigned. We decided to use K8s. Should switch to gRPC.']);
    const s2 = compressor.compress('beta', ['ok']);
    storage.save(s1);
    storage.save(s2);

    const bySession = storage.query({ sessionId: 'alpha' });
    expect(bySession.length).toBe(1);

    const byImportance = storage.query({ minImportance: 0.3 });
    expect(byImportance.every(s => s.importance >= 0.3)).toBe(true);
  });

  test('delete snapshot', () => {
    const snap = compressor.compress('del', ['Data is temporary.']);
    storage.save(snap);
    expect(storage.delete(snap.id)).toBe(true);
    expect(storage.get(snap.id)).toBeNull();
  });
});

describe('ReplayEngine', () => {
  test('builds context prompt from stored memories', () => {
    const storage = new StorageEngine();
    const compressor = new MemoryCompressor();
    const replay = new ReplayEngine(storage);

    storage.save(compressor.compress('s1', ['The API is versioned. We decided to use v2.']));
    storage.save(compressor.compress('s2', ['Database runs on port 5432.']));

    const prompt = replay.buildContextPrompt();
    expect(prompt).toContain('Prior Session Context');
    expect(prompt.length).toBeGreaterThan(20);

    storage.close();
  });
});

describe('DecayManager', () => {
  test('prunes old low-importance memories', () => {
    const storage = new StorageEngine();
    const compressor = new MemoryCompressor();
    const decay = new DecayManager(storage, { halfLifeDays: 0.001, minImportance: 0.9 });

    // Create a snapshot with low importance
    const snap = compressor.compress('old', ['Something is here.']);
    snap.importance = 0.1;
    snap.createdAt = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
    storage.save(snap);

    const result = decay.decay();
    expect(result.pruned).toBeGreaterThanOrEqual(1);
    expect(storage.count()).toBe(0);

    storage.close();
  });

  test('preserves frequently accessed memories', () => {
    const storage = new StorageEngine();
    const compressor = new MemoryCompressor();
    const decay = new DecayManager(storage, { halfLifeDays: 1, minImportance: 0.05, accessBoost: 0.3 });

    const snap = compressor.compress('active', ['Config is important. System uses Redis.']);
    snap.accessCount = 10;
    snap.importance = 0.5;
    storage.save(snap);

    const result = decay.decay();
    expect(result.pruned).toBe(0);
    expect(storage.count()).toBe(1);

    storage.close();
  });
});
