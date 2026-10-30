import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

// Issue #5 (plan.md § 2d). Route tests for the digest page (#2) and JSON (#3).
// A temp runs dir: runs/ is read-only fixtures.
const runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
writeFileSync(join(runsDir, '2026-11-01.jsonl'), '');
writeFileSync(
  join(runsDir, '2026-11-02.jsonl'),
  '{ this line does not parse\n{"at":"2026-11-02T01:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}\n',
);

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

const config = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir,
};

describe('GET /digest/:night', () => {
  it('200 with rows for a night that has them', async () => {
    const res = await createApp(config).request('/digest/2026-11-02');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('lane/sync');
    expect(html).toContain('1 line did not parse.');
  });

  it('404 for a night with no file', async () => {
    const res = await createApp(config).request('/digest/2099-01-01');
    expect(res.status).toBe(404);
  });

  it('empty file renders "nothing ran"', async () => {
    const res = await createApp(config).request('/digest/2026-11-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });
});

describe('GET /api/digest/:night', () => {
  it('200 with rows and the bad-line count', async () => {
    const res = await createApp(config).request('/api/digest/2026-11-02');
    const body = (await res.json()) as { rows: unknown[]; badLines: number };
    expect(res.status).toBe(200);
    expect(body.rows).toHaveLength(1);
    expect(body.badLines).toBe(1);
  });

  it('404 for a night with no file', async () => {
    const res = await createApp(config).request('/api/digest/2099-01-01');
    expect(res.status).toBe(404);
  });

  it('empty night returns no rows', async () => {
    const res = await createApp(config).request('/api/digest/2026-11-01');
    const body = (await res.json()) as { rows: unknown[] };
    expect(res.status).toBe(200);
    expect(body.rows).toHaveLength(0);
  });

  it('page and JSON agree on jobs and order', async () => {
    // Reads the real fixture night (runs/ is read-only, reading it is fine).
    const fixture = { ...config, runsDir: 'runs' };
    const app = createApp(fixture);
    const json = (await (await app.request('/api/digest/2026-10-28')).json()) as {
      rows: { job: string }[];
    };
    const html = await (await app.request('/digest/2026-10-28')).text();
    const jobs = json.rows.map((r) => r.job);
    const positions = jobs.map((job) => html.indexOf(`<td>${job}</td>`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions.every((p, i) => i === 0 || p > positions[i - 1])).toBe(true);
  });
});
