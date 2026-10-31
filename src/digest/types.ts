export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job in a night's run log. Times keep the offset from the log.
export type DigestRow = {
  job: string;
  owner: string | null; // shown as "—" when null
  runs: number; // lines for this job
  retries: number; // lines with status "retry"
  lastStatus: RunStatus;
  lastError: string | null;
  first: string;
  last: string;
};

export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job; the page and the JSON both use this order
  badLines: number; // lines that did not parse, counted and never thrown
};

// Returns null when runs/<night>.jsonl does not exist (the route answers 404).
// An empty file returns a Night with no rows.
export type ReadNight = (runsDir: string, night: string) => Night | null;
