import fs from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const css = read("form-fields.css");

test("all pages share one field-title stylesheet and canonical medium typography", () => {
  for (const page of ["index.html", "booking.html"]) assert.match(read(page), /href="form-fields\.css\?v=/);
  assert.match(css, /--field-label-weight: 500;/);
  assert.match(css, /--field-label-size: 12px;/);
  assert.match(css, /--field-label-color: #717771;/);
  for (const property of ["font-size", "font-weight", "color"]) assert.match(css, new RegExp(`${property}: var\\(--field-label-[a-z]+\\) !important`));
  assert.match(css, /\.branch-field-label, \.homepage-field-label/);
  assert.match(css, /select, textarea/);
});

test("shared title styling excludes checkbox/radio captions and upload button labels", () => {
  const titles = css.slice(css.indexOf("@layer field-titles"), css.indexOf("@layer checkbox-controls"));
  assert.match(css, /input:not\(\[type="checkbox"\], \[type="radio"\]/);
  assert.match(css, /label:not\(\.primary-btn, \.secondary-btn, \.danger-btn, \.branch-file-btn\)/);
  assert.doesNotMatch(css, /\n\s*(?:input|select|textarea)\s*\{/);
  assert.doesNotMatch(titles, /height:|width:|padding:/);
});

test("custom dropdown labels share the same medium title rules", () => {
  assert.match(css, /label:not\([^\n]+\):has\(\.custom-select, \.native-select-proxy, \.schedule-time-proxy, \[role="combobox"\]\)/);
});

test("all checkbox variants share one green background, white check and accessible states", () => {
  assert.match(css, /--checkbox-check: url\([^\n]+stroke='%23fff'/);
  assert.match(css, /input\[type="checkbox"\]:checked\s*\{[^}]*background-color: var\(--checkbox-color\)/);
  assert.match(css, /input\[type="checkbox"\]:indeterminate/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /:disabled/);
  assert.match(css, /forced-colors: active/);
  const controls = css.slice(css.indexOf("@layer checkbox-controls"));
  assert.doesNotMatch(controls, /\bdisplay\s*:/, "Hidden checkbox-based controls must stay hidden");
});

test("bold typography is capped at the shared 600 weight without changing normal or medium text", () => {
  assert.match(css, /--font-weight-strong: 600;/);
  assert.match(css, /b, strong, h1, h2, h3, h4, h5, h6, th \{ font-weight: var\(--font-weight-strong\)/);
  for (const file of ["styles.css", "public.css", "app.js"]) {
    assert.doesNotMatch(read(file), /font-weight:\s*(?:6[1-9]\d|[7-9]\d{2}|bold|bolder)\b/);
  }
  assert.match(read("styles.css"), /font-weight: 400;/);
  assert.match(css, /--field-label-weight: 500;/);
});
