/**
 * Core types for claude-mem-pattern
 */

export interface MemorySnapshot {
  id: string;
  sessionId: string;
  facts: string[];
  decisions: string[];
  context: Record<string, unknown>;
  importance: number; // 0-1
  createdAt: string;  // ISO timestamp
  lastAccessed: string;
  accessCount: number;
  aaak?: string; // compressed AAAK representation
}

export interface MemoryQuery {
  sessionId?: string;
  minImportance?: number;
  limit?: number;
  before?: string;
  after?: string;
  keyword?: string;
}

export interface DecayConfig {
  halfLifeDays: number;       // importance halves every N days
  minImportance: number;      // prune below this threshold
  accessBoost: number;        // importance boost per access (0-1)
  maxSnapshots: number;       // hard cap on stored snapshots
}

export interface CompressorOptions {
  maxFacts: number;
  maxDecisions: number;
  aaakFormat: boolean;
}

export const DEFAULT_DECAY_CONFIG: DecayConfig = {
  halfLifeDays: 30,
  minImportance: 0.05,
  accessBoost: 0.1,
  maxSnapshots: 1000,
};

export const DEFAULT_COMPRESSOR_OPTIONS: CompressorOptions = {
  maxFacts: 50,
  maxDecisions: 20,
  aaakFormat: true,
};
