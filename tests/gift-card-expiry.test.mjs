import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const htmlSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const dateFunctionSource = appSource.match(/function dateAfterCalendarMonths\(dateText, months = 6\) \{[\s\S]+?\n\}/)?.[0] || "";
const dateAfterCalendarMonths = Function(`${dateFunctionSource}; return dateAfterCalendarMonths;`)();

test("new gift cards default to six calendar months", () => {
  assert.match(appSource, /function dateAfterCalendarMonths\(dateText, months = 6\)/);
  assert.match(appSource, /expiryInput\.value = dateAfterCalendarMonths\(todayText\(\), 6\)/);
  assert.match(appSource, /giftCardExpiry"\)\.value \|\| dateAfterCalendarMonths\(todayText\(\), 6\)/);
  assert.match(htmlSource, /Анхны хугацаа бүртгэсэн өдрөөс 6 сар байна\./);
  assert.equal(dateAfterCalendarMonths("2026-08-01"), "2027-02-01");
  assert.equal(dateAfterCalendarMonths("2026-08-31"), "2027-02-28");
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
