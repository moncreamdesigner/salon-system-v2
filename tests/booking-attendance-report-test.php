<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../api/booking-attendance-report.php';
function report_expect(mixed $actual, mixed $expected): void { if ($actual !== $expected) throw new RuntimeException(var_export([$actual, $expected], true)); }
function appointment(int $id, string $date, string $branch, string $phone, string $status = 'confirmed'): array {
    return ['id' => $id, 'date' => $date, 'salon' => $branch, 'phone' => $phone, 'status' => $status, 'time' => '09:00'];
}
$rows = [appointment(1, '2026-11-13', 'A', '99112233'), appointment(2, '2026-11-13', 'A', '99112234'), appointment(3, '2026-11-14', 'A', '99112235'), appointment(4, '2026-11-15', 'A', '99112236'), appointment(5, '2026-11-13', 'A', '99112237', 'cancelled'), appointment(6, '2026-11-13', 'B', '99112233'), appointment(7, '2026-10-13', 'A', '99112233')];
$rows[] = $rows[0]; // An archive copy must not count twice.
$customers = [['phone' => '99112233', 'serviceHistory' => [
    ['kind' => 'single', 'salon' => 'A', 'date' => '2026-11-13', 'staff' => 'Staff'],
    ['kind' => 'course', 'salon' => 'A', 'visits' => [['salon' => 'B', 'date' => '2026-11-13', 'staff' => 'Staff']]],
]], ['phone' => '99112234', 'serviceHistory' => [['kind' => 'kass', 'salon' => 'A', 'date' => '2026-11-13', 'staff' => 'Cashier']]]];
$report = booking_attendance_report($rows, $customers, '2026-11-01', '2026-11-30', '', '2026-11-14');
foreach (['total' => 6, 'arrived' => 2, 'missed' => 1, 'waiting' => 2, 'excluded' => 1, 'resolved' => 3, 'uniqueCustomers' => 5, 'arrivedPercent' => 66.7, 'missedPercent' => 33.3] as $key => $expected) report_expect($report['totals'][$key], $expected);
report_expect(count($report['byBranch']), 2);
report_expect($report['byMonth'][0]['name'], '2026-11');
$scoped = booking_attendance_report($rows, $customers, '2026-11-01', '2026-11-30', 'A', '2026-11-14');
report_expect($scoped['totals']['arrivedPercent'], 50.0);
report_expect(count($scoped['byBranch']), 1);
report_expect($scoped['byBranch'][0]['name'], 'A');
$future = booking_attendance_report([$rows[3]], [], '2026-11-01', '2026-11-30', '', '2026-11-14');
report_expect($future['totals']['arrivedPercent'], null);
report_expect($future['totals']['missedPercent'], null);
$range = booking_attendance_report($rows, $customers, '2026-11-14', '2026-11-14', '', '2026-11-14');
report_expect($range['totals']['total'], 1);
report_expect($range['totals']['waiting'], 1);
echo "booking-attendance-report-test: OK\n";
