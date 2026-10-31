import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/reader.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestView } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

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

  // Same rows, same order as the page (ADR 0001): both come from readNight.
  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return c.json({ error: 'not found' }, 404);
    const result = readNight(config.runsDir, night);
    if (result === null) return c.json({ error: 'not found' }, 404);
    return c.json(result.rows);
  });

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    const found = NIGHT.test(night) ? readNight(config.runsDir, night) : null;
    if (found === null) {
      return c.html(
        <Layout title="digest" lane={lane()}>
          <h1>not found</h1>
          <p class="mute">no run log for {night}</p>
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title="digest" lane={lane()}>
        <DigestView night={found} />
      </Layout>,
    );
  });

  return app;
}
