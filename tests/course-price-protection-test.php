<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../api/course-price-protection.php';
function check_price(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
function must_reject_price(callable $operation): void {
    try { $operation(); } catch (DomainException $error) { return; }
    throw new RuntimeException('Unsafe price change was not rejected');
}
$course = ['id' => 'course-1', 'kind' => 'course', 'basePrice' => 540000, 'price' => 540000, 'singleVisitPrice' => 75000, 'visitsTotal' => 8, 'balance' => 300000];
$current = ['customers' => [['id' => 1, 'serviceHistory' => [$course]]]];
$changed = $current;
$changed['customers'][0]['serviceHistory'][0]['balance'] = 200000;
$changed['customers'][0]['serviceHistory'][0]['visits'] = [['number' => 5, 'date' => '2026-10-21']];
assert_course_prices_preserved($current, $changed);
foreach (['basePrice' => 650000, 'visitsTotal' => 10, 'singleVisitPrice' => 90000] as $key => $value) {
    $changed = $current;
    $changed['customers'][0]['serviceHistory'][0][$key] = $value;
    must_reject_price(fn() => assert_course_prices_preserved($current, $changed));
}
$closed = $current;
$closed['customers'][0]['serviceHistory'][0] = [...$course, 'balance' => 0, 'transferClosed' => true, 'singleVisitPrice' => 80000, 'courseClosurePricing' => ['singleVisitPrice' => 80000]];
assert_course_prices_preserved($current, $closed);
$today = new DateTimeImmutable('now', new DateTimeZone('Asia/Ulaanbaatar'));
$tomorrow = $today->modify('+1 day')->format('Y-m-d');
$oldDate = $today->modify('-1 day')->format('Y-m-d');
$item = ['code' => '1', 'customer' => 'Том хүн', 'price' => 540000, 'singleVisitPrice' => 75000, 'visits' => '8 удаа', 'priceVersions' => [['effectiveFrom' => $oldDate, 'price' => 600000, 'singleVisitPrice' => 80000, 'visits' => '8 удаа']]];
$next = $item;
$next['priceVersions'][] = ['effectiveFrom' => $tomorrow, 'price' => 650000, 'singleVisitPrice' => 90000, 'visits' => '8 удаа'];
assert_service_price_versions_preserved(['course' => [$item]], ['course' => [$next]]);
$stale = $item; unset($stale['priceVersions']);
must_reject_price(fn() => assert_service_price_versions_preserved(['course' => [$item]], ['course' => [$stale]]));
$changedVersion = $item; $changedVersion['priceVersions'][0]['price'] = 700000;
must_reject_price(fn() => assert_service_price_versions_preserved(['course' => [$item]], ['course' => [$changedVersion]]));
echo "Course price protection tests passed\n";
