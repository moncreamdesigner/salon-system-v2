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
  assert.match(css, /input:not\(\[type="checkbox"\], \[type="radio"\]/);
  assert.match(css, /label:not\(\.primary-btn, \.secondary-btn, \.danger-btn, \.branch-file-btn\)/);
  assert.doesNotMatch(css, /\n\s*(?:input|select|textarea)\s*\{/);
  assert.doesNotMatch(css, /height:|width:|padding:/);
});
