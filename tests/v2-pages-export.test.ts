/**
 * v2 regression: static export & GitHub Pages base-path asset integrity.
 *
 * This test verifies the BUILT artifact when ./out exists (i.e. after
 * `npm run build:pages`). When there is no build output it reports itself
 * as skipped — it never claims a pass it did not perform.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.cwd(), 'out');

test('static export: index.html references only base-pathed assets that exist', (t) => {
  if (!fs.existsSync(path.join(OUT, 'index.html'))) {
    t.skip('no ./out directory — run `npm run build:pages` first (build script enforces the same check)');
    return;
  }
  const html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
  assert.ok(html.length > 500, 'index.html has content');

  const refs = [...html.matchAll(/(?:href|src)="(\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length > 0, 'page references assets');

  const rootRefs = refs.filter((r) => r.startsWith('/_next/'));
  assert.equal(rootRefs.length, 0, 'no asset may bypass the /nutrilens base path');

  for (const ref of refs) {
    if (!ref.startsWith('/nutrilens/')) continue;
    const file = path.join(OUT, ref.replace('/nutrilens/', '').split('?')[0]);
    assert.ok(fs.existsSync(file), `asset must exist in export: ${ref}`);
  }
});
