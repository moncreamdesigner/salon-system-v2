import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const styleSource = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("active treatment cards render the customer phone", () => {
  assert.match(appSource, /class="active-treatment-name-row"/);
  assert.match(appSource, /htmlSafe\(customer\.phone \|\| "Утасгүй"\)/);
  assert.match(appSource, /class="active-treatment-service"/);
  assert.match(styleSource, /\.active-treatment-card\.is-collapsed \.active-treatment-service/);
  assert.doesNotMatch(styleSource, /\.active-treatment-card\.is-collapsed \.active-treatment-copy > span/);
});

test("profile group members open their customer profile without hijacking remove", () => {
  assert.match(appSource, /class="profile-group-member-open"/);
  assert.match(appSource, /document\.querySelectorAll\("\.profile-group-member-open"\)/);
  assert.match(appSource, /state\.selectedCustomerId = memberId;\s+setView\("profile"\);/);
  assert.match(appSource, /class="danger-btn icon-clear group-member-remove"/);
  assert.match(styleSource, /\.profile-group-member-open:hover/);
});
