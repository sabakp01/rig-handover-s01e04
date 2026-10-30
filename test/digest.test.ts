import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('reads 5 jobs and counts the 1 bad line, never throwing', () => {
    expect(night).not.toBeNull();
    expect(night!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night!.badLines).toBe(1);
  });

  it('aggregates runs and retries per job', () => {
    const sync = night!.rows.find((r) => r.job === 'lane/sync')!;
    expect(sync.runs).toBe(8);
    expect(sync.retries).toBe(1);
    expect(sync.lastStatus).toBe('ok');
    expect(sync.lastError).toBe('lock held');

    const refresh = night!.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(refresh.runs).toBe(4);
    expect(refresh.retries).toBe(3);
    expect(refresh.lastStatus).toBe('ok');
    expect(refresh.lastError).toBe('upstream 503');
  });

  it('keeps a failing job with its error', () => {
    const backup = night!.rows.find((r) => r.job === 'notes/backup')!;
    expect(backup.lastStatus).toBe('fail');
    expect(backup.lastError).toBe('quota exceeded');
  });

  it('keeps a null-owner row', () => {
    const digest = night!.rows.find((r) => r.job === 'digest/render')!;
    expect(digest.owner).toBeNull();
  });

  it('counts statuses for the board', () => {
    expect(night!.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('returns null for a night with no file', () => {
    expect(readNight('runs', '2026-01-01')).toBeNull();
  });
});
