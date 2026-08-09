import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../booking.html", import.meta.url), "utf8");
const adminHtml = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const publicSource = fs.readFileSync(new URL("../public.js", import.meta.url), "utf8");
const htaccess = fs.readFileSync(new URL("../.htaccess", import.meta.url), "utf8");
const version = JSON.parse(fs.readFileSync(new URL("../version.json", import.meta.url), "utf8")).version;

test("public page never reloads itself to synchronize the admin build", () => {
  assert.doesNotMatch(html, /version\.json/);
  assert.doesNotMatch(html, /window\.location\.reload\s*\(/);
});

test("public asset versions match the public HTML build", () => {
  const build = html.match(/name="app-build" content="([^"]+)"/)?.[1];
  assert.ok(build, "Public build metadata is required");
  const assetVersions = [...html.matchAll(/(?:href|src)="[^"]+\.(?:css|js)\?v=([^"]+)"/g)].map(match => match[1]);
  assert.ok(assetVersions.length >= 4);
  assert.ok(assetVersions.every(assetVersion => assetVersion === build));
});

test("admin build, assets and server version stay synchronized", () => {
  const build = adminHtml.match(/name="app-build" content="([^"]+)"/)?.[1];
  assert.equal(build, version);
  const assetVersions = [...adminHtml.matchAll(/(?:href|src)="[^"]+\.(?:css|js)\?v=([^"]+)"/g)].map(match => match[1]);
  assert.ok(assetVersions.length >= 4);
  assert.ok(assetVersions.every(assetVersion => assetVersion === build));
});

test("initialization loads data once and renders only the selected view", () => {
  const initializer = publicSource.slice(publicSource.indexOf("async function initializePublicApp("));
  assert.equal((initializer.match(/await loadPublicData\(\)/g) || []).length, 1);
  assert.doesNotMatch(initializer, /renderCatalog\(\);\s*renderSalonDirectory\(\);\s*renderResults\(\);/);
  assert.match(initializer, /setPublicView\(restoredView, \{ historyMode: "replace", scroll: false, refresh: false \}\)/);
});

test("concurrent public refreshes share one API request", () => {
  assert.match(publicSource, /if \(publicDataRequest\) return publicDataRequest;/);
  assert.match(publicSource, /finally \{\s*publicDataRequest = null;/);
});

test("catalog refresh does not recreate an unchanged third-party iframe", () => {
  assert.match(publicSource, /signature === renderedCatalogSignature && document\.querySelector\("#catalogStage #flipOuter"\)/);
});

test("versioned scripts and styles are immutable while HTML and JSON revalidate", () => {
  assert.match(htaccess, /<FilesMatch "\\\.\(html\|json\)\$">[\s\S]*?no-cache, max-age=0, must-revalidate/);
  assert.match(htaccess, /<FilesMatch "\\\.\(css\|js\)\$">[\s\S]*?public, max-age=31536000, immutable/);
});
