import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, JobStatus, Night } from './types.js';

// One parsed line of runs/<night>.jsonl.
type RunEvent = {
  at: string;
  job: string;
  status: JobStatus;
  owner: string | null;
  error: string | null;
};

const NIGHT_RE = /^\d{4}-\d{2}-\d{2}$/;

// Parse one line; null when it doesn't parse. Never throws.
function parseLine(line: string): RunEvent | null {
  let o: unknown;
  try {
    o = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof o !== 'object' || o === null) return null;
  const e = o as Record<string, unknown>;
  if (typeof e.at !== 'string' || typeof e.job !== 'string') return null;
  if (e.status !== 'ok' && e.status !== 'retry' && e.status !== 'fail') return null;
  return {
    at: e.at,
    job: e.job,
    status: e.status,
    owner: typeof e.owner === 'string' ? e.owner : null,
    error: typeof e.error === 'string' ? e.error : null,
  };
}

// Read runs/<night>.jsonl into one row per job, sorted by job.
// A line that doesn't parse is counted, never thrown. null when there is no such file.
export function readNight(runsDir: string, night: string): Night | null {
  if (!NIGHT_RE.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }

  const byJob = new Map<string, RunEvent[]>();
  let badLines = 0;
  const counts = { ok: 0, retry: 0, fail: 0 };

  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const ev = parseLine(line);
    if (ev === null) {
      badLines++;
      continue;
    }
    counts[ev.status]++;
    const events = byJob.get(ev.job);
    if (events) events.push(ev);
    else byJob.set(ev.job, [ev]);
  }

  const rows: DigestRow[] = [];
  for (const [job, events] of byJob) {
    const last = events[events.length - 1];
    const lastError = [...events].reverse().find((e) => e.error !== null)?.error ?? null;
    rows.push({
      job,
      owner: last.owner,
      runs: events.length,
      retries: events.filter((e) => e.status === 'retry').length,
      lastStatus: last.status,
      lastError,
      firstAt: events[0].at,
      lastAt: last.at,
    });
  }
  rows.sort((a, b) => (a.job < b.job ? -1 : 1));

  return { rows, badLines, counts };
}
