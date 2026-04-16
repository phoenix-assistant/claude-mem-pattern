import { StorageEngine } from './storage';
import { MemorySnapshot, MemoryQuery } from './types';

/**
 * Retrieves and injects relevant memories at session start.
 * Ranks by importance, recency, and access frequency.
 */
export class ReplayEngine {
  private storage: StorageEngine;

  constructor(storage: StorageEngine) {
    this.storage = storage;
  }

  /**
   * Get the most relevant memories for a new session
   */
  replay(query: MemoryQuery = {}): MemorySnapshot[] {
    const limit = query.limit || 10;
    return this.storage.query({ ...query, limit });
  }

  /**
   * Get a session context prompt string from top memories
   */
  buildContextPrompt(query: MemoryQuery = {}): string {
    const memories = this.replay(query);
    if (!memories.length) return '';

    const lines = ['## Prior Session Context\n'];
    for (const m of memories) {
      if (m.aaak) {
        lines.push(`- ${m.aaak}`);
      } else {
        const summary = [
          ...m.facts.slice(0, 3).map(f => `  fact: ${f}`),
          ...m.decisions.slice(0, 2).map(d => `  decision: ${d}`),
        ].join('\n');
        lines.push(`- Session ${m.sessionId} (importance: ${m.importance.toFixed(2)}):\n${summary}`);
      }
    }
    return lines.join('\n');
  }

  /**
   * Get a specific memory and mark it accessed
   */
  recall(id: string): MemorySnapshot | null {
    return this.storage.get(id);
  }
}
