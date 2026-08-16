<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
$user = require_auth();
$pdo = db();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
}

function booking_rows(PDO $pdo, string $section, bool $lock = false): array
{
    $sql = 'SELECT payload FROM app_sections WHERE section_key = ? LIMIT 1' . ($lock ? ' FOR UPDATE' : '');
    $statement = $pdo->prepare($sql);
    $statement->execute([$section]);
    $decoded = json_decode((string)($statement->fetchColumn() ?: '[]'), true);
    return is_array($decoded) ? array_values($decoded) : [];
}

function booking_can_access(array $user, string $salon): bool
{
    return ($user['role'] ?? '') !== 'salon' || trim((string)($user['salon'] ?? '')) === $salon;
}

function booking_validate(array $booking): array
{
    $salon = trim((string)($booking['salon'] ?? ''));
    $date = trim((string)($booking['date'] ?? ''));
    $time = trim((string)($booking['time'] ?? ''));
    $phone = preg_replace('/\D+/', '', (string)($booking['phone'] ?? '')) ?: '';
    $status = trim((string)($booking['status'] ?? 'confirmed'));
    if ($salon === '' || preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) !== 1 || preg_match('/^\d{2}:\d{2}$/', $time) !== 1) {
        throw new InvalidArgumentException('Салбар, огноо, цагийн мэдээлэл дутуу байна.');
    }
    $parsedDate = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
    if (!$parsedDate || $parsedDate->format('Y-m-d') !== $date) {
        throw new InvalidArgumentException('Захиалгын огноо буруу байна.');
    }
    if (preg_match('/^\d{8}$/', $phone) !== 1) {
        throw new InvalidArgumentException('Утасны дугаар 8 оронтой байна.');
    }
    if (!in_array($status, ['pending', 'confirmed', 'cancelled', 'rejected'], true)) {
        throw new InvalidArgumentException('Захиалгын төлөв буруу байна.');
    }
    $booking['salon'] = $salon;
    $booking['date'] = $date;
    $booking['time'] = $time;
    $booking['phone'] = $phone;
    $booking['status'] = $status;
    return $booking;
}

function booking_index(array $rows, string $id): ?int
{
    foreach ($rows as $index => $row) {
        if (is_array($row) && (string)($row['id'] ?? '') === $id) return (int)$index;
    }
    return null;
}

function booking_id_count(array $rows, string $id): int
{
    $count = 0;
    foreach ($rows as $row) {
        if (is_array($row) && (string)($row['id'] ?? '') === $id) $count++;
    }
    return $count;
}

function booking_unique_id(array $rows): string
{
    $id = (string)(int)(microtime(true) * 1000000);
    while (booking_index($rows, $id) !== null) $id = (string)((int)$id + 1);
    return $id;
}

function booking_capacity(array $salons, string $salonName): int
{
    foreach ($salons as $salon) {
        if (is_array($salon) && trim((string)($salon['name'] ?? '')) === $salonName) {
            return max(1, (int)($salon['slotCapacity'] ?? 4));
        }
    }
    return 4;
}

function booking_find_salon(array $salons, string $salonName): ?array
{
    foreach ($salons as $salon) {
        if (is_array($salon) && trim((string)($salon['name'] ?? '')) === $salonName) {
            return $salon;
        }
    }
    return null;
}

function booking_time_minutes(string $value): ?int
{
    if (preg_match('/^(\d{2}):(\d{2})$/', $value, $parts) !== 1) return null;
    $hour = (int)$parts[1];
    $minute = (int)$parts[2];
    if ($hour > 23 || $minute > 59) return null;
    return ($hour * 60) + $minute;
}

function booking_holiday_applies(array $holiday, string $salonName, string $date): bool
{
    if ((string)($holiday['date'] ?? '') !== $date) return false;

    // Current records use `salon`; retain support for the older/bulk `salons`
    // representation so a data-format change never closes every branch.
    $singleSalon = trim((string)($holiday['salon'] ?? ''));
    if ($singleSalon !== '') return $singleSalon === $salonName || $singleSalon === '*';

    $salons = $holiday['salons'] ?? null;
    if (!is_array($salons)) return false;
    return in_array($salonName, $salons, true) || in_array('*', $salons, true);
}

function booking_assert_slot_rules(array $candidate, array $salons, array $holidays): void
{
    $salon = booking_find_salon($salons, (string)$candidate['salon']);
    if (!$salon || (($salon['active'] ?? true) === false)) {
        throw new InvalidArgumentException('Салбар олдсонгүй эсвэл идэвхгүй байна.');
    }

    $timezone = new DateTimeZone('Asia/Ulaanbaatar');
    $bookingDate = DateTimeImmutable::createFromFormat('!Y-m-d', (string)$candidate['date'], $timezone);
    $today = new DateTimeImmutable('today', $timezone);
    if (!$bookingDate || $bookingDate->format('Y-m-d') !== (string)$candidate['date'] || $bookingDate < $today) {
        throw new InvalidArgumentException('Өнгөрсөн эсвэл буруу өдөрт цаг захиалах боломжгүй.');
    }

    foreach ($holidays as $holiday) {
        if (is_array($holiday) && booking_holiday_applies($holiday, (string)$candidate['salon'], (string)$candidate['date'])) {
            throw new DomainException('Тухайн өдөр салбар амарна.');
        }
    }

    $schedule = is_array($salon['schedule'] ?? null) ? $salon['schedule'] : [];
    $isWeekend = in_array((int)$bookingDate->format('N'), [6, 7], true);
    $startText = (string)($schedule[$isWeekend ? 'weekendStart' : 'workStart'] ?? ($isWeekend ? '10:00' : '09:00'));
    $endText = (string)($schedule[$isWeekend ? 'weekendEnd' : 'workEnd'] ?? '19:00');
    $duration = max(5, (int)($schedule['duration'] ?? 30));
    $startMinutes = booking_time_minutes($startText);
    $endMinutes = booking_time_minutes($endText);
    $bookingMinutes = booking_time_minutes((string)$candidate['time']);
    $validSlot = $startMinutes !== null && $endMinutes !== null && $bookingMinutes !== null
        && $bookingMinutes >= $startMinutes
        && $bookingMinutes <= ($endMinutes - 120)
        && (($bookingMinutes - $startMinutes) % $duration === 0);
    if (!$validSlot) {
        throw new InvalidArgumentException('Сонгосон цаг салбарын цагийн хуваарьт тохирохгүй байна.');
    }

    $now = new DateTimeImmutable('now', $timezone);
    if ($bookingDate->format('Y-m-d') === $today->format('Y-m-d')) {
        $nowMinutes = ((int)$now->format('G') * 60) + (int)$now->format('i');
        if ($bookingMinutes <= $nowMinutes) {
            throw new InvalidArgumentException('Өнгөрсөн цагт захиалга хийх боломжгүй.');
        }
    }
}

function booking_assert_capacity(array $rows, array $candidate, array $salons, string $ignoreId = ''): void
{
    if (in_array((string)($candidate['status'] ?? ''), ['cancelled', 'rejected'], true)) return;
    $occupied = 0;
    foreach ($rows as $row) {
        if (!is_array($row) || (string)($row['id'] ?? '') === $ignoreId) continue;
        if (in_array((string)($row['status'] ?? ''), ['cancelled', 'rejected'], true)) continue;
        if (
            (string)($row['salon'] ?? '') === (string)$candidate['salon']
            && (string)($row['date'] ?? '') === (string)$candidate['date']
            && (string)($row['time'] ?? '') === (string)$candidate['time']
        ) {
            $occupied++;
        }
    }
    if ($occupied >= booking_capacity($salons, (string)$candidate['salon'])) {
        throw new DomainException('Сонгосон цаг дүүрсэн байна.');
    }
}

function booking_code_matches(array $settings, string $submitted): bool
{
    $expected = (string)($settings['deleteCode'] ?? '1989');
    return preg_match('/^\d{4}$/', $submitted) === 1 && hash_equals($expected, $submitted);
}

function booking_write_section(PDO $pdo, string $key, array $rows, int $revision): void
{
    $encoded = json_encode(array_values($rows), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($encoded === false) throw new RuntimeException('Захиалгын мэдээллийг JSON болгоход алдаа гарлаа.');
    $statement = $pdo->prepare('INSERT INTO app_sections (section_key, payload, revision) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload), revision = VALUES(revision), updated_at = CURRENT_TIMESTAMP');
    $statement->execute([$key, $encoded, $revision]);
}

function booking_bump_scopes(PDO $pdo, array $salons): int
{
    $keys = ['global'];
    foreach ($salons as $salon) {
        $name = trim((string)$salon);
        if ($name !== '') $keys[] = 'salon:' . $name;
    }
    $upsert = $pdo->prepare('INSERT INTO app_scope_revisions (scope_key, revision) VALUES (?, 1) ON DUPLICATE KEY UPDATE revision = revision + 1, updated_at = CURRENT_TIMESTAMP');
    foreach (array_values(array_unique($keys)) as $key) $upsert->execute([$key]);
    $read = $pdo->query("SELECT revision FROM app_scope_revisions WHERE scope_key = 'global'");
    return (int)$read->fetchColumn();
}

$payload = request_payload();
$action = trim((string)($payload['action'] ?? ''));
$operationId = trim((string)($payload['operationId'] ?? ''));
if (!in_array($action, ['create', 'update', 'status', 'delete'], true)) {
    json_response(['ok' => false, 'message' => 'Захиалгын үйлдэл буруу байна.'], 422);
}
if (preg_match('/^[A-Za-z0-9._:-]{12,190}$/', $operationId) !== 1) {
    json_response(['ok' => false, 'message' => 'Үйлдлийн дугаар буруу байна.'], 422);
}

try {
    $pdo->beginTransaction();
    $currentRevision = (int)$pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'revision' FOR UPDATE")->fetchColumn();
    $existingOperation = $pdo->prepare('SELECT actor_user_id, result_payload FROM app_operations WHERE operation_id = ? LIMIT 1');
    $existingOperation->execute([$operationId]);
    $operationRow = $existingOperation->fetch();
    if ($operationRow) {
        if ((int)($operationRow['actor_user_id'] ?? 0) !== (int)($user['id'] ?? 0)) {
            $pdo->rollBack();
            json_response(['ok' => false, 'message' => 'Үйлдлийн дугаар өөр хэрэглэгчид хамаарч байна.'], 409);
        }
        $stored = json_decode((string)$operationRow['result_payload'], true);
        $pdo->rollBack();
        json_response((is_array($stored) ? $stored : ['ok' => true]) + ['idempotentReplay' => true]);
    }

    $bookings = booking_rows($pdo, 'bookings', true);
    $audit = booking_rows($pdo, 'audit', true);
    $salons = booking_rows($pdo, 'salons');
    $holidays = booking_rows($pdo, 'holidays');
    $settingsRows = $pdo->prepare("SELECT payload FROM app_sections WHERE section_key = 'generalSettings' LIMIT 1");
    $settingsRows->execute();
    $settings = json_decode((string)($settingsRows->fetchColumn() ?: '{}'), true);
    $settings = is_array($settings) ? $settings : [];
    $before = null;
    $after = null;
    $affectedSalons = [];
    $resultBookings = [];

    if ($action === 'create') {
        $requested = is_array($payload['bookings'] ?? null) ? array_values($payload['bookings']) : [];
        if (!$requested || count($requested) > 4) throw new InvalidArgumentException('Нэг удаа 1–4 цаг бүртгэнэ.');
        $bookingGroupId = 'booking-group-' . bin2hex(random_bytes(16));
        $slotCount = count($requested);
        foreach ($requested as $slotIndex => $requestedBooking) {
            if (!is_array($requestedBooking)) throw new InvalidArgumentException('Захиалгын мэдээлэл буруу байна.');
            $booking = booking_validate([
                'id' => $requestedBooking['id'] ?? '',
                'salon' => $requestedBooking['salon'] ?? '',
                'date' => $requestedBooking['date'] ?? '',
                'time' => $requestedBooking['time'] ?? '',
                'phone' => $requestedBooking['phone'] ?? '',
                'source' => 'admin',
                'status' => 'confirmed',
                'createdAt' => (new DateTimeImmutable('now', new DateTimeZone('Asia/Ulaanbaatar')))->format('Y-m-d H:i'),
            ]);
            if (!booking_can_access($user, (string)$booking['salon'])) throw new LogicException('Өөр салбарын цагийг өөрчлөх эрхгүй.');
            // The server owns booking identity. Client timestamps can collide
            // across branch computers and must never become persistent IDs.
            $id = booking_unique_id($bookings);
            $booking['id'] = ctype_digit($id) ? (int)$id : $id;
            $booking['bookingGroupId'] = $bookingGroupId;
            $booking['slotIndex'] = $slotIndex + 1;
            $booking['slotCount'] = $slotCount;
            booking_assert_slot_rules($booking, $salons, $holidays);
            booking_assert_capacity($bookings, $booking, $salons);
            array_unshift($bookings, $booking);
            $resultBookings[] = $booking;
            $affectedSalons[] = (string)$booking['salon'];
        }
        $after = $resultBookings;
    } else {
        $id = trim((string)($payload['id'] ?? ''));
        $index = booking_index($bookings, $id);
        if ($id === '' || $index === null) throw new OutOfBoundsException('Захиалга олдсонгүй.');
        if (booking_id_count($bookings, $id) > 1) {
            throw new DomainException('Энэ захиалгын дугаар давхардсан байна. Админаар мэдээллийг шалгуулна уу.');
        }
        $current = $bookings[$index];
        if (!booking_can_access($user, (string)($current['salon'] ?? ''))) throw new LogicException('Өөр салбарын цагийг өөрчлөх эрхгүй.');
        $expected = is_array($payload['expected'] ?? null) ? $payload['expected'] : null;
        if ($expected !== null && $current != $expected) throw new UnexpectedValueException('Захиалгыг өөр төхөөрөмж дээр шинэчилсэн байна.');
        $before = $current;
        $affectedSalons[] = (string)($current['salon'] ?? '');

        if ($action === 'delete') {
            if (!booking_code_matches($settings, trim((string)($payload['code'] ?? '')))) {
                throw new InvalidArgumentException('Устгах код буруу байна.');
            }
            array_splice($bookings, $index, 1);
        } else {
            if ($action === 'status') {
                $current['status'] = trim((string)($payload['status'] ?? ''));
            } else {
                $replacement = is_array($payload['booking'] ?? null) ? $payload['booking'] : [];
                foreach (['salon', 'date', 'time', 'phone'] as $field) {
                    if (array_key_exists($field, $replacement)) $current[$field] = $replacement[$field];
                }
                $current['id'] = $before['id'];
            }
            $current = booking_validate($current);
            if (!booking_can_access($user, (string)$current['salon'])) throw new LogicException('Өөр салбарын цагийг өөрчлөх эрхгүй.');
            if ($action === 'update') booking_assert_slot_rules($current, $salons, $holidays);
            booking_assert_capacity($bookings, $current, $salons, $id);
            $bookings[$index] = $current;
            $after = $current;
            $resultBookings[] = $current;
            $affectedSalons[] = (string)$current['salon'];
        }
    }

    $actor = trim((string)($user['username'] ?? '')) ?: 'system';
    $auditEntry = [
        'id' => (int)(microtime(true) * 1000000),
        'title' => 'booking_' . ($action === 'status' ? 'status_updated' : ($action === 'delete' ? 'deleted' : ($action === 'create' ? 'created' : 'updated'))),
        'meta' => $actor . ' • ' . (string)(($resultBookings[0]['phone'] ?? null) ?? ($before['phone'] ?? '')) . ' • ' . ($action === 'create' ? count($resultBookings) . ' слот' : $action),
        'createdAt' => (new DateTimeImmutable('now', new DateTimeZone('Asia/Ulaanbaatar')))->format('Y-m-d H:i'),
    ];
    array_unshift($audit, $auditEntry);

    $nextRevision = $currentRevision + 1;
    booking_write_section($pdo, 'bookings', $bookings, $nextRevision);
    booking_write_section($pdo, 'audit', $audit, $nextRevision);
    $pdo->prepare("UPDATE app_meta SET meta_value = ? WHERE meta_key = 'revision'")->execute([(string)$nextRevision]);
    $scopeRevision = booking_bump_scopes($pdo, $affectedSalons);
    $change = $pdo->prepare('INSERT INTO app_change_events (operation_id, revision, entity_type, entity_id, parent_id, action, before_payload, after_payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $changeRows = $action === 'create'
        ? array_map(static fn(array $booking): array => ['before' => null, 'after' => $booking], $resultBookings)
        : [['before' => $before, 'after' => $after]];
    foreach ($changeRows as $changeRow) {
        $changeBefore = $changeRow['before'];
        $changeAfter = $changeRow['after'];
        $changeSubject = is_array($changeAfter) ? $changeAfter : (is_array($changeBefore) ? $changeBefore : []);
        $change->execute([
            $operationId,
            $nextRevision,
            'booking',
            (string)($changeSubject['id'] ?? ''),
            '',
            $action,
            $changeBefore === null ? null : json_encode($changeBefore, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            $changeAfter === null ? null : json_encode($changeAfter, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);
    }
    if ($action === 'delete' && is_array($before)) {
        $recovery = $pdo->prepare('INSERT INTO app_recovery_journal (revision, actor_user_id, actor_username, actor_role, actor_salon, entity_type, entity_id, parent_id, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $recovery->execute([
            $nextRevision,
            (int)($user['id'] ?? 0) ?: null,
            (string)($user['username'] ?? ''),
            (string)($user['role'] ?? ''),
            (string)($user['salon'] ?? ''),
            'booking',
            (string)($before['id'] ?? ''),
            '',
            json_encode($before, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);
    }

    $result = [
        'ok' => true,
        'revision' => $nextRevision,
        'scopeRevision' => $scopeRevision,
        'sectionRevisions' => ['bookings' => $nextRevision, 'audit' => $nextRevision],
        'action' => $action,
        'bookings' => $resultBookings,
        'deletedId' => $action === 'delete' ? (string)($before['id'] ?? '') : '',
        'auditEntry' => $auditEntry,
    ];
    $operation = $pdo->prepare('INSERT INTO app_operations (operation_id, revision, actor_user_id, actor_username, actor_role, actor_salon, sections, result_payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $operation->execute([
        $operationId,
        $nextRevision,
        (int)($user['id'] ?? 0) ?: null,
        (string)($user['username'] ?? ''),
        (string)($user['role'] ?? ''),
        (string)($user['salon'] ?? ''),
        json_encode(['bookings', 'audit']),
        json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
    $pdo->commit();
    json_response($result);
} catch (InvalidArgumentException $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    json_response(['ok' => false, 'message' => $error->getMessage()], 422);
} catch (OutOfBoundsException $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    json_response(['ok' => false, 'message' => $error->getMessage()], 404);
} catch (UnexpectedValueException $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    json_response(['ok' => false, 'conflict' => true, 'message' => $error->getMessage()], 409);
} catch (DomainException $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    json_response(['ok' => false, 'message' => $error->getMessage()], 409);
} catch (LogicException $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    json_response(['ok' => false, 'message' => $error->getMessage()], 403);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    $incidentId = gmdate('YmdHis') . '-' . bin2hex(random_bytes(3));
    $retryable = $error instanceof PDOException
        && in_array((int)($error->errorInfo[1] ?? 0), [1205, 1213, 2006], true);
    error_log('Booking mutation failed [' . $incidentId . ']: ' . $error->getMessage());
    json_response([
        'ok' => false,
        'message' => 'Захиалгыг серверт хадгалж чадсангүй.',
        'incidentId' => $incidentId,
        'retryable' => $retryable,
    ], 500);
}
