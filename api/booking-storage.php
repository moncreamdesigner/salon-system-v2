<?php
declare(strict_types=1);

const BOOKING_ACTIVE_RETENTION_YEARS = 2;

function booking_archive_key(array $booking): string
{
    $identity = [
        'id' => trim((string)($booking['id'] ?? '')),
        'salon' => (string)($booking['salon'] ?? ''),
        'date' => (string)($booking['date'] ?? ''),
        'time' => (string)($booking['time'] ?? ''),
        'phone' => (string)($booking['phone'] ?? ''),
    ];
    return hash('sha256', json_encode($identity, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '');
}

function archive_old_booking_rows(PDO $pdo, array $bookings, int $revision): array
{
    $cutoff = (new DateTimeImmutable('today', new DateTimeZone('Asia/Ulaanbaatar')))
        ->modify('-' . BOOKING_ACTIVE_RETENTION_YEARS . ' years')
        ->format('Y-m-d');
    $active = [];
    $archived = 0;
    // A duplicate archive key is already durable and is safe to keep. Other
    // database errors must throw and roll back before the active row is removed.
    $insert = $pdo->prepare('INSERT INTO app_booking_archive (archive_key, booking_id, salon, booking_date, booking_time, phone, status, payload, archived_revision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE archive_key = VALUES(archive_key)');
    foreach ($bookings as $booking) {
        if (!is_array($booking)) continue;
        $date = substr(trim((string)($booking['date'] ?? '')), 0, 10);
        if ($date === '' || $date >= $cutoff) {
            $active[] = $booking;
            continue;
        }
        $encoded = json_encode($booking, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($encoded === false) throw new RuntimeException('Архивлах захиалгыг JSON болгоход алдаа гарлаа.');
        $insert->execute([
            booking_archive_key($booking),
            trim((string)($booking['id'] ?? '')),
            (string)($booking['salon'] ?? ''),
            $date,
            (string)($booking['time'] ?? ''),
            (string)($booking['phone'] ?? ''),
            (string)($booking['status'] ?? ''),
            $encoded,
            $revision,
        ]);
        $archived++;
    }
    return [array_values($active), $archived];
}

function archive_expired_bookings_maintenance(PDO $pdo): array
{
    $pdo->beginTransaction();
    try {
        $currentRevision = (int)$pdo
            ->query("SELECT meta_value FROM app_meta WHERE meta_key = 'revision' FOR UPDATE")
            ->fetchColumn();
        $statement = $pdo->query("SELECT payload FROM app_sections WHERE section_key = 'bookings' LIMIT 1 FOR UPDATE");
        $rawPayload = $statement->fetchColumn();
        if ($rawPayload === false) {
            $pdo->commit();
            return ['archived' => 0, 'revision' => $currentRevision];
        }
        $bookings = json_decode((string)$rawPayload, true);
        if (!is_array($bookings)) throw new RuntimeException('Захиалгын мэдээлэл гэмтсэн тул архивлал хийгдсэнгүй.');

        $nextRevision = $currentRevision + 1;
        [$activeBookings, $archived] = archive_old_booking_rows($pdo, $bookings, $nextRevision);
        if ($archived === 0) {
            $pdo->commit();
            return ['archived' => 0, 'revision' => $currentRevision];
        }

        $encoded = json_encode($activeBookings, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($encoded === false) throw new RuntimeException('Архивласны дараах захиалгыг JSON болгоход алдаа гарлаа.');
        $update = $pdo->prepare("UPDATE app_sections SET payload = ?, revision = ?, updated_at = CURRENT_TIMESTAMP WHERE section_key = 'bookings'");
        $update->execute([$encoded, $nextRevision]);
        $meta = $pdo->prepare("UPDATE app_meta SET meta_value = ? WHERE meta_key = 'revision'");
        $meta->execute([(string)$nextRevision]);

        $scopeKeys = ['global'];
        foreach (known_salon_scope_keys($pdo) as $scopeKey) $scopeKeys[] = $scopeKey;
        $scopeUpdate = $pdo->prepare('INSERT INTO app_scope_revisions (scope_key, revision) VALUES (?, 1) ON DUPLICATE KEY UPDATE revision = revision + 1, updated_at = CURRENT_TIMESTAMP');
        foreach (array_values(array_unique($scopeKeys)) as $scopeKey) $scopeUpdate->execute([$scopeKey]);

        $pdo->commit();
        return ['archived' => $archived, 'revision' => $nextRevision];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}
