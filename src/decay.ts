import { StorageEngine } from './storage';
import { DecayConfig, DEFAULT_DECAY_CONFIG } from './types';

/**
 * Time-based and importance-based memory pruning.
 * Memories decay over time unless frequently accessed.
 */
export class DecayManager {
  private storage: StorageEngine;
  private config: DecayConfig;

  constructor(storage: StorageEngine, config: Partial<DecayConfig> = {}) {
    this.storage = storage;
    this.config = { ...DEFAULT_DECAY_CONFIG, ...config };
  }

  /**
   * Apply decay to all memories and prune those below threshold
   */
  decay(): { decayed: number; pruned: number } {
    const all = this.storage.all();
    const now = Date.now();
    let decayed = 0;
    let pruned = 0;

    for (const snapshot of all) {
      const ageMs = now - new Date(snapshot.createdAt).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      
      // Exponential decay: importance * 0.5^(age/halfLife)
      const decayFactor = Math.pow(0.5, ageDays / this.config.halfLifeDays);
      
      // Access boost: each access adds a fraction back
      const accessBonus = Math.min(snapshot.accessCount * this.config.accessBoost, 0.5);
      
      const newImportance = Math.min(snapshot.importance * decayFactor + accessBonus, 1);

      if (newImportance < this.config.minImportance) {
        this.storage.delete(snapshot.id);
        pruned++;
      } else if (newImportance !== snapshot.importance) {
        snapshot.importance = newImportance;
        this.storage.save(snapshot);
        decayed++;
      }
    }

    // Enforce max snapshots cap
    const total = this.storage.count();
    if (total > this.config.maxSnapshots) {
      const excess = this.storage.query({ limit: total }).slice(this.config.maxSnapshots);
      for (const s of excess) {
        this.storage.delete(s.id);
        pruned++;
      }
    }

    return { decayed, pruned };
  }
}
