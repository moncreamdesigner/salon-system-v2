import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const source = read("pwa.js");
function setup({ standalone = false, iosStandalone = false, hasButton = true } = {}) {
  const events = new Map();
  const buttonEvents = new Map();
  const modeEvents = new Map();
  const button = { hidden: true, disabled: false, addEventListener: (name, fn) => buttonEvents.set(name, fn) };
  const mode = { matches: standalone, addEventListener: (name, fn) => modeEvents.set(name, fn) };
  const window = { matchMedia: () => mode, navigator: { standalone: iosStandalone }, addEventListener: (name, fn) => events.set(name, fn) };
  vm.runInNewContext(source, { window, document: { getElementById: () => hasButton ? button : null }, console: { warn() {} } });
  return { button, mode, fire: (name, event = {}) => events.get(name)?.(event), click: () => buttonEvents.get("click")?.(), changeMode: () => modeEvents.get("change")?.() };
}
function promptEvent(outcome = "dismissed") {
  return { prevented: false, prompts: 0, preventDefault() { this.prevented = true; }, async prompt() { this.prompts++; }, userChoice: Promise.resolve({ outcome }) };
}

test("manifest installs the authenticated salon app, not the public booking page", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.equal(manifest.id, "/login");
  assert.equal(manifest.start_url, "/login");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.name, "Халгай салбар");
  assert.equal(manifest.prefer_related_applications, false);
  assert.match(read("index.html"), /rel="manifest" href="manifest\.webmanifest"/);
  assert.doesNotMatch(read("booking.html"), /rel="manifest"|pwa\.js/);
});

test("installed title bar and launch background match the light gray application canvas", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  const canvasColor = read("styles.css").match(/--bg:\s*(#[0-9a-f]+);/i)?.[1];
  assert.equal(manifest.theme_color, canvasColor);
  assert.equal(manifest.background_color, canvasColor);
  assert.equal(read("index.html").match(/name="theme-color" content="([^"]+)"/)?.[1], canvasColor);
});

test("both app icons are real PNGs of the declared dimensions", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.deepEqual(manifest.icons.map(icon => icon.sizes), ["192x192", "512x512"]);
  for (const icon of manifest.icons) {
    assert.match(icon.src, /app-icon-rounded-(192|512)\.png$/, "New icon URLs avoid reusing the old square icon cache");
    const bytes = fs.readFileSync(new URL(`../${icon.src}`, import.meta.url));
    assert.equal(bytes.subarray(1, 4).toString(), "PNG");
    assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`, icon.sizes);
    assert.equal(bytes[25], 6, "PNG must retain alpha for transparent outer corners");
  }
  const builder = read("scripts/build-app-icons.ps1");
  assert.match(builder, /Clear\(\[System\.Drawing\.Color\]::Transparent\)/);
  assert.equal((builder.match(/backgroundPath\.AddArc\(/g) || []).length, 4);
  assert.match(builder, /FillPath\(\[System\.Drawing\.Brushes\]::White/);
});

test("the install control is hidden in unsupported browsers and prompts only after a user click", async () => {
  const ui = setup();
  assert.equal(ui.button.hidden, true);
  await ui.click();
  const event = promptEvent();
  ui.fire("beforeinstallprompt", event);
  assert.equal(event.prevented, true);
  assert.equal(event.prompts, 0);
  assert.equal(ui.button.hidden, false);
  await ui.click();
  assert.equal(event.prompts, 1);
  assert.equal(ui.button.hidden, true);
  await ui.click();
  assert.equal(event.prompts, 1, "A consumed browser prompt must not be reused");
});

test("accepted installation and appinstalled both remove the install button", async () => {
  const ui = setup();
  ui.fire("beforeinstallprompt", promptEvent("accepted"));
  await ui.click();
  assert.equal(ui.button.hidden, true);
  ui.fire("beforeinstallprompt", promptEvent());
  assert.equal(ui.button.hidden, true);
  const second = setup();
  second.fire("beforeinstallprompt", promptEvent());
  second.fire("appinstalled");
  assert.equal(second.button.hidden, true);
});

test("installed and standalone windows never show another installation prompt", () => {
  for (const options of [{ standalone: true }, { iosStandalone: true }]) {
    const ui = setup(options);
    const event = promptEvent();
    ui.fire("beforeinstallprompt", event);
    assert.equal(event.prevented, false);
    assert.equal(ui.button.hidden, true);
  }
  const ui = setup();
  ui.fire("beforeinstallprompt", promptEvent());
  ui.mode.matches = true;
  ui.changeMode();
  assert.equal(ui.button.hidden, true);
});

test("parallel clicks, cancelled prompts and browser errors do not interfere with the application", async () => {
  const ui = setup();
  let finish;
  const event = promptEvent();
  event.userChoice = new Promise(resolve => { finish = resolve; });
  ui.fire("beforeinstallprompt", event);
  const first = ui.click();
  await ui.click();
  assert.equal(event.prompts, 1);
  assert.equal(ui.button.disabled, true);
  finish({ outcome: "dismissed" });
  await first;
  assert.equal(ui.button.disabled, false);
  const failing = promptEvent();
  failing.prompt = async () => { throw new Error("Browser denied prompt"); };
  ui.fire("beforeinstallprompt", failing);
  await assert.doesNotReject(ui.click());
  assert.equal(ui.button.hidden, true);
  assert.doesNotThrow(() => setup({ hasButton: false }));
});

test("installation adds no operational caching, network polling or permission changes", () => {
  assert.doesNotMatch(source, /serviceWorker\s*\.|caches\s*\.|localStorage|sessionStorage|indexedDB|\bfetch\s*\(|setInterval|location\.(?:reload|replace)|Notification\.requestPermission/);
  assert.match(read("index.html"), /id="installAppButton"[^>]*hidden>/);
  assert.match(read(".htaccess"), /AddType application\/manifest\+json \.webmanifest/);
  assert.match(read(".htaccess"), /<Files "manifest.webmanifest">[\s\S]*?no-store/);
  assert.match(read(".htaccess"), /RewriteRule \^scripts\(\?:\/\|\$\) - \[F,L,NC\]/);
});
