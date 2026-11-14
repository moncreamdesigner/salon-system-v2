<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
function booking_capacity(array $salons, string $salon, string $date, string $time = ''): int { return 2; }
$admin = file_get_contents(__DIR__ . '/../api/bookings.php');
if (!preg_match('/^function booking_assert_capacity\([^\n]*\)[^\n]*\n\{[\s\S]*?^\}/m', $admin, $match)) throw new RuntimeException('Admin capacity helper missing');
eval($match[0]);
$candidate = ['salon' => 'A', 'date' => '2026-11-20', 'time' => '09:00', 'status' => 'confirmed'];
$bookings = [array_merge($candidate, ['id' => 1]), array_merge($candidate, ['id' => 2]), array_merge($candidate, ['id' => 3, 'status' => 'cancelled'])];
try { booking_assert_capacity($bookings, $candidate, []); throw new RuntimeException('Full slot accepted'); } catch (DomainException $expected) {}
$bookings[1]['status'] = 'cancelled';
booking_assert_capacity($bookings, $candidate, []); // Released seat accepts an admin booking.
$public = file_get_contents(__DIR__ . '/../api/public.php');
$start = strpos($public, '    $slotCount = 0;');
$end = strpos($public, '    if ($slotCount >= $capacity)', $start);
if ($start === false || $end === false) throw new RuntimeException('Public capacity block missing');
$booking = $candidate;
eval(substr($public, $start, $end - $start));
if ($slotCount !== 1) throw new RuntimeException('Public endpoint retained cancelled seat');
$bookings[1]['status'] = 'pending';
eval(substr($public, $start, $end - $start));
if ($slotCount !== 2) throw new RuntimeException('Pending booking must still reserve a seat');
echo "booking-cancel-capacity-test: OK\n";
