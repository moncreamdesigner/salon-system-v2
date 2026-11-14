<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../api/booking-attendance.php';
function attendance_expect(mixed $actual, mixed $expected): void {
    if ($actual !== $expected) throw new RuntimeException(var_export([$actual, $expected], true));
}
$today = '2026-11-14';
$booking = ['date' => $today, 'phone' => '9911 2233', 'salon' => 'B', 'status' => 'confirmed'];
$arrivals = [booking_attendance_key('99112233', $today, 'B') => true];
attendance_expect(booking_attendance_status($booking, $arrivals, $today), 'arrived');
attendance_expect(booking_attendance_status($booking, [], $today), 'waiting');
attendance_expect(booking_attendance_status($booking, [], '2026-11-15'), 'missed');
attendance_expect(booking_attendance_status($booking, $arrivals, '2026-11-13'), 'waiting');
attendance_expect(booking_attendance_status($booking, [], '2026-11-15', false), 'unknown');
foreach (['cancelled', 'rejected'] as $status) attendance_expect(booking_attendance_status(array_merge($booking, ['status' => $status]), $arrivals, $today), 'excluded');
attendance_expect(booking_attendance_status(array_merge($booking, ['salon' => 'A']), $arrivals, '2026-11-15'), 'missed');
attendance_expect(booking_attendance_status(array_merge($booking, ['phone' => '99112234']), $arrivals, '2026-11-15'), 'missed');
attendance_expect(booking_attendance_status(array_merge($booking, ['date' => '']), [], $today), 'unknown');
$single = ['kind' => 'single', 'date' => $today, 'salon' => 'A', 'performedSalon' => 'B', 'staff' => 'Staff'];
attendance_expect(booking_attendance_event($single), ['date' => $today, 'salon' => 'B']);
foreach ([['kind' => 'kass'], ['kind' => 'diagnosis'], ['prepaidPending' => true], ['deleted' => true], ['deletedAt' => $today], ['staff' => '']] as $override) attendance_expect(booking_attendance_event(array_merge($single, $override)), null);
$course = ['kind' => 'course', 'salon' => 'A'];
$visit = ['date' => $today, 'salon' => 'B', 'staff' => 'Staff'];
attendance_expect(booking_attendance_event($course), null);
attendance_expect(booking_attendance_event($course, $visit), ['date' => $today, 'salon' => 'B']);
attendance_expect(booking_attendance_event(array_merge($course, ['deleted' => true]), $visit), null);
attendance_expect(booking_attendance_event($course, array_merge($visit, ['deleted' => true])), null);
attendance_expect(booking_attendance_event($course, array_merge($visit, ['staff' => ''])), null);
echo "booking-attendance-test: OK\n";
