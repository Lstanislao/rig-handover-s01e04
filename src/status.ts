import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight } from './digest/reader.js';
import type { Night } from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

// Jobs per lastStatus in one night. null in a NightEntry when the night can't be read.
export type NightCounts = { ok: number; retry: number; fail: number };

export type NightEntry = {
  night: string;
  counts: NightCounts | null;
};

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightEntry[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

// Counts jobs (one per row) by their lastStatus. A missing night has no counts.
export function countNight(night: Night | null): NightCounts | null {
  if (night === null) return null;
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const row of night.rows) counts[row.lastStatus] += 1;
  return counts;
}

function entryFor(runsDir: string, night: string): NightEntry {
  try {
    return { night, counts: countNight(readNight(runsDir, night)) };
  } catch {
    return { night, counts: null };
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((n) => entryFor(config.runsDir, n)),
  };
}
