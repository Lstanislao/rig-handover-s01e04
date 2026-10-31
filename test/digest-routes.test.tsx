import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow } from '../src/digest/types.js';

// Routes are tested against a temp runs dir; runs/ is read-only fixtures and is never touched.
let base: string;
let runsDir: string;

const config = (dir: string) => ({
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: dir,
});

const GOOD_NIGHT = [
  '{"at":"2026-10-28T23:00:06+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
  '{"at":"2026-10-28T04:00:01+01:00","job":"notes/backup","status":"fail","owner":"lane-07","error":"quota exceeded"}',
  '{"at":"2026-10-28T23:30:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook","error":"upstream 503"}',
  '{"at":"2026-10-28T23:31:00+01:00","job":"fixtures/refresh","status":"ok","owner":"rook"}',
];

const EXPECTED_ROWS: DigestRow[] = [
  {
    job: 'fixtures/refresh',
    owner: 'rook',
    runs: 2,
    retries: 1,
    lastStatus: 'ok',
    lastError: null,
    first: '2026-10-28T23:30:00+01:00',
    last: '2026-10-28T23:31:00+01:00',
  },
  {
    job: 'lane/sync',
    owner: 'rook',
    runs: 1,
    retries: 0,
    lastStatus: 'ok',
    lastError: null,
    first: '2026-10-28T23:00:06+01:00',
    last: '2026-10-28T23:00:06+01:00',
  },
  {
    job: 'notes/backup',
    owner: 'lane-07',
    runs: 1,
    retries: 0,
    lastStatus: 'fail',
    lastError: 'quota exceeded',
    first: '2026-10-28T04:00:01+01:00',
    last: '2026-10-28T04:00:01+01:00',
  },
];

function writeNight(night: string, lines: string[]) {
  writeFileSync(join(runsDir, `${night}.jsonl`), lines.join('\n') + (lines.length ? '\n' : ''));
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  runsDir = join(base, 'runs');
  mkdirSync(runsDir);
  writeNight('2026-10-28', GOOD_NIGHT);
  writeNight('2026-10-30', []);
  writeNight('2026-10-29', [
    '{"at":"2026-10-29T05:00:04+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
    'not json',
    '{"at":"2026-10-29T05:41:09+01:00","job":"digest/render","status":"ok","owner":null}',
  ]);
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('GET /digest/:night (page)', () => {
  it('200 for a normal night and shows every job', async () => {
    const res = await createApp(config(runsDir)).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest · 2026-10-28');
    for (const row of EXPECTED_ROWS) expect(html).toContain(`>${row.job}</td>`);
  });

  it('404 for a night with no file', async () => {
    const res = await createApp(config(runsDir)).request('/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no run log for 2026-01-01');
  });

  it('200 for an empty night and says nothing ran', async () => {
    const res = await createApp(config(runsDir)).request('/digest/2026-10-30');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });

  it('200 with a bad line, keeps the good jobs and counts the bad one', async () => {
    const res = await createApp(config(runsDir)).request('/digest/2026-10-29');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('>lane/sync</td>');
    expect(html).toContain('>digest/render</td>');
    expect(html).toContain('1 unreadable line skipped');
  });

  it('404 for a malformed night, even when a file exists at the traversal target', async () => {
    writeFileSync(join(base, 'x.jsonl'), GOOD_NIGHT[0] + '\n');
    const res = await createApp(config(runsDir)).request('/digest/..%2Fx');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/digest/:night (JSON)', () => {
  it('200 for a normal night with the rows', async () => {
    const res = await createApp(config(runsDir)).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    expect((await res.json()) as DigestRow[]).toEqual(EXPECTED_ROWS);
  });

  it('404 for a night with no file', async () => {
    const res = await createApp(config(runsDir)).request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not found' });
  });

  it('200 with [] for an empty night', async () => {
    const res = await createApp(config(runsDir)).request('/api/digest/2026-10-30');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('200 with a bad line, returns only the good rows', async () => {
    const res = await createApp(config(runsDir)).request('/api/digest/2026-10-29');
    expect(res.status).toBe(200);
    const rows = (await res.json()) as DigestRow[];
    expect(rows.map((r) => r.job)).toEqual(['digest/render', 'lane/sync']);
  });

  it('404 for a malformed night, even when a file exists at the traversal target', async () => {
    writeFileSync(join(base, 'x.jsonl'), GOOD_NIGHT[0] + '\n');
    const res = await createApp(config(runsDir)).request('/api/digest/..%2Fx');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not found' });
  });
});

describe('page and JSON agree (ADR 0001)', () => {
  it('list the same jobs in the same order', async () => {
    const app = createApp(config(runsDir));
    const page = await (await app.request('/digest/2026-10-29')).text();
    const json = (await (await app.request('/api/digest/2026-10-29')).json()) as DigestRow[];

    const positions = json.map((r) => page.indexOf(`>${r.job}</td>`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(json.map((r) => r.job)).toEqual(['digest/render', 'lane/sync']);
  });
});
