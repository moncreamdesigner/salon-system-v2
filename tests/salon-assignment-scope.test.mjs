import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const stateApiSource = fs.readFileSync(new URL("../api/state.php", import.meta.url), "utf8");

function functionSource(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = appSource.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    if (appSource[index] === "{") depth += 1;
    if (appSource[index] === "}") depth -= 1;
    if (depth === 0) return appSource.slice(start, index + 1);
  }
  throw new Error(`${name} body is incomplete`);
}

const assignmentContext = {
  activeAccount: { role: "salon", salon: "Хан-Уул салбар" }
};
vm.createContext(assignmentContext);
vm.runInContext(`function isSalonAccount() { return activeAccount.role === "salon"; }\n${functionSource("assignmentCanBeManaged")}\n${functionSource("assignmentIsVisibleToAccount")}`, assignmentContext);

test("salon accounts can persist assignments that involve their salon", () => {
  assert.match(stateApiSource, /foreach \(\['bookings', 'kassSchedules', 'services', 'holidays', 'assignments'/);
  assert.doesNotMatch(stateApiSource, /\$restricted = \[[^\]]*'assignments'/);
  assert.match(stateApiSource, /if \(\$section === 'assignments'\) return \(\$item\['from'\] \?\? ''\) === \$salon \|\| \(\$item\['to'\] \?\? ''\) === \$salon;/);
  assert.match(stateApiSource, /function item_can_be_managed_by_salon[\s\S]*?if \(\$section === 'assignments'\) return \(\$item\['from'\] \?\? ''\) === \$salon;/);
});

test("destination salon can view an assignment but only the home salon can manage it", () => {
  assert.match(appSource, /function assignmentCanBeManaged\(assignment\) \{\s*return !isSalonAccount\(\) \|\| assignment\.from === activeAccount\.salon;/);
  assert.match(appSource, /function assignmentIsVisibleToAccount\(assignment\) \{[\s\S]*?assignment\.from === activeAccount\.salon[\s\S]*?assignment\.to === activeAccount\.salon;/);
  assert.match(appSource, /const filteredAssignments = state\.assignments\s*\.filter\(assignmentIsVisibleToAccount\)/);

  const incoming = { from: "Чингэлтэй салбар", to: "Хан-Уул салбар" };
  const outgoing = { from: "Хан-Уул салбар", to: "Чингэлтэй салбар" };
  assert.equal(assignmentContext.assignmentIsVisibleToAccount(incoming), true);
  assert.equal(assignmentContext.assignmentCanBeManaged(incoming), false);
  assert.equal(assignmentContext.assignmentIsVisibleToAccount(outgoing), true);
  assert.equal(assignmentContext.assignmentCanBeManaged(outgoing), true);
});
