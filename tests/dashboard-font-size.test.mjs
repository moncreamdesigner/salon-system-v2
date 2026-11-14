import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const css = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
test('dashboard small text uses the same size token as system inputs', () => {
  assert.match(css, /--input-text-size:\s*13px/);
  let checked = 0;
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selector.includes('.dashboard-') || selector.includes('.dashboard-filter-fields label')) continue;
    assert.doesNotMatch(body, /font-size:\s*(10|11|12)px/, selector.trim());
    if (body.includes('font-size: var(--input-text-size)')) checked++;
  }
  assert.ok(checked >= 25);
  // Headings and headline values retain their existing hierarchy.
  assert.match(css, /\.dashboard-card-head h3\s*\{[^}]*font-size:\s*15px/s);
  assert.match(css, /\.dashboard-kpi > strong\s*\{[^}]*font-size:\s*clamp\(18px, 1.45vw, 24px\)/s);
});
