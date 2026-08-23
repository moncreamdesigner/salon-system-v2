<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require_once __DIR__ . '/../api/daily-queue.php';

function queue_expect(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$customers = [
    ['id' => 11, 'dailyQueueDate' => '2026-08-23', 'dailyQueueSalon' => 'Хан-Уул', 'dailyQueueAssignedAt' => '2026-08-23T09:00:00+08:00', 'dailyQueueSequence' => 1],
    ['id' => 12, 'dailyQueueDate' => '2026-08-23', 'dailyQueueSalon' => 'Хан-Уул', 'dailyQueueAssignedAt' => '2026-08-23T10:00:00+08:00', 'dailyQueueSequence' => 1],
    ['id' => 13, 'dailyQueueDate' => '2026-08-23', 'dailyQueueSalon' => 'Хан-Уул', 'dailyQueueAssignedAt' => '2026-08-23T11:00:00+08:00', 'dailyQueueSequence' => 4],
    ['id' => 21, 'dailyQueueDate' => '2026-08-23', 'dailyQueueSalon' => 'Чингэлтэй', 'dailyQueueAssignedAt' => '2026-08-23T09:30:00+08:00', 'dailyQueueSequence' => 1],
];
$normalized = daily_queue_normalize_customers($customers);
queue_expect(array_column($normalized['customers'], 'dailyQueueSequence') === [1, 2, 3, 1], 'Duplicate group must be rebuilt independently by salon and assignment time.');
queue_expect(count($normalized['repairedGroups']) === 1, 'Only the corrupted salon/date group must be reported.');

$withGap = [
    ['id' => 31, 'dailyQueueDate' => '2026-08-23', 'dailyQueueSalon' => 'Хан-Уул', 'dailyQueueAssignedAt' => '2026-08-23T09:00:00+08:00', 'dailyQueueSequence' => 1],
    ['id' => 32, 'dailyQueueDate' => '2026-08-23', 'dailyQueueSalon' => 'Хан-Уул', 'dailyQueueAssignedAt' => '2026-08-23T10:00:00+08:00', 'dailyQueueSequence' => 3],
    ['id' => 33, 'dailyQueueDate' => '2026-08-23', 'dailyQueueSalon' => 'Хан-Уул', 'dailyQueueAssignedAt' => '2026-08-23T11:00:00+08:00', 'dailyQueueSequence' => 0],
];
$gapResult = daily_queue_normalize_customers($withGap);
queue_expect(array_column($gapResult['customers'], 'dailyQueueSequence') === [1, 3, 4], 'Valid vacant numbers must remain vacant and a new customer must append after the maximum.');

$serverCustomer = [
    'id' => 41,
    'dailyQueueDate' => '2026-08-23',
    'dailyQueueSalon' => 'Хан-Уул',
    'dailyQueueAssignedAt' => '2026-08-23T09:00:00+08:00',
    'dailyQueueSequence' => 7,
];
$staleBrowserCustomer = $serverCustomer;
$staleBrowserCustomer['dailyQueueAssignedAt'] = '2026-08-23T09:05:00+08:00';
$staleBrowserCustomer['dailyQueueSequence'] = 1;
$preparedSameQueue = daily_queue_prepare_customer_mutation($serverCustomer, $staleBrowserCustomer);
queue_expect($preparedSameQueue['dailyQueueSequence'] === 7, 'A stale browser must not overwrite the canonical server sequence.');
queue_expect($preparedSameQueue['dailyQueueAssignedAt'] === $serverCustomer['dailyQueueAssignedAt'], 'Original queue order must remain stable.');

$business = ['id' => 1, 'name' => 'A', 'dailyQueueSequence' => 9, 'dailyQueueSalon' => 'Хан-Уул'];
$withoutQueue = daily_queue_without_derived_fields($business);
queue_expect($withoutQueue === ['id' => 1, 'name' => 'A'], 'Server-owned queue fields must not participate in customer conflict fingerprints.');

echo "daily-queue-test: OK\n";
