import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const htmlSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("new gift cards use the entered expiry date or remain unlimited", () => {
  assert.match(appSource, /const expiryDate = document\.getElementById\("giftCardExpiry"\)\.value \|\| "";/);
  assert.match(appSource, /card\.expiryDate \|\| "Хугацаагүй"/);
  assert.match(appSource, /: " · Хугацаагүй"/);
  assert.doesNotMatch(appSource, /dateAfterCalendarMonths/);
  assert.doesNotMatch(htmlSource, /Анхны хугацаа бүртгэсэн өдрөөс 6 сар байна\./);
});

test("expired gift cards remain editable only while completely unused", () => {
  assert.match(appSource, /function giftCardCanEdit\(card\)[\s\S]+?usage\.length === 0/);
  assert.match(appSource, /Number\(card\?\.remainingAmount \|\| 0\) === Number\(card\?\.amount \|\| 0\)/);
  assert.doesNotMatch(appSource, /function giftCardCanEdit\(card\) \{\s+return giftCardStatus\(card\) === "fresh";/);
});

test("gift card edit and delete actions require their security codes", () => {
  assert.match(appSource, /async function editGiftCard\(id\)[\s\S]+?if \(!await requireEditCode\(\)\) return;/);
  assert.match(appSource, /async function deleteGiftCard\(id\)[\s\S]+?if \(!await requireDeleteCode\(\)\) return;/);
});

test("gift cards use unique ids and replay disjoint concurrent changes", () => {
  assert.match(appSource, /id: entityId\("gift-card"\)/);
  assert.doesNotMatch(appSource, /id: nextId\(state\.giftCards\)/);
  assert.match(appSource, /function registerPendingGiftCardMutation/);
  assert.match(appSource, /function replayPendingGiftCardMutations/);
  assert.match(appSource, /markPendingGiftCardSections\(\);/);
});
