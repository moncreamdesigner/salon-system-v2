import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function source(name) {
  const start = app.indexOf(`function ${name}(`);
  const end = app.indexOf('\nfunction ', start + 1);
  const asyncEnd = app.indexOf('\nasync function ', start + 1);
  return (app.slice(start - 6, start) === 'async ' ? 'async ' : '') + app.slice(start, Math.min(...[end, asyncEnd].filter(n => n >= 0)));
}
function setup() {
  const original = { id: 'old', amount: 385000, paidAmount: 385000, method: 'card', date: '2026-11-02' };
  const wrong = { id: 'wrong', amount: 564900, paidAmount: 564900, method: 'transfer', date: '2026-11-18', groupId: 2, groupSpentAmount: 564900, groupBonusEarned: 11298 };
  const visits = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, staff: 'Employee', date: '2026-11-15' }));
  const service = { id: 'course', kind: 'course', title: 'Course', salon: 'A', basePrice: 949900, balance: 0, payments: [wrong, original], visits };
  const customer = { id: 1, name: 'Customer', groupId: 2, serviceHistory: [service], currentTreatment: { historyId: 'course', paymentBalance: 0, stage: 'Төлбөр хаагдсан' } };
  const group = { id: 2, spent2y: 949900, bonusPool: 18998, usedBonus: 0 };
  const c = vm.createContext({
    state: { customers: [customer], selectedCustomerId: 1, customerGroups: [group], audit: [] },
    activeAccount: { salon: 'A' }, pendingPaymentMutations: new Map(), localStateMutationVersion: 0,
    structuredClone, canAccessSalon: () => true, requireOperationalDateEditable: () => true,
    requireDeleteCode: async () => true, customerGroup: () => group, groupExcludesBonus: () => false,
    reverseGiftCardPayment: () => {}, reverseVoucherPayment: () => {}, reverseCustomerCreditPayment: () => {},
    persistPendingPaymentMutations: () => {}, serviceTotalAmount: s => s.basePrice,
    customerBalance: user => user.serviceHistory.reduce((sum, row) => sum + row.balance, 0),
    entityId: () => 'audit-id', auditNowText: () => '2026-11-18', auditActorUsername: () => 'admin',
    money: String, paymentMethodOptionsLabel: String, showToast: message => { c.toast = message; },
    saveAndRefreshCustomerProfile: (message, options) => { c.saved = options; }
  });
  vm.runInContext(source('reverseGroupPayment') + '\n' + source('reverseCustomerHistoryPayment'), c);
  return { c, customer, service, original, visits, group };
}
test('reversing only the erroneous transfer preserves original card payment and all visits', async () => {
  const { c, customer, service, original, visits, group } = setup();
  const beforeVisits = JSON.stringify(visits);
  await c.reverseCustomerHistoryPayment(1, 0, 0);
  assert.equal(service.payments.length, 1);
  assert.equal(service.payments[0], original);
  assert.equal(JSON.stringify(service.visits), beforeVisits);
  assert.equal(service.balance, 564900);
  assert.equal(customer.currentTreatment.paymentBalance, 564900);
  assert.equal(customer.unpaid, true);
  assert.equal(group.spent2y, 385000);
  assert.equal(group.bonusPool, 7700);
  assert.equal(c.saved.auditEntries[0].paymentSnapshot.id, 'wrong');
});
test('reversing the last payment restores the whole unpaid amount without legacy paid fallback', async () => {
  const { c, service } = setup();
  service.payments.splice(1, 1);
  await c.reverseCustomerHistoryPayment(1, 0, 0);
  assert.equal(service.payments.length, 0);
  assert.equal(service.balance, 949900);
});
test('cancelled code, locked dates, closed courses and changed snapshots cannot reverse a payment', async () => {
  for (const scenario of ['cancel', 'locked', 'closed', 'concurrent']) {
    const { c, service } = setup();
    if (scenario === 'cancel') c.requireDeleteCode = async () => false;
    if (scenario === 'locked') c.requireOperationalDateEditable = () => false;
    if (scenario === 'closed') service.transferClosed = true;
    if (scenario === 'concurrent') c.requireDeleteCode = async () => { service.balance = 1; return true; };
    await c.reverseCustomerHistoryPayment(1, 0, 0);
    assert.equal(service.payments.length, 2, scenario);
    assert.equal(c.saved, undefined, scenario);
  }
});
test('one customer credit reversal does not remove other payments on the same service', () => {
  const c = vm.createContext({ customerCreditLedger: customer => customer.creditLedger });
  vm.runInContext(source('reverseCustomerCreditPayment'), c);
  const customer = { creditLedger: [{ paymentId: 'p1', targetServiceId: 'svc' }, { paymentId: 'p2', targetServiceId: 'svc' }] };
  c.reverseCustomerCreditPayment({ id: 'p1', method: 'customer_credit' }, customer, { id: 'svc' }, true);
  assert.equal(customer.creditLedger.length, 1);
  assert.equal(customer.creditLedger[0].paymentId, 'p2');
});
