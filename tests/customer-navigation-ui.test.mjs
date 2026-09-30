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

test("customer creation and phone edits reject an existing active phone", () => {
  assert.match(appSource, /function normalizedCustomerPhone\(/);
  assert.match(appSource, /function activeCustomerWithPhone\(/);
  assert.match(appSource, /function rejectDuplicateCustomerPhone\(/);
  assert.match(appSource, /if \(rejectDuplicateCustomerPhone\(phone\)\) return;/);
  assert.match(appSource, /if \(rejectDuplicateCustomerPhone\(phone, customer\.id\)\) return;/);
  assert.match(appSource, /error\.payload\?\.duplicatePhone/);
});

test("admin customer phone edits keep the group bonus and sync the group name", () => {
  const profileHandler = appSource.slice(
    appSource.indexOf("function bindProfileInfoForm(customer)"),
    appSource.indexOf("async function deleteProfileCustomer", appSource.indexOf("function bindProfileInfoForm(customer)"))
  );
  assert.match(profileHandler, /const adminGroup = state\.customerGroups\.find\(group => Number\(group\.adminCustomerId\) === Number\(customer\.id\)\)/);
  assert.match(profileHandler, /adminGroup\.name = customer\.phone;/);
  assert.match(profileHandler, /saveAndRefreshCustomerProfile\(message, \{ groupIds: adminGroup \? \[adminGroup\.id\] : \[\] \}\)/);
  assert.doesNotMatch(profileHandler, /bonusPool\s*=\s*0|usedBonus\s*=\s*0|spent2y\s*=\s*0|customer\.groupId\s*=\s*null/);
});
