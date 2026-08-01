import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const styleSource = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("kass schedule editing opens inside the selected table row", () => {
  assert.match(appSource, /function kassInlineEditMarkup\(item\)/);
  assert.match(appSource, /class="kass-inline-edit-form" data-id="\$\{item\.id\}"/);
  assert.match(appSource, /\$\{editing \? kassInlineEditMarkup\(item\) : ""\}/);
  assert.match(appSource, /kassInlineEditingId = id;\s+renderKassSchedule\(\);/);
  assert.doesNotMatch(appSource, /function editKassSchedule\(id\)[\s\S]+?document\.getElementById\("kassStartDate"\)\.value = item\.date/);
});

test("inline kass schedule form saves and cancels locally", () => {
  assert.match(appSource, /form\.addEventListener\("submit", event => saveInlineKassSchedule\(event, id\)\)/);
  assert.match(appSource, /function saveInlineKassSchedule\(event, id\)/);
  assert.match(appSource, /class="secondary-btn icon-action kass-inline-cancel"/);
  assert.match(styleSource, /\.kass-inline-edit-form\s*\{[\s\S]+?grid-template-columns:/);
  assert.match(styleSource, /\.kass-table \.kass-inline-edit-row td/);
});
