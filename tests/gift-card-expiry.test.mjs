import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const htmlSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

const paymentContext = vm.createContext({ giftCardStatus: card => card.status });
vm.runInContext(appSource.slice(appSource.indexOf("function giftCardPaymentLimit("), appSource.indexOf("function giftCardPaymentMessage(")), paymentContext);

test("a smaller gift card offers a partial payment without changing its balance", () => {
  const card = { status: "fresh", remainingAmount: 50000 };
  const amount = paymentContext.giftCardPaymentLimit(card, 75000);
  assert.equal(amount, 50000);
  assert.equal(75000 - amount, 25000);
  assert.equal(card.remainingAmount, 50000);
});

test("gift card payment respects smaller debts and balance after bonuses", () => {
  const card = { status: "partial", remainingAmount: 50000 };
  assert.equal(paymentContext.giftCardPaymentLimit(card, 20000), 20000);
  assert.equal(paymentContext.giftCardPaymentLimit(card, 75000 - 30000), 45000);
  assert.equal(paymentContext.giftCardPaymentLimit(card, 0), 0);
  assert.equal(paymentContext.giftCardPaymentLimit(card, -100), 0);
});

test("unavailable gift cards never offer a payment", () => {
  assert.equal(paymentContext.giftCardPaymentLimit(null, 75000), 0);
  for (const status of ["used", "expired", "inactive"]) {
    assert.equal(paymentContext.giftCardPaymentLimit({ status, remainingAmount: 50000 }, 75000), 0);
  }
});

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
