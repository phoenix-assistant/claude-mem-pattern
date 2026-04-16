import { v4 as uuid } from 'uuid';
import { MemorySnapshot, CompressorOptions, DEFAULT_COMPRESSOR_OPTIONS } from './types';

/**
 * Extracts key facts, decisions, and context from conversation text
 * and compresses into structured memory snapshots.
 */
export class MemoryCompressor {
  private options: CompressorOptions;

  constructor(options: Partial<CompressorOptions> = {}) {
    this.options = { ...DEFAULT_COMPRESSOR_OPTIONS, ...options };
  }

  /**
   * Compress a conversation into a memory snapshot
   */
  compress(sessionId: string, messages: string[], context: Record<string, unknown> = {}): MemorySnapshot {
    const facts = this.extractFacts(messages);
    const decisions = this.extractDecisions(messages);
    const importance = this.computeImportance(facts, decisions, messages);
    const now = new Date().toISOString();

    const snapshot: MemorySnapshot = {
      id: uuid(),
      sessionId,
      facts: facts.slice(0, this.options.maxFacts),
      decisions: decisions.slice(0, this.options.maxDecisions),
      context,
      importance,
      createdAt: now,
      lastAccessed: now,
      accessCount: 0,
    };

    if (this.options.aaakFormat) {
      snapshot.aaak = this.toAAK(snapshot);
    }

    return snapshot;
  }

  /**
   * Extract factual statements from messages.
   * Heuristic: sentences containing "is", "are", "was", "has", "uses", "runs"
   */
  extractFacts(messages: string[]): string[] {
    const factPatterns = /\b(is|are|was|were|has|have|uses|runs|contains|requires|supports|provides|includes)\b/i;
    const facts: string[] = [];

    for (const msg of messages) {
      const sentences = msg.split(/[.!?\n]+/).map(s => s.trim()).filter(Boolean);
      for (const s of sentences) {
        if (factPatterns.test(s) && s.length > 10 && s.length < 300) {
          facts.push(s);
        }
      }
    }
    return [...new Set(facts)];
  }

  /**
   * Extract decisions from messages.
   * Heuristic: sentences with decision-indicating words
   */
  extractDecisions(messages: string[]): string[] {
    const decisionPatterns = /\b(decided|chose|will use|going with|selected|picked|switched to|let's|we'll|should)\b/i;
    const decisions: string[] = [];

    for (const msg of messages) {
      const sentences = msg.split(/[.!?\n]+/).map(s => s.trim()).filter(Boolean);
      for (const s of sentences) {
        if (decisionPatterns.test(s) && s.length > 10 && s.length < 300) {
          decisions.push(s);
        }
      }
    }
    return [...new Set(decisions)];
  }

  /**
   * Compute importance score 0-1 based on content density
   */
  computeImportance(facts: string[], decisions: string[], messages: string[]): number {
    const totalLength = messages.join(' ').length || 1;
    const factDensity = Math.min(facts.length / 10, 1);
    const decisionWeight = Math.min(decisions.length / 5, 1);
    const lengthFactor = Math.min(totalLength / 1000, 1);
    return Math.min(factDensity * 0.4 + decisionWeight * 0.4 + lengthFactor * 0.2, 1);
  }

  /**
   * Convert snapshot to AAAK compressed format
   * AAAK = Abbreviated Agent-Aware Knowledge
   */
  toAAK(snapshot: MemorySnapshot): string {
    const parts: string[] = [];
    parts.push(`S:${snapshot.sessionId}`);
    parts.push(`I:${snapshot.importance.toFixed(2)}`);
    if (snapshot.facts.length) {
      parts.push(`F:${snapshot.facts.map(f => this.abbreviate(f)).join('|')}`);
    }
    if (snapshot.decisions.length) {
      parts.push(`D:${snapshot.decisions.map(d => this.abbreviate(d)).join('|')}`);
    }
    const ctxKeys = Object.keys(snapshot.context);
    if (ctxKeys.length) {
      parts.push(`C:${ctxKeys.map(k => `${k}=${String(snapshot.context[k])}`).join('|')}`);
    }
    return parts.join('||');
  }

  /**
   * Parse AAAK string back to partial snapshot data
   */
  static fromAAK(aaak: string): Partial<MemorySnapshot> {
    const parts = aaak.split('||');
    const result: Partial<MemorySnapshot> = {};

    for (const part of parts) {
      const [prefix, ...rest] = part.split(':');
      const value = rest.join(':');
      switch (prefix) {
        case 'S': result.sessionId = value; break;
        case 'I': result.importance = parseFloat(value); break;
        case 'F': result.facts = value.split('|'); break;
        case 'D': result.decisions = value.split('|'); break;
        case 'C': {
          result.context = {};
          for (const kv of value.split('|')) {
            const [k, ...v] = kv.split('=');
            result.context[k] = v.join('=');
          }
          break;
        }
      }
    }
    return result;
  }

  private abbreviate(text: string, maxLen = 80): string {
    // Remove filler words for compression
    let t = text.replace(/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by|from|this|that|these|those|it|its)\b/gi, '').replace(/\s+/g, ' ').trim();
    if (t.length > maxLen) t = t.slice(0, maxLen - 2) + '..';
    return t;
  }
}
