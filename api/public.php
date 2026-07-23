<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

// Публик endpoint — нэвтрэлт шаардлагагүй, зөвхөн ижил origin.
verify_same_origin();

$pdo = db();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function load_public_sections(PDO $pdo): array
{
    $keys = ['salons', 'bookings', 'holidays', 'homepageSettings'];
    $placeholders = implode(',', array_fill(0, count($keys), '?'));
    $statement = $pdo->prepare("SELECT section_key, payload FROM app_sections WHERE section_key IN ($placeholders)");
    $statement->execute($keys);
    $data = [
        'salons' => [],
        'bookings' => [],
        'holidays' => [],
        'homepageSettings' => new stdClass(),
    ];
    foreach ($statement->fetchAll() as $row) {
        $decoded = json_decode((string)$row['payload'], true);
        if ($decoded === null) continue;
        $data[$row['section_key']] = $decoded;
    }
    return $data;
}

function sanitize_public_booking(array $booking): ?array
{
    $phone = preg_replace('/\D+/', '', (string)($booking['phone'] ?? ''));
    if (strlen((string)$phone) !== 8) return null;
    $date = (string)($booking['date'] ?? '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) return null;
    $time = (string)($booking['time'] ?? '');
    if (!preg_match('/^\d{2}:\d{2}$/', $time)) return null;
    $salon = trim((string)($booking['salon'] ?? ''));
    if ($salon === '' || mb_strlen($salon) > 190) return null;
    $id = (int)($booking['id'] ?? 0);
    if ($id <= 0) $id = (int)(microtime(true) * 1000);
    return [
        'id' => $id,
        'salon' => $salon,
        'date' => $date,
        'time' => $time,
        'phone' => $phone,
        'source' => 'customer',
        'status' => 'pending',
        'createdAt' => date('Y-m-d H:i'),
    ];
}

if ($method === 'GET') {
    $data = load_public_sections($pdo);
    // Захиалгаас утасны дугаарыг маскалж буцаах (публикт бүгд харагдах хэрэггүй).
    $bookings = array_map(function ($booking) {
        $phone = (string)($booking['phone'] ?? '');
        if (strlen($phone) === 8) $booking['phone'] = substr($phone, 0, 4) . '****';
        return $booking;
    }, is_array($data['bookings']) ? $data['bookings'] : []);
    $data['bookings'] = $bookings;
    json_response(['ok' => true, 'data' => $data]);
}

if ($method !== 'POST') {
    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
}

$payload = request_payload();
$incoming = $payload['booking'] ?? null;
if (!is_array($incoming)) json_response(['ok' => false, 'message' => 'Захиалгын мэдээлэл дутуу.'], 422);

$booking = sanitize_public_booking($incoming);
if (!$booking) json_response(['ok' => false, 'message' => 'Захиалгын мэдээлэл буруу.'], 422);

try {
    $pdo->beginTransaction();
    $revisionStmt = $pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'revision' FOR UPDATE");
    $currentRevision = (int)$revisionStmt->fetchColumn();
    $nextRevision = $currentRevision + 1;

    // Одоогийн section-уудыг унших.
    $sections = load_public_sections($pdo);
    $salons = is_array($sections['salons']) ? $sections['salons'] : [];
    $holidays = is_array($sections['holidays']) ? $sections['holidays'] : [];
    $bookings = is_array($sections['bookings']) ? $sections['bookings'] : [];

    // Салбарын нэр бодит салбар мөн эсэхийг шалгах.
    $salon = null;
    foreach ($salons as $item) {
        if (!is_array($item)) continue;
        if (($item['name'] ?? null) === $booking['salon']) { $salon = $item; break; }
    }
    if (!$salon || (($salon['active'] ?? true) === false)) {
        $pdo->rollBack();
        json_response(['ok' => false, 'message' => 'Салбар олдсонгүй эсвэл идэвхгүй байна.'], 422);
    }

    $bookingDate = DateTimeImmutable::createFromFormat('!Y-m-d', $booking['date']);
    $today = new DateTimeImmutable('today');
    if (!$bookingDate || $bookingDate->format('Y-m-d') !== $booking['date'] || $bookingDate < $today) {
        $pdo->rollBack();
        json_response(['ok' => false, 'message' => 'Өнгөрсөн эсвэл буруу өдөрт цаг захиалах боломжгүй.'], 422);
    }

    $schedule = is_array($salon['schedule'] ?? null) ? $salon['schedule'] : [];
    $isWeekend = in_array((int)$bookingDate->format('N'), [6, 7], true);
    $startText = (string)($schedule[$isWeekend ? 'weekendStart' : 'workStart'] ?? ($isWeekend ? '10:00' : '09:00'));
    $endText = (string)($schedule[$isWeekend ? 'weekendEnd' : 'workEnd'] ?? '19:00');
    $duration = max(5, (int)($schedule['duration'] ?? 30));
    $toMinutes = static function (string $value): ?int {
        if (!preg_match('/^(\d{2}):(\d{2})$/', $value, $parts)) return null;
        $hour = (int)$parts[1];
        $minute = (int)$parts[2];
        if ($hour > 23 || $minute > 59) return null;
        return $hour * 60 + $minute;
    };
    $startMinutes = $toMinutes($startText);
    $endMinutes = $toMinutes($endText);
    $bookingMinutes = $toMinutes($booking['time']);
    $validSlot = $startMinutes !== null && $endMinutes !== null && $bookingMinutes !== null
        && $bookingMinutes >= $startMinutes && $bookingMinutes <= ($endMinutes - 120)
        && (($bookingMinutes - $startMinutes) % $duration === 0);
    if (!$validSlot) {
        $pdo->rollBack();
        json_response(['ok' => false, 'message' => 'Сонгосон цаг салбарын цагийн хуваарьт тохирохгүй байна.'], 422);
    }
    if ($bookingDate->format('Y-m-d') === $today->format('Y-m-d') && $bookingMinutes <= ((int)date('G') * 60 + (int)date('i'))) {
        $pdo->rollBack();
        json_response(['ok' => false, 'message' => 'Өнгөрсөн цагт захиалга хийх боломжгүй.'], 422);
    }

    // Амралтын өдөр шалгах.
    foreach ($holidays as $holiday) {
        if (!is_array($holiday)) continue;
        if (($holiday['date'] ?? '') !== $booking['date']) continue;
        $scope = $holiday['salons'] ?? [];
        if (!is_array($scope) || in_array($booking['salon'], $scope, true) || in_array('*', $scope, true) || empty($scope)) {
            $pdo->rollBack();
            json_response(['ok' => false, 'message' => 'Тухайн өдөр салбар амарна.'], 409);
        }
    }

    // Давхардал шалгах — ижил утас + ижил өдөр.
    foreach ($bookings as $existing) {
        if (!is_array($existing)) continue;
        if (in_array(($existing['status'] ?? ''), ['cancelled', 'rejected'], true)) continue;
        if (($existing['phone'] ?? '') === $booking['phone'] && ($existing['date'] ?? '') === $booking['date']) {
            $pdo->rollBack();
            json_response(['ok' => false, 'message' => 'Энэ дугаараас тухайн өдөр цаг захиалсан байна.'], 409);
        }
    }

    // Тухайн цагийн багтаамж шалгах.
    $capacity = (int)($salon['slotCapacity'] ?? 4);
    if ($capacity < 1) $capacity = 4;
    $slotCount = 0;
    foreach ($bookings as $existing) {
        if (!is_array($existing)) continue;
        if (in_array(($existing['status'] ?? ''), ['cancelled', 'rejected'], true)) continue;
        if (($existing['salon'] ?? '') === $booking['salon']
            && ($existing['date'] ?? '') === $booking['date']
            && ($existing['time'] ?? '') === $booking['time']) {
            $slotCount++;
        }
    }
    if ($slotCount >= $capacity) {
        $pdo->rollBack();
        json_response(['ok' => false, 'message' => 'Сонгосон цаг дүүрсэн байна.'], 409);
    }

    // ID үл давхардах болгох.
    $existingIds = [];
    foreach ($bookings as $existing) if (is_array($existing) && isset($existing['id'])) $existingIds[(int)$existing['id']] = true;
    while (isset($existingIds[$booking['id']])) $booking['id']++;

    array_unshift($bookings, $booking);

    // Хамгийн сүүлийн 5000 захиалгаар хязгаарлах (сан хамгаалалт).
    if (count($bookings) > 5000) $bookings = array_slice($bookings, 0, 5000);

    $encoded = json_encode($bookings, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($encoded === false) throw new RuntimeException('JSON хөрвүүлэлт амжилтгүй.');

    $upsert = $pdo->prepare('INSERT INTO app_sections (section_key, payload, revision) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload), revision = VALUES(revision), updated_at = CURRENT_TIMESTAMP');
    $upsert->execute(['bookings', $encoded, $nextRevision]);

    $meta = $pdo->prepare("UPDATE app_meta SET meta_value = ? WHERE meta_key = 'revision'");
    $meta->execute([(string)$nextRevision]);
    bump_scope_revisions($pdo, ['role' => 'salon', 'salon' => (string)$booking['salon']], ['bookings'], (string)$booking['salon']);

    $pdo->commit();
    json_response(['ok' => true, 'booking' => $booking, 'revision' => $nextRevision]);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    json_response(['ok' => false, 'message' => 'Захиалга хадгалж чадсангүй.'], 500);
}
