<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require __DIR__ . '/sms-service.php';

verify_same_origin();
$user = require_admin();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function sms_settings_code_matches(PDO $pdo, string $submitted): bool
{
    $statement = $pdo->query("SELECT payload FROM app_sections WHERE section_key = 'generalSettings' LIMIT 1");
    $settings = json_decode((string)($statement->fetchColumn() ?: '{}'), true);
    $expected = (string)(is_array($settings) ? ($settings['deleteCode'] ?? '1989') : '1989');
    return preg_match('/^\d{4}$/', $submitted) === 1 && hash_equals($expected, $submitted);
}

function sms_public_settings(array $settings): array
{
    unset($settings['token']);
    return $settings;
}

function sms_history_filters(): array
{
    $phone = preg_replace('/\D+/', '', (string)($_GET['phone'] ?? '')) ?? '';
    $from = trim((string)($_GET['from'] ?? ''));
    $to = trim((string)($_GET['to'] ?? ''));
    $event = trim((string)($_GET['event'] ?? ''));
    $validDate = static fn(string $value): bool => $value === '' || preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1;
    $validEvents = ['created', 'confirmed', 'changed', 'cancelled', 'reminder', 'test'];
    if (!$validDate($from) || !$validDate($to)) json_response(['ok' => false, 'message' => 'Огнооны шүүлтүүр буруу байна.'], 422);
    if ($event !== '' && !in_array($event, $validEvents, true)) json_response(['ok' => false, 'message' => 'SMS төрөл буруу байна.'], 422);
    if ($from !== '' && $to !== '' && $from > $to) json_response(['ok' => false, 'message' => 'Эхлэх огноо дуусах огнооноос хойш байж болохгүй.'], 422);
    return ['phone' => substr($phone, 0, 8), 'from' => $from, 'to' => $to, 'event' => $event];
}

function sms_history(PDO $pdo, int $page = 1, array $filters = []): array
{
    $pageSize = 100;
    $page = max(1, $page);
    $where = [];
    $params = [];
    if (($filters['phone'] ?? '') !== '') {
        $where[] = 'phone LIKE ?';
        $params[] = $filters['phone'] . '%';
    }
    if (($filters['from'] ?? '') !== '') {
        $where[] = 'created_at >= ?';
        $params[] = $filters['from'] . ' 00:00:00';
    }
    if (($filters['to'] ?? '') !== '') {
        $where[] = 'created_at < DATE_ADD(?, INTERVAL 1 DAY)';
        $params[] = $filters['to'] . ' 00:00:00';
    }
    if (($filters['event'] ?? '') !== '') {
        $where[] = 'event_type = ?';
        $params[] = $filters['event'];
    }
    $whereSql = $where ? ' WHERE ' . implode(' AND ', $where) : '';
    $count = $pdo->prepare('SELECT COUNT(*) FROM app_sms_messages' . $whereSql);
    $count->execute($params);
    $total = (int)$count->fetchColumn();
    $pageCount = max(1, (int)ceil($total / $pageSize));
    $page = min($page, $pageCount);
    $offset = ($page - 1) * $pageSize;
    $statement = $pdo->prepare("SELECT id, booking_id, event_type, phone, salon, booking_date, booking_time, message, scheduled_for, status, attempts, max_attempts, last_error, sent_at, created_at FROM app_sms_messages{$whereSql} ORDER BY id DESC LIMIT {$pageSize} OFFSET {$offset}");
    $statement->execute($params);
    return [
        'items' => $statement->fetchAll(),
        'pagination' => ['page' => $page, 'pageSize' => $pageSize, 'pageCount' => $pageCount, 'total' => $total],
        'filters' => $filters,
    ];
}

if ($method === 'GET') {
    $view = trim((string)($_GET['view'] ?? 'settings'));
    if ($view === 'history') {
        $history = sms_history($pdo, (int)($_GET['page'] ?? 1), sms_history_filters());
        json_response(['ok' => true, 'history' => $history['items'], 'pagination' => $history['pagination'], 'filters' => $history['filters']]);
    }
    json_response([
        'ok' => true,
        'settings' => sms_public_settings(sms_load_settings($pdo)),
        'timezone' => SMS_TIMEZONE,
        'firstCheckHour' => SMS_FIRST_CHECK_HOUR,
    ]);
}

if (!in_array($method, ['PUT', 'POST'], true)) {
    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
}

$payload = request_payload();
$code = trim((string)($payload['code'] ?? ''));
if (!sms_settings_code_matches($pdo, $code)) {
    json_response(['ok' => false, 'message' => 'Засах код буруу байна.'], 403);
}

if ($method === 'PUT') {
    $incoming = is_array($payload['settings'] ?? null) ? $payload['settings'] : [];
    $current = sms_load_settings($pdo, true);
    $enabled = ($incoming['enabled'] ?? false) === true;
    $apiUrl = trim((string)($incoming['apiUrl'] ?? ''));
    if ($apiUrl !== '') {
        $urlForValidation = strtr($apiUrl, ['{recipient}' => '99112233', '{message}' => 'test', '{token}' => 'token']);
        $scheme = strtolower((string)parse_url($urlForValidation, PHP_URL_SCHEME));
        if (filter_var($urlForValidation, FILTER_VALIDATE_URL) === false || !in_array($scheme, ['http', 'https'], true)) {
            json_response(['ok' => false, 'message' => 'SMS API URL буруу байна.'], 422);
        }
    }
    $normalized = sms_normalize_settings($incoming);
    $eventLabels = ['created' => 'Шинэ захиалга', 'confirmed' => 'Цаг баталгаажуулалт', 'changed' => 'Цаг өөрчлөлт', 'cancelled' => 'Цаг цуцлалт', 'reminder' => 'Цагийн сануулга'];
    foreach ($normalized['events'] as $event => $eventEnabled) {
        if (!$eventEnabled) continue;
        $lengthError = sms_message_length_error(sms_template_estimated_message((string)($normalized['templates'][$event] ?? '')), (int)$normalized['characterLimit']);
        if ($lengthError !== '') json_response(['ok' => false, 'message' => ($eventLabels[$event] ?? $event) . ': ' . $lengthError], 422);
    }
    $token = trim((string)($incoming['token'] ?? ''));
    if ($token === '') $token = (string)($current['token'] ?? '');
    if ($enabled && ($apiUrl === '' || $token === '')) {
        json_response(['ok' => false, 'message' => 'SMS идэвхжүүлэхийн тулд API URL болон token оруулна уу.'], 422);
    }
    $configJson = json_encode([
        'reminderHours' => $normalized['reminderHours'],
        'characterLimit' => $normalized['characterLimit'],
        'events' => $normalized['events'],
        'templates' => $normalized['templates'],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($configJson === false) json_response(['ok' => false, 'message' => 'SMS тохиргоог хөрвүүлж чадсангүй.'], 500);
    try {
        $tokenCipher = $token !== '' ? sms_encrypt_token($token) : '';
        $pdo->beginTransaction();
        $statement = $pdo->prepare('INSERT INTO app_sms_settings (id, enabled, api_url, token_cipher, settings_json, updated_by) VALUES (1, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), api_url = VALUES(api_url), token_cipher = VALUES(token_cipher), settings_json = VALUES(settings_json), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP');
        $statement->execute([$enabled ? 1 : 0, $apiUrl, $tokenCipher, $configJson, (string)($user['username'] ?? '')]);
        if (!$enabled) {
            $pdo->exec("UPDATE app_sms_messages SET status = 'cancelled', last_error = 'SMS үйлчилгээ унтраасан', updated_at = CURRENT_TIMESTAMP WHERE status IN ('pending', 'failed')");
        } else {
            foreach ($normalized['events'] as $event => $eventEnabled) {
                if ($eventEnabled) continue;
                $cancel = $pdo->prepare("UPDATE app_sms_messages SET status = 'cancelled', last_error = 'Тухайн SMS төрөл унтраасан', updated_at = CURRENT_TIMESTAMP WHERE event_type = ? AND status IN ('pending', 'failed')");
                $cancel->execute([$event]);
            }
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        json_response(['ok' => false, 'message' => $error->getMessage()], 500);
    }
    json_response(['ok' => true, 'settings' => sms_public_settings(sms_load_settings($pdo))]);
}

$action = trim((string)($payload['action'] ?? ''));
if ($action === 'test') {
    $phone = sms_normalize_phone((string)($payload['phone'] ?? ''));
    if ($phone === '') json_response(['ok' => false, 'message' => 'Туршилтын утас 8 оронтой байна.'], 422);
    $settings = sms_load_settings($pdo, true);
    if (($settings['enabled'] ?? false) !== true || trim((string)($settings['apiUrl'] ?? '')) === '' || trim((string)($settings['token'] ?? '')) === '') {
        json_response(['ok' => false, 'message' => 'Эхлээд SMS тохиргоогоо идэвхжүүлж хадгална уу.'], 409);
    }
    $now = new DateTimeImmutable('now', new DateTimeZone(SMS_TIMEZONE));
    $booking = ['id' => 'test-' . bin2hex(random_bytes(6)), 'phone' => $phone, 'salon' => 'Туршилт', 'date' => $now->format('Y-m-d'), 'time' => $now->format('H:i')];
    $id = sms_enqueue_row($pdo, 'test:' . bin2hex(random_bytes(16)), 'test', $booking, 'Халгай SMS холболтын туршилт амжилттай.', $now);
    $result = $id ? sms_dispatch_message($pdo, $id) : ['ok' => false, 'error' => 'Туршилтын SMS үүссэнгүй.'];
    if (($result['ok'] ?? false) !== true) json_response(['ok' => false, 'message' => (string)($result['error'] ?? $result['message'] ?? 'SMS илгээгдсэнгүй.')], 502);
    json_response(['ok' => true, 'message' => 'Туршилтын SMS амжилттай илгээгдлээ.']);
}

if ($action === 'retry') {
    $id = (int)($payload['id'] ?? 0);
    if ($id < 1) json_response(['ok' => false, 'message' => 'SMS бүртгэл олдсонгүй.'], 404);
    $reset = $pdo->prepare("UPDATE app_sms_messages SET status = 'pending', attempts = 0, next_attempt_at = ?, last_error = '', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('failed', 'permanent_failed')");
    $reset->execute([(new DateTimeImmutable('now', new DateTimeZone(SMS_TIMEZONE)))->format('Y-m-d H:i:s'), $id]);
    if ($reset->rowCount() < 1) json_response(['ok' => false, 'message' => 'Дахин илгээх боломжгүй төлөвтэй байна.'], 409);
    $result = sms_dispatch_message($pdo, $id);
    json_response(['ok' => (bool)($result['ok'] ?? false), 'message' => ($result['ok'] ?? false) ? 'SMS амжилттай илгээгдлээ.' : (string)($result['error'] ?? 'SMS илгээгдсэнгүй.')], ($result['ok'] ?? false) ? 200 : 502);
}

json_response(['ok' => false, 'message' => 'SMS үйлдэл буруу байна.'], 422);
