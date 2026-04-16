# claude-mem-pattern

Session memory compression and replay layer for AI agents.

## Features

- **Memory Compressor** — Extract key facts, decisions, and context from conversations into structured snapshots
- **Storage Engine** — SQLite-backed persistent storage with JSON schema
- **Replay Engine** — Retrieve and inject relevant memories at session start
- **Decay Manager** — Time-based and importance-based memory pruning
- **AAAK Format** — Abbreviated Agent-Aware Knowledge compression

## Install

```bash
npm install claude-mem-pattern
```

## Quick Start

```typescript
import { MemoryCompressor, StorageEngine, ReplayEngine, DecayManager } from 'claude-mem-pattern';

// Compress a conversation into a memory snapshot
const compressor = new MemoryCompressor();
const snapshot = compressor.compress('session-123', [
  'The project uses TypeScript and SQLite.',
  'We decided to use better-sqlite3 for performance.',
], { project: 'my-agent' });

// Store it
const storage = new StorageEngine('./memories.db');
storage.save(snapshot);

// Replay at next session start
const replay = new ReplayEngine(storage);
const contextPrompt = replay.buildContextPrompt({ limit: 5 });
// Inject contextPrompt into your agent's system message

// Periodically prune old memories
const decay = new DecayManager(storage);
const { decayed, pruned } = decay.decay();
```

## AAAK Format

Snapshots can be compressed into AAAK (Abbreviated Agent-Aware Knowledge) strings:

```
S:session-123||I:0.72||F:project uses TypeScript|SQLite storage||D:use better-sqlite3||C:project=my-agent
```

Parse back with `MemoryCompressor.fromAAK(aaakString)`.

## License

MIT
