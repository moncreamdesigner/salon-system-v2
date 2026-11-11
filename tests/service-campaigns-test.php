<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../api/service-campaigns.php';
require_once __DIR__ . '/../api/course-price-protection.php';
function service_campaign_expect(bool $value, string $message): void { if (!$value) throw new RuntimeException($message); }
function service_campaign_reject(callable $operation): void { try { $operation(); } catch (DomainException $error) { return; } throw new RuntimeException('Unsafe campaign contract accepted'); }
foreach (['dashboard-summary.php' => ['dashboard_number', 'dashboard_service_total', 'dashboard_paid_amount'], 'revenue-list.php' => ['revenue_legacy_paid']] as $file => $names) {
    $source = file_get_contents(__DIR__ . '/../api/' . $file);
    foreach ($names as $name) {
        if (!preg_match('/^function ' . $name . '\([^\n]*\)[^\n]*\n\{[\s\S]*?^\}/m', $source, $match)) throw new RuntimeException('Missing helper: ' . $name);
        eval($match[0]);
    }
}
$discount = ['id' => 8, 'percent' => 30, 'startDate' => '2026-11-11', 'endDate' => '2026-11-17', 'days' => [], 'salons' => ['Хан-Уул', 'Чингэлтэй'], 'services' => ['course:C1:Курс', 'single:S1:Нэг удаа']];
$item = ['id' => 'course', 'kind' => 'course', 'date' => '2026-11-11', 'salon' => 'Хан-Уул', 'service' => 'Курс', 'basePrice' => 949900, 'price' => 949900, 'balance' => 664930, 'visits' => [], 'payments' => [], 'campaignDiscountAmount' => 284970, 'campaignDiscount' => ['id' => 8, 'percent' => 30, 'serviceKey' => 'course:C1:Курс'], 'serviceCommissionBasisVersion' => 1];
$wrap = static fn(array $row): array => ['customers' => [['id' => 1, 'serviceHistory' => [$row]]]];
$current = ['discounts' => [$discount]];
assert_service_campaign_contracts($current, $wrap($item));
service_campaign_expect(dashboard_service_total($item) === 664930.0, 'Dashboard must use discounted course total');
service_campaign_expect(dashboard_paid_amount($item) === 0.0, 'An unpaid discounted course must never create phantom cash');
service_campaign_expect(revenue_legacy_paid($item) === 0.0, 'Revenue list must not infer the discount as payment');
foreach (['date' => '2026-11-18', 'salon' => 'Өөр салбар', 'campaignDiscountAmount' => 1] as $key => $value) service_campaign_reject(fn() => assert_service_campaign_contracts($current, $wrap(array_merge($item, [$key => $value]))));
$unselected = $current;
$unselected['discounts'][0]['services'] = ['course:C2:Өөр курс'];
service_campaign_reject(fn() => assert_service_campaign_contracts($unselected, $wrap($item)));
$previous = $wrap($item);
$paid = $item;
$paid['balance'] = 0;
$paid['payments'] = [['id' => 'pay', 'amount' => 664930]];
assert_service_campaign_contracts($previous, $wrap($paid));
assert_course_prices_preserved($previous, $wrap($paid));
service_campaign_reject(fn() => assert_service_campaign_contracts($previous, $wrap(array_merge($item, ['campaignDiscountAmount' => 0]))));
$old = $item;
unset($old['campaignDiscount'], $old['campaignDiscountAmount'], $old['serviceCommissionBasisVersion']);
$old['balance'] = 949900;
assert_service_campaign_contracts($wrap($old), $wrap($old));
service_campaign_reject(fn() => assert_service_campaign_contracts($wrap($old), $wrap($item)));
echo "service-campaigns-test: OK\n";
