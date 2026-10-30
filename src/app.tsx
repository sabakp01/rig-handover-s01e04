import { Hono } from 'hono';
import { readNight } from './digest/reader.js';
import { loadConfig, type RigConfig } from './config.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { Layout } from './views/layout.js';
import { DigestPage } from './views/digest.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  // Issue #2 (plan.md § 2a). No file → 404; empty file → "nothing ran".
  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    const read = readNight(config.runsDir, night);
    if (read === null) {
      return c.html(
        <Layout title="digest" lane={lane()}>
          <h1>digest · {night}</h1>
          <p class="warn">no run log for {night}</p>
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={`digest ${night}`} lane={lane()}>
        <DigestPage night={night} read={read} />
      </Layout>,
    );
  });

  // Issue #3 (plan.md § 2b). Same rows as the page, same order — one source, no disagreement (ADR 0001).
  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    const read = readNight(config.runsDir, night);
    if (read === null) return c.json({ night, error: 'no run log' }, 404);
    return c.json({ night, rows: read.rows, badLines: read.badLines, counts: read.counts });
  });

  return app;
}
