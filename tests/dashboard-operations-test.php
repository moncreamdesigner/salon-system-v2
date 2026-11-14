<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit;
require_once __DIR__ . '/../api/dashboard-operations.php';
$single = ['kind' => 'single', 'date' => '2026-11-14', 'salon' => 'A', 'staff' => 'Staff'];
$course = ['kind' => 'course', 'salon' => 'A', 'visits' => [array_merge($single, ['performedSalon' => 'B'])]];
$customers = [
    ['id' => 1, 'serviceHistory' => [$single, $single, $course]],
    ['id' => 2, 'serviceHistory' => [$course]],
];
foreach ([['deleted' => true], ['prepaidPending' => true], ['kind' => 'kass'], ['staff' => ''], ['date' => '2026-01-01']] as $override) {
    $customers[] = ['serviceHistory' => [array_merge($single, $override)]];
}
$customers[] = ['deletedAt' => 'now', 'serviceHistory' => [$single]];
$customers[] = ['serviceHistory' => [['kind' => 'course', 'visits' => [array_merge($single, ['deleted' => true])]]]];
foreach (['' => 2, 'A' => 1, 'B' => 2, 'C' => 0] as $branch => $expected) {
    if (dashboard_served_customers_today($customers, '2026-11-14', $branch) !== $expected) throw new RuntimeException('Incorrect branch count: ' . $branch);
}
echo "Dashboard operations tests passed\n";
