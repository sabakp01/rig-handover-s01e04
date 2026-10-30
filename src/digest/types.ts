// Issue #1 (plan.md § 1). Committed first so every part of section 2 can start against it.

export type JobStatus = 'ok' | 'retry' | 'fail';

// One row per job in the night's run log.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: JobStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

// One night read from disk: rows sorted by job, plus how many lines did not parse.
export type NightCounts = { ok: number; retry: number; fail: number };

export type Night = {
  rows: DigestRow[];
  badLines: number;
  counts: NightCounts;
};

// readNight(runsDir, night): the night's rows, or null when there is no such file.
export type ReadNight = (runsDir: string, night: string) => Night | null;
