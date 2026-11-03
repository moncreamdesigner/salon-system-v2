<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../api/prepaid-services.php';
require_once __DIR__ . '/../api/daily-queue.php';
require_once __DIR__ . '/../api/customer-mutations.php';
function prepaid_expect(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
function prepaid_reject(callable $fn): void {
    try { $fn(); } catch (DomainException $error) { return; }
    throw new RuntimeException('Unsafe prepaid mutation was accepted');
}
// Exercise the same date-lock implementation as the live endpoint, without DB/auth side effects.
$source = file_get_contents(__DIR__ . '/../api/state.php');
foreach (['recovery_entity_key', 'recovery_index', 'operational_date', 'operational_item_index', 'operational_date_is_locked', 'service_core_for_lock', 'operational_nested_row_for_lock', 'assert_customer_operations_unlocked'] as $name) {
    if (!preg_match('/^function ' . $name . '\([^\n]*\)[^\n]*\n\{[\s\S]*?^\}/m', $source, $match)) throw new RuntimeException('Missing helper: ' . $name);
    eval($match[0]);
}
$today = (new DateTimeImmutable('today', new DateTimeZone('Asia/Ulaanbaatar')))->format('Y-m-d');
$cutoff = (new DateTimeImmutable($today))->modify('-3 days')->format('Y-m-d');
$item = ['id' => 'prepaid-1', 'kind' => 'single', 'prepaid' => true, 'prepaidPending' => true, 'date' => '', 'staff' => '', 'staffId' => null, 'salon' => 'Хан-Уул', 'price' => 75000, 'basePrice' => 75000, 'createdAt' => '2026-01-01', 'registeredAt' => '2026-01-01T09:00:00+08:00', 'activeUntil' => '', 'balance' => 0, 'payments' => [['id' => 'pay-1', 'amount' => 75000, 'date' => '2026-01-01']]];
$wrap = static fn(array $row): array => ['customers' => [['id' => 1, 'serviceHistory' => [$row]]]];
$completed = array_merge($item, ['prepaidPending' => false, 'date' => $today, 'staff' => 'Массажист', 'staffId' => 2, 'performedSalon' => 'Чингэлтэй', 'performedAt' => $today . 'T09:00:00+08:00', 'activeUntil' => $today . 'T11:00:00+08:00']);
assert_prepaid_services_preserved($wrap($item), $wrap($completed), ['role' => 'salon', 'salon' => 'Чингэлтэй']);
assert_customer_operations_unlocked($wrap($item), $wrap($completed), $cutoff);
foreach (['price' => 100000, 'salon' => 'Чингэлтэй', 'date' => '2099-01-01', 'prepaid' => false, 'staff' => ''] as $key => $value) {
    prepaid_reject(fn() => assert_prepaid_services_preserved($wrap($item), $wrap(array_merge($completed, [$key => $value]))));
}
prepaid_reject(fn() => assert_prepaid_services_preserved($wrap($completed), $wrap($item)));
prepaid_reject(fn() => assert_prepaid_services_preserved($wrap($item), $wrap($completed), ['role' => 'salon', 'salon' => 'Хан-Уул']));
prepaid_reject(fn() => assert_customer_operations_unlocked($wrap($item), $wrap(array_merge($completed, ['date' => '2026-01-02'])), $cutoff));
prepaid_reject(fn() => assert_customer_operations_unlocked($wrap($item), $wrap(array_merge($completed, ['diagnosis' => ['changed' => true]])), $cutoff));
$editedPayment = $completed;
$editedPayment['payments'][0]['amount'] = 1;
prepaid_reject(fn() => assert_customer_operations_unlocked($wrap($item), $wrap($editedPayment), $cutoff));
$rows = daily_queue_recover_from_history($wrap($item)['customers'], '2026-01-01');
prepaid_expect(empty($rows[0]['dailyQueueDate']), 'Pending service must not enter the daily queue');
$rows = daily_queue_recover_from_history($wrap($completed)['customers'], $today);
prepaid_expect(($rows[0]['dailyQueueSalon'] ?? '') === 'Чингэлтэй', 'Actual service branch must own the daily queue');
prepaid_expect(($rows[0]['dailyQueueAssignedAt'] ?? '') === $completed['performedAt'], 'Queue order must use fulfillment time, not old prepayment registration time');
$unpaid = array_merge($item, ['balance' => 75000, 'payments' => []]);
$staleCompletion = array_merge($completed, ['balance' => 75000, 'payments' => []]);
[$merged, $conflicts] = customer_mutation_three_way_merge($wrap($unpaid)['customers'][0], $wrap($item)['customers'][0], $wrap($staleCompletion)['customers'][0], 'customers/1');
prepaid_expect($conflicts === [], 'A concurrent payment and fulfillment must merge safely');
prepaid_expect($merged['serviceHistory'][0]['payments'] === $item['payments'] && $merged['serviceHistory'][0]['balance'] === 0, 'Fulfillment must not overwrite a concurrent payment');
assert_prepaid_services_preserved($wrap($item), ['customers' => [$merged]]);
assert_customer_operations_unlocked($wrap($item), ['customers' => [$merged]], $cutoff);
[$ignored, $conflicts] = customer_mutation_three_way_merge($wrap($item)['customers'][0], $wrap($completed)['customers'][0], $wrap(array_merge($completed, ['staff' => 'Өөр ажилтан', 'staffId' => 3]))['customers'][0], 'customers/1');
prepaid_expect($conflicts !== [], 'Two devices must not fulfill the same service for different staff');
echo "prepaid-single-test: OK\n";
