/**
 * src/lib/hackerrank/validate.ts
 *
 * Server-side validation of HackerRank leaderboard entries before staging.
 * Checks required fields, numeric integrity, and intra-set duplicates.
 * Cross-set collision detection happens separately in the sync action.
 */

import type { HackerRankEntry } from './client';
import type { ValidationError } from '@/types/database';

export interface ValidationResult {
  valid: HackerRankEntry[];
  errors: ValidationError[];
  duplicateHandles: string[];
}

export function validateHackerRankEntries(
  entries: HackerRankEntry[],
): ValidationResult {
  const errors: ValidationError[] = [];
  const seen = new Map<string, number>(); // handle → first row index
  const duplicateHandles: string[] = [];
  const valid: HackerRankEntry[] = [];

  entries.forEach((entry, idx) => {
    const row = idx + 1;
    let rowValid = true;

    // 1. Required: hacker username
    if (!entry.hacker || typeof entry.hacker !== 'string' || !entry.hacker.trim()) {
      errors.push({ row, field: 'hacker', message: 'Missing participant username (hacker field)' });
      rowValid = false;
    }

    // 2. Required: score must be a non-negative number
    if (typeof entry.score !== 'number' || isNaN(entry.score)) {
      errors.push({ row, field: 'score', message: `Invalid score value: "${entry.score}"` });
      rowValid = false;
    } else if (entry.score < 0) {
      errors.push({ row, field: 'score', message: `Negative score (${entry.score}) is not allowed` });
      rowValid = false;
    }

    // 3. Optional: problems solved must be non-negative integer if present
    if (entry.solved_challenges !== undefined && entry.solved_challenges < 0) {
      errors.push({ row, field: 'solved_challenges', message: `Negative problems solved: ${entry.solved_challenges}` });
      rowValid = false;
    }

    // 4. Optional: penalty must be non-negative if present
    if (entry.time_taken !== undefined && entry.time_taken < 0) {
      errors.push({ row, field: 'time_taken', message: `Negative penalty value: ${entry.time_taken}` });
      rowValid = false;
    }

    // 5. Intra-set duplicate detection
    const handle = entry.hacker?.toLowerCase().trim();
    if (handle) {
      if (seen.has(handle)) {
        if (!duplicateHandles.includes(handle)) {
          duplicateHandles.push(handle);
          errors.push({
            row,
            field: 'hacker',
            message: `Duplicate participant handle "${entry.hacker}" — first seen at row ${seen.get(handle)}`,
          });
        }
        rowValid = false;
      } else {
        seen.set(handle, row);
      }
    }

    if (rowValid) valid.push(entry);
  });

  return { valid, errors, duplicateHandles };
}
