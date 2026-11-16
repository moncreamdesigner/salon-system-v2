<?php
declare(strict_types=1);

function booking_persisted_snapshot(array $booking): array
{
    // Attendance is a read-only list projection, not part of the saved booking.
    // Ignore only this known derived field; retain every persisted field so
    // concurrent edits (including unknown future fields) still fail closed.
    unset($booking['attendance']);
    return $booking;
}

function booking_snapshot_matches(array $current, array $expected): bool
{
    return booking_persisted_snapshot($current) == booking_persisted_snapshot($expected);
}
