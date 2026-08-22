import assert from "node:assert/strict";
import fs from "node:fs";

const revisionApi = fs.readFileSync(new URL("../api/revision.php", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

assert.match(revisionApi, /\$_GET\['sections'\]/, "Revision endpoint accepts a bounded section request");
assert.match(revisionApi, /SELECT section_key, revision FROM app_sections/, "Revision check reads metadata without downloading payloads");
assert.match(revisionApi, /'sectionRevisions' => \$sectionRevisions/, "Revision endpoint returns per-section versions");
assert.match(app, /\}, 60000\);/, "Background revision checks are limited to once per minute");

console.log("section-revision-endpoint.test: OK");
