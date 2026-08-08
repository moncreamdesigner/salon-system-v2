import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const htmlSource = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const styleSource = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("voucher reward checkbox uses the short label and aligned layout", () => {
  assert.match(htmlSource, /<span>Урамшуулалд тооцох<\/span>\s*<input id="voucherRoleCashierEligible" type="checkbox">/);
  assert.doesNotMatch(htmlSource, /Кассын урамшуулалд тооцно/);
  assert.match(styleSource, /\.voucher-commission-check\s*\{[\s\S]+?flex-direction: column;[\s\S]+?align-items: flex-start;/);
});

test("employee customer bonus rules are saved from settings instead of being forced", () => {
  assert.match(appSource, /const protectedType = name === "Тусгай хэрэглэгч";/);
  assert.doesNotMatch(appSource, /const protectedType = \["Тусгай хэрэглэгч", "Ажилтан"\]\.includes\(name\)/);
  assert.match(appSource, /typeof currentRule\.dynamic === "boolean" \? currentRule\.dynamic : false/);
  assert.match(appSource, /customer\.type === name[\s\S]+?bonus: `\$\{state\.customerTypeRules\[name\]\.bonusPercent\}%`/);
});

test("branch customer groups are excluded from usage and bonus without deleting history", () => {
  assert.match(appSource, /if \(type === "Салбар"\)[\s\S]+?bonusPercent: 0,[\s\S]+?dynamic: false/);
  assert.match(appSource, /function groupExcludesBonus\(group\)/);
  assert.match(appSource, /function groupBonusInfo\(group\)[\s\S]+?return \{ spent: 0, percent: 0, pool: 0, used: 0, balance: 0 \}/);
  assert.match(appSource, /function applyGroupPayment\(group,[\s\S]+?groupSpentAmount: 0,[\s\S]+?groupBonusEarned: 0/);
});
