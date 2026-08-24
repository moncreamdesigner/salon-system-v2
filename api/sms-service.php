<?php
declare(strict_types=1);

const SMS_TIMEZONE = 'Asia/Ulaanbaatar';
const SMS_FIRST_CHECK_HOUR = 6;
const SMS_UNICODE_LIMIT = 70;
const SMS_LATIN_LIMIT = 160;
const SMS_ADMIN_LIMIT_MAX = 1000;

function sms_legacy_templates(): array
{
    return [
        'created' => 'Халгай: Таны {date}-ны {time} цагийн захиалгыг хүлээн авлаа. Салбар: {branch}.',
        'confirmed' => 'Халгай: Таны {date}-ны {time} цагийн захиалга баталгаажлаа. Товлосон цагтаа хүрэлцэн ирээрэй.',
        'changed' => 'Халгай: Таны цаг {old_date} {old_time}-аас {new_date} {new_time} болж өөрчлөгдлөө. Салбар: {branch}.',
        'cancelled' => 'Халгай: Таны {date}-ны {time} цагийн захиалга цуцлагдлаа. Холбоо барих: {branch_phone}.',
        'reminder' => 'Халгай: Таны {branch} салбар дахь цаг өнөөдөр {time}-т эхэлнэ. Товлосон цагтаа хүрэлцэн ирээрэй.',
    ];
}

function sms_default_templates(): array
{
    return [
        'created' => 'Халгай: {date} {time}, {branch}. Захиалга бүртгэгдлээ.',
        'confirmed' => 'Халгай: {date} {time}, {branch}. Цаг баталгаажлаа.',
        'changed' => 'Халгай: Цаг {new_date} {new_time} болж өөрчлөгдлөө. {branch}',
        'cancelled' => 'Халгай: {date} {time}-ийн цаг цуцлагдлаа. {branch_phone}',
        'reminder' => 'Халгай: {branch}, өнөөдөр {time}. Цагаа барина уу.',
    ];
}

function sms_default_settings(): array
{
    return [
        'enabled' => false,
        'apiUrl' => '',
        'tokenConfigured' => false,
        'reminderHours' => 3,
        'characterLimit' => SMS_UNICODE_LIMIT,
        'events' => [
            'created' => false,
            'confirmed' => false,
            'changed' => false,
            'cancelled' => false,
            'reminder' => false,
        ],
        'templates' => sms_default_templates(),
    ];
}

function sms_normalize_settings(array $stored): array
{
    $defaults = sms_default_settings();
    $legacyTemplates = sms_legacy_templates();
    $events = is_array($stored['events'] ?? null) ? $stored['events'] : [];
    $templates = is_array($stored['templates'] ?? null) ? $stored['templates'] : [];
    foreach (array_keys($defaults['events']) as $event) {
        $defaults['events'][$event] = ($events[$event] ?? false) === true;
        $template = trim((string)($templates[$event] ?? $defaults['templates'][$event]));
        if ($template === ($legacyTemplates[$event] ?? null)) $template = $defaults['templates'][$event];
        $defaults['templates'][$event] = mb_substr($template !== '' ? $template : $defaults['templates'][$event], 0, 1000);
    }
    $defaults['reminderHours'] = max(1, min(3, (int)($stored['reminderHours'] ?? 3)));
    $defaults['characterLimit'] = max(1, min(SMS_ADMIN_LIMIT_MAX, (int)($stored['characterLimit'] ?? SMS_UNICODE_LIMIT)));
    return $defaults;
}

function sms_crypto_key(): string
{
    $config = private_config();
    return hash('sha256', 'khalgai-sms|' . (string)($config['db_name'] ?? '') . '|' . (string)($config['db_pass'] ?? ''), true);
}

function sms_encrypt_token(string $token): string
{
    if (!function_exists('openssl_encrypt')) throw new RuntimeException('Server token хамгаалах боломжгүй байна.');
    $iv = random_bytes(12);
    $tag = '';
    $cipher = openssl_encrypt($token, 'aes-256-gcm', sms_crypto_key(), OPENSSL_RAW_DATA, $iv, $tag);
    if ($cipher === false) throw new RuntimeException('SMS token хамгаалж чадсангүй.');
    return base64_encode($iv . $tag . $cipher);
}

function sms_decrypt_token(string $encoded): string
{
    if ($encoded === '' || !function_exists('openssl_decrypt')) return '';
    $raw = base64_decode($encoded, true);
    if ($raw === false || strlen($raw) < 29) return '';
    $iv = substr($raw, 0, 12);
    $tag = substr($raw, 12, 16);
    $cipher = substr($raw, 28);
    $plain = openssl_decrypt($cipher, 'aes-256-gcm', sms_crypto_key(), OPENSSL_RAW_DATA, $iv, $tag);
    return is_string($plain) ? $plain : '';
}

function sms_load_settings(PDO $pdo, bool $includeToken = false): array
{
    $statement = $pdo->query('SELECT enabled, api_url, token_cipher, settings_json, updated_by, updated_at FROM app_sms_settings WHERE id = 1 LIMIT 1');
    $row = $statement->fetch();
    $settings = sms_default_settings();
    if (!$row) {
        if ($includeToken) $settings['token'] = '';
        return $settings;
    }
    $decoded = json_decode((string)$row['settings_json'], true);
    $settings = sms_normalize_settings(is_array($decoded) ? $decoded : []);
    $settings['enabled'] = (bool)$row['enabled'];
    $settings['apiUrl'] = trim((string)$row['api_url']);
    $settings['tokenConfigured'] = trim((string)$row['token_cipher']) !== '';
    $settings['updatedBy'] = (string)$row['updated_by'];
    $settings['updatedAt'] = (string)$row['updated_at'];
    if ($includeToken) $settings['token'] = sms_decrypt_token((string)$row['token_cipher']);
    return $settings;
}

function sms_event_enabled(array $settings, string $event): bool
{
    return ($settings['enabled'] ?? false) === true && ($settings['events'][$event] ?? false) === true;
}

function sms_normalize_phone(string $value): string
{
    $digits = preg_replace('/\D+/', '', $value) ?: '';
    if (strlen($digits) === 11 && str_starts_with($digits, '976')) $digits = substr($digits, 3);
    return preg_match('/^\d{8}$/', $digits) === 1 ? $digits : '';
}

function sms_mn_date(string $date): string
{
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date, new DateTimeZone(SMS_TIMEZONE));
    return $parsed ? $parsed->format('n') . ' sariin ' . $parsed->format('j') : $date;
}

function sms_date_parts(string $date, string $prefix = ''): array
{
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date, new DateTimeZone(SMS_TIMEZONE));
    $keyPrefix = $prefix !== '' ? $prefix . '_' : '';
    return [
        '{' . $keyPrefix . 'month}' => $parsed ? $parsed->format('n') : '',
        '{' . $keyPrefix . 'day}' => $parsed ? $parsed->format('j') : '',
    ];
}
function sms_latinize(string $value): string
{
    return strtr($value, [
        'А'=>'A','Б'=>'B','В'=>'V','Г'=>'G','Д'=>'D','Е'=>'E','Ё'=>'Yo','Ж'=>'J','З'=>'Z','И'=>'I','Й'=>'I','К'=>'K','Л'=>'L','М'=>'M','Н'=>'N','О'=>'O','Ө'=>'U','П'=>'P','Р'=>'R','С'=>'S','Т'=>'T','У'=>'U','Ү'=>'U','Ф'=>'F','Х'=>'Kh','Ц'=>'Ts','Ч'=>'Ch','Ш'=>'Sh','Щ'=>'Sh','Ъ'=>'','Ы'=>'Y','Ь'=>'','Э'=>'E','Ю'=>'Yu','Я'=>'Ya',
        'а'=>'a','б'=>'b','в'=>'v','г'=>'g','д'=>'d','е'=>'e','ё'=>'yo','ж'=>'j','з'=>'z','и'=>'i','й'=>'i','к'=>'k','л'=>'l','м'=>'m','н'=>'n','о'=>'o','ө'=>'u','п'=>'p','р'=>'r','с'=>'s','т'=>'t','у'=>'u','ү'=>'u','ф'=>'f','х'=>'kh','ц'=>'ts','ч'=>'ch','ш'=>'sh','щ'=>'sh','ъ'=>'','ы'=>'y','ь'=>'','э'=>'e','ю'=>'yu','я'=>'ya',
    ]);
}
function sms_message_limit(string $message): int
{
    return preg_match('/[^\x00-\x7F]/', $message) === 1 ? SMS_UNICODE_LIMIT : SMS_LATIN_LIMIT;
}

function sms_message_length_error(string $message, ?int $configuredLimit = null): string
{
    $length = mb_strlen($message);
    $limit = max(1, min(SMS_ADMIN_LIMIT_MAX, $configuredLimit ?? SMS_UNICODE_LIMIT));
    return $length > $limit ? "SMS агуулга {$length}/{$limit} тэмдэгт байна. Загварыг богиносгоно уу." : '';
}

function sms_template_estimated_message(string $template): string
{
    return strtr($template, [
        '{customer_name}' => 'Хэрэглэгч',
        '{date}' => '12 sariin 31',
        '{month}' => '12',
        '{day}' => '31',
        '{time}' => '18:00',
        '{branch}' => 'Chingeltei salon',
        '{branch_phone}' => '99112233',
        '{old_date}' => '12 sariin 31',
        '{old_month}' => '12',
        '{old_day}' => '31',
        '{old_time}' => '18:00',
        '{new_date}' => '12 sariin 31',
        '{new_month}' => '12',
        '{new_day}' => '31',
        '{new_time}' => '18:00',
    ]);
}

function sms_section_rows(PDO $pdo, string $section): array
{
    static $cache = [];
    $cacheKey = spl_object_id($pdo) . ':' . $section;
    if (array_key_exists($cacheKey, $cache)) return $cache[$cacheKey];
    $statement = $pdo->prepare('SELECT payload FROM app_sections WHERE section_key = ? LIMIT 1');
    $statement->execute([$section]);
    $decoded = json_decode((string)($statement->fetchColumn() ?: '[]'), true);
    $cache[$cacheKey] = is_array($decoded) ? array_values($decoded) : [];
    return $cache[$cacheKey];
}

function sms_booking_context(PDO $pdo, array $booking, ?array $before = null): array
{
    $phone = sms_normalize_phone((string)($booking['phone'] ?? ''));
    $customerName = '';
    foreach (sms_section_rows($pdo, 'customers') as $customer) {
        if (!is_array($customer)) continue;
        if (sms_normalize_phone((string)($customer['phone'] ?? '')) === $phone) {
            $customerName = trim((string)($customer['name'] ?? ''));
            break;
        }
    }
    $branchPhone = '';
    foreach (sms_section_rows($pdo, 'salons') as $salon) {
        if (!is_array($salon) || trim((string)($salon['name'] ?? '')) !== trim((string)($booking['salon'] ?? ''))) continue;
        $branchPhone = sms_normalize_phone((string)($salon['phone'] ?? ''));
        break;
    }
    return array_merge([
        '{customer_name}' => sms_latinize($customerName),
        '{date}' => sms_mn_date((string)($booking['date'] ?? '')),
        '{time}' => (string)($booking['time'] ?? ''),
        '{branch}' => sms_latinize((string)($booking['salon'] ?? '')),
        '{branch_phone}' => $branchPhone,
        '{old_date}' => sms_mn_date((string)($before['date'] ?? '')),
        '{old_time}' => (string)($before['time'] ?? ''),
        '{new_date}' => sms_mn_date((string)($booking['date'] ?? '')),
        '{new_time}' => (string)($booking['time'] ?? ''),
    ],
        sms_date_parts((string)($booking['date'] ?? '')),
        sms_date_parts((string)($before['date'] ?? ''), 'old'),
        sms_date_parts((string)($booking['date'] ?? ''), 'new'));
}

function sms_render_booking_template(PDO $pdo, array $settings, string $event, array $booking, ?array $before = null): string
{
    $template = (string)($settings['templates'][$event] ?? sms_default_templates()[$event] ?? '');
    return sms_latinize(trim(strtr($template, sms_booking_context($pdo, $booking, $before))));
}

function sms_booking_datetime(array $booking): ?DateTimeImmutable
{
    $value = trim((string)($booking['date'] ?? '')) . ' ' . trim((string)($booking['time'] ?? ''));
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d H:i', $value, new DateTimeZone(SMS_TIMEZONE));
    return $parsed && $parsed->format('Y-m-d H:i') === $value ? $parsed : null;
}

function sms_cancel_pending_reminders(PDO $pdo, string $bookingId): void
{
    $statement = $pdo->prepare("UPDATE app_sms_messages SET status = 'cancelled', last_error = 'Захиалга өөрчлөгдсөн эсвэл цуцлагдсан', updated_at = CURRENT_TIMESTAMP WHERE booking_id = ? AND event_type = 'reminder' AND status IN ('pending', 'failed')");
    $statement->execute([$bookingId]);
}

function sms_enqueue_row(PDO $pdo, string $dedupeKey, string $event, array $booking, string $message, DateTimeImmutable $scheduledFor): ?int
{
    $phone = sms_normalize_phone((string)($booking['phone'] ?? ''));
    if ($phone === '' || $message === '') return null;
    $statement = $pdo->prepare("INSERT IGNORE INTO app_sms_messages (dedupe_key, booking_id, event_type, phone, salon, booking_date, booking_time, message, scheduled_for, status, max_attempts, next_attempt_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 3, ?)");
    $scheduled = $scheduledFor->format('Y-m-d H:i:s');
    $statement->execute([
        mb_substr($dedupeKey, 0, 190),
        (string)($booking['id'] ?? ''),
        $event,
        $phone,
        (string)($booking['salon'] ?? ''),
        (string)($booking['date'] ?? '') ?: null,
        (string)($booking['time'] ?? ''),
        $message,
        $scheduled,
        $scheduled,
    ]);
    return $statement->rowCount() > 0 ? (int)$pdo->lastInsertId() : null;
}

function sms_enqueue_reminder(PDO $pdo, array $settings, array $booking, bool $rescheduled = false): ?int
{
    if (!sms_event_enabled($settings, 'reminder') || (string)($booking['status'] ?? '') !== 'confirmed') return null;
    $appointment = sms_booking_datetime($booking);
    if (!$appointment) return null;
    $now = new DateTimeImmutable('now', new DateTimeZone(SMS_TIMEZONE));
    if ($rescheduled && $appointment <= $now->modify('+24 hours')) return null;
    $hours = max(1, min(3, (int)($settings['reminderHours'] ?? 3)));
    $scheduled = $appointment->modify('-' . $hours . ' hours');
    if ((int)$scheduled->format('G') < SMS_FIRST_CHECK_HOUR) {
        $scheduled = $scheduled->setTime(SMS_FIRST_CHECK_HOUR, 0);
    }
    if ($scheduled <= $now) return null;
    $message = sms_render_booking_template($pdo, $settings, 'reminder', $booking);
    $signature = hash('sha256', (string)($booking['date'] ?? '') . '|' . (string)($booking['time'] ?? '') . '|' . $hours);
    return sms_enqueue_row($pdo, 'booking:' . (string)($booking['id'] ?? '') . ':reminder:' . $signature, 'reminder', $booking, $message, $scheduled);
}

function sms_enqueue_booking_event(PDO $pdo, string $event, array $booking, ?array $before = null): array
{
    $settings = sms_load_settings($pdo);
    $ids = [];
    $bookingId = (string)($booking['id'] ?? ($before['id'] ?? ''));
    if (in_array($event, ['changed', 'cancelled', 'deleted'], true) && $bookingId !== '') {
        sms_cancel_pending_reminders($pdo, $bookingId);
    }
    if ($event !== 'deleted' && sms_event_enabled($settings, $event)) {
        $now = new DateTimeImmutable('now', new DateTimeZone(SMS_TIMEZONE));
        $message = sms_render_booking_template($pdo, $settings, $event, $booking, $before);
        $signature = $event === 'changed'
            ? ':' . hash('sha256', json_encode([$before['salon'] ?? '', $before['date'] ?? '', $before['time'] ?? '', $booking['salon'] ?? '', $booking['date'] ?? '', $booking['time'] ?? '']) ?: '')
            : '';
        $id = sms_enqueue_row($pdo, 'booking:' . $bookingId . ':' . $event . $signature, $event, $booking, $message, $now);
        if ($id) $ids[] = $id;
    }
    if (in_array($event, ['confirmed', 'changed'], true)) {
        $reminderId = sms_enqueue_reminder($pdo, $settings, $booking, $event === 'changed');
        if ($reminderId) $ids[] = $reminderId;
    }
    return $ids;
}

function sms_enqueue_booking_event_safely(PDO $pdo, string $event, array $booking, ?array $before = null): array
{
    $usesSavepoint = $pdo->inTransaction();
    try {
        if ($usesSavepoint) $pdo->exec('SAVEPOINT sms_event_queue');
        $ids = sms_enqueue_booking_event($pdo, $event, $booking, $before);
        if ($usesSavepoint) $pdo->exec('RELEASE SAVEPOINT sms_event_queue');
        return $ids;
    } catch (Throwable $ignored) {
        if ($usesSavepoint && $pdo->inTransaction()) {
            try {
                $pdo->exec('ROLLBACK TO SAVEPOINT sms_event_queue');
                $pdo->exec('RELEASE SAVEPOINT sms_event_queue');
            } catch (Throwable $rollbackIgnored) {
                // The booking transaction remains the source of truth. Its
                // own commit/catch path will decide whether it can continue.
            }
        }
        return [];
    }
}

function sms_provider_url(array $settings, string $phone, string $message): string
{
    $url = trim((string)($settings['apiUrl'] ?? ''));
    $token = (string)($settings['token'] ?? '');
    $placeholders = [
        'token' => str_contains($url, '{token}'),
        'sendto' => str_contains($url, '{recipient}'),
        'message' => str_contains($url, '{message}'),
    ];
    $replace = [
        '{recipient}' => rawurlencode($phone),
        '{message}' => rawurlencode($message),
        '{token}' => rawurlencode($token),
    ];
    $url = strtr($url, $replace);
    $missing = [];
    if (!$placeholders['token']) $missing['token'] = $token;
    if (!$placeholders['sendto']) $missing['sendto'] = $phone;
    if (!$placeholders['message']) $missing['message'] = $message;
    if ($missing) {
        $separator = str_contains($url, '?') ? '&' : '?';
        $url .= $separator . http_build_query($missing, '', '&', PHP_QUERY_RFC3986);
    }
    return $url;
}

function sms_http_send(array $settings, string $phone, string $message): array
{
    $lengthError = sms_message_length_error($message, (int)($settings['characterLimit'] ?? SMS_UNICODE_LIMIT));
    if ($lengthError !== '') return ['ok' => false, 'retryable' => false, 'error' => $lengthError, 'response' => ''];
    $url = sms_provider_url($settings, $phone, $message);
    $scheme = strtolower((string)parse_url($url, PHP_URL_SCHEME));
    if (!in_array($scheme, ['http', 'https'], true)) return ['ok' => false, 'error' => 'API URL буруу байна.', 'response' => ''];
    $status = 0;
    $body = '';
    if (function_exists('curl_init')) {
        $handle = curl_init($url);
        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_USERAGENT => 'KhalgaiSalonSMS/1.0',
        ]);
        $result = curl_exec($handle);
        $status = (int)curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $error = curl_error($handle);
        curl_close($handle);
        if ($result === false) return ['ok' => false, 'error' => $error !== '' ? $error : 'SMS сервертэй холбогдсонгүй.', 'response' => ''];
        $body = (string)$result;
    } else {
        $context = stream_context_create(['http' => ['timeout' => 8, 'ignore_errors' => true, 'user_agent' => 'KhalgaiSalonSMS/1.0']]);
        $result = @file_get_contents($url, false, $context);
        $headers = $http_response_header ?? [];
        if (isset($headers[0]) && preg_match('/\s(\d{3})\s/', $headers[0], $match)) $status = (int)$match[1];
        if ($result === false) return ['ok' => false, 'error' => 'SMS сервертэй холбогдсонгүй.', 'response' => ''];
        $body = (string)$result;
    }
    $httpOk = $status >= 200 && $status < 300;
    $response = mb_substr($body, 0, 1000);
    if (!$httpOk) return ['ok' => false, 'retryable' => true, 'error' => 'SMS сервер HTTP ' . $status . ' буцаалаа.', 'response' => $response];
    $decoded = json_decode($body, true);
    if (is_array($decoded) && array_key_exists('status', $decoded)) {
        $providerOk = (int)$decoded['status'] === 1;
        if (array_key_exists('sent_count', $decoded)) $providerOk = $providerOk && (int)$decoded['sent_count'] > 0;
        if (!$providerOk) {
            $providerMessage = trim((string)($decoded['message'] ?? ''));
            return [
                'ok' => false,
                'retryable' => false,
                'error' => $providerMessage !== '' ? $providerMessage : 'SMS provider илгээлтийг татгалзлаа.',
                'response' => $response,
            ];
        }
    }
    return ['ok' => true, 'retryable' => false, 'error' => '', 'response' => $response];
}

function sms_dispatch_message(PDO $pdo, int $messageId): array
{
    $settings = sms_load_settings($pdo, true);
    if (($settings['enabled'] ?? false) !== true || trim((string)($settings['apiUrl'] ?? '')) === '' || trim((string)($settings['token'] ?? '')) === '') {
        return ['ok' => false, 'skipped' => true, 'message' => 'SMS тохиргоо идэвхгүй эсвэл дутуу байна.'];
    }
    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare("SELECT * FROM app_sms_messages WHERE id = ? AND status IN ('pending', 'failed') LIMIT 1 FOR UPDATE");
        $statement->execute([$messageId]);
        $row = $statement->fetch();
        if (!$row) {
            $pdo->rollBack();
            return ['ok' => true, 'skipped' => true];
        }
        if ((int)$row['attempts'] >= (int)$row['max_attempts']) {
            $pdo->prepare("UPDATE app_sms_messages SET status = 'permanent_failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?")->execute([$messageId]);
            $pdo->commit();
            return ['ok' => false, 'skipped' => true, 'message' => 'Дахин оролдох хязгаар дууссан.'];
        }
        $pdo->prepare("UPDATE app_sms_messages SET status = 'sending', attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?")->execute([$messageId]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    $result = sms_http_send($settings, (string)$row['phone'], (string)$row['message']);
    if ($result['ok']) {
        $update = $pdo->prepare("UPDATE app_sms_messages SET status = 'sent', sent_at = ?, next_attempt_at = NULL, last_error = '', provider_response = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        $update->execute([(new DateTimeImmutable('now', new DateTimeZone(SMS_TIMEZONE)))->format('Y-m-d H:i:s'), $result['response'], $messageId]);
    } else {
        $attempts = (int)$row['attempts'] + 1;
        $final = ($result['retryable'] ?? true) !== true || $attempts >= (int)$row['max_attempts'];
        $update = $pdo->prepare("UPDATE app_sms_messages SET status = ?, next_attempt_at = ?, last_error = ?, provider_response = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        $retryAt = $final ? null : (new DateTimeImmutable('now', new DateTimeZone(SMS_TIMEZONE)))->modify('+1 hour')->format('Y-m-d H:i:s');
        $update->execute([$final ? 'permanent_failed' : 'failed', $retryAt, mb_substr((string)$result['error'], 0, 500), $result['response'], $messageId]);
    }
    return $result;
}

function sms_dispatch_immediate(PDO $pdo, array $ids): void
{
    foreach ($ids as $id) {
        try {
            $statement = $pdo->prepare("SELECT event_type FROM app_sms_messages WHERE id = ? LIMIT 1");
            $statement->execute([(int)$id]);
            if ((string)$statement->fetchColumn() === 'reminder') continue;
            sms_dispatch_message($pdo, (int)$id);
        } catch (Throwable $ignored) {
            // Booking is already durable; SMS failure stays visible in history.
        }
    }
}

function sms_last_bookable_minutes(array $salon, DateTimeImmutable $date): ?int
{
    $schedule = is_array($salon['schedule'] ?? null) ? $salon['schedule'] : [];
    $weekend = in_array((int)$date->format('N'), [6, 7], true);
    $end = (string)($schedule[$weekend ? 'weekendEnd' : 'workEnd'] ?? '19:00');
    if (preg_match('/^(\d{2}):(\d{2})$/', $end, $parts) !== 1) return null;
    return ((int)$parts[1] * 60) + (int)$parts[2] - 120;
}

function sms_salon_is_closed(PDO $pdo, string $salonName, string $date): bool
{
    foreach (sms_section_rows($pdo, 'holidays') as $holiday) {
        if (!is_array($holiday) || (string)($holiday['date'] ?? '') !== $date) continue;
        $single = trim((string)($holiday['salon'] ?? ''));
        if ($single !== '' && ($single === $salonName || $single === '*')) return true;
        $salons = is_array($holiday['salons'] ?? null) ? $holiday['salons'] : [];
        if (in_array($salonName, $salons, true) || in_array('*', $salons, true)) return true;
    }
    return false;
}

function sms_current_check_window_allows(PDO $pdo, array $settings, DateTimeImmutable $now): bool
{
    $nowMinutes = ((int)$now->format('G') * 60) + (int)$now->format('i');
    if ($nowMinutes < SMS_FIRST_CHECK_HOUR * 60) return false;
    $hours = max(1, min(3, (int)($settings['reminderHours'] ?? 3)));
    $latestReminder = null;
    foreach (sms_section_rows($pdo, 'salons') as $salon) {
        if (!is_array($salon) || (($salon['active'] ?? true) === false)) continue;
        $name = trim((string)($salon['name'] ?? ''));
        if ($name === '' || sms_salon_is_closed($pdo, $name, $now->format('Y-m-d'))) continue;
        $lastSlot = sms_last_bookable_minutes($salon, $now);
        if ($lastSlot === null) continue;
        $candidate = $lastSlot - ($hours * 60);
        $latestReminder = $latestReminder === null ? $candidate : max($latestReminder, $candidate);
    }
    return $latestReminder !== null && $nowMinutes <= $latestReminder + 59;
}

function sms_reminder_window_allows(PDO $pdo, array $settings, array $message, DateTimeImmutable $now): bool
{
    if ((int)$now->format('G') < SMS_FIRST_CHECK_HOUR) return false;
    $salonRow = null;
    foreach (sms_section_rows($pdo, 'salons') as $salon) {
        if (is_array($salon) && trim((string)($salon['name'] ?? '')) === trim((string)($message['salon'] ?? ''))) {
            $salonRow = $salon;
            break;
        }
    }
    if (!$salonRow || (($salonRow['active'] ?? true) === false)) return false;
    if (sms_salon_is_closed($pdo, (string)($salonRow['name'] ?? ''), $now->format('Y-m-d'))) return false;
    $today = new DateTimeImmutable($now->format('Y-m-d'), new DateTimeZone(SMS_TIMEZONE));
    $lastSlot = sms_last_bookable_minutes($salonRow, $today);
    if ($lastSlot === null) return false;
    $lastReminder = $lastSlot - (max(1, min(3, (int)($settings['reminderHours'] ?? 3))) * 60);
    $nowMinutes = ((int)$now->format('G') * 60) + (int)$now->format('i');
    return $nowMinutes <= $lastReminder + 59;
}

function sms_dispatch_due(PDO $pdo): array
{
    $settings = sms_load_settings($pdo, true);
    $now = new DateTimeImmutable('now', new DateTimeZone(SMS_TIMEZONE));
    if (($settings['enabled'] ?? false) !== true || !sms_current_check_window_allows($pdo, $settings, $now)) return ['checked' => 0, 'sent' => 0];
    $statement = $pdo->prepare("SELECT * FROM app_sms_messages WHERE ((status = 'pending' AND scheduled_for <= ?) OR (status = 'failed' AND next_attempt_at IS NOT NULL AND next_attempt_at <= ?)) AND attempts < max_attempts ORDER BY scheduled_for ASC LIMIT 100");
    $timestamp = $now->format('Y-m-d H:i:s');
    $statement->execute([$timestamp, $timestamp]);
    $rows = $statement->fetchAll();
    $sent = 0;
    foreach ($rows as $row) {
        if ((string)$row['event_type'] === 'reminder' && !sms_reminder_window_allows($pdo, $settings, $row, $now)) continue;
        $result = sms_dispatch_message($pdo, (int)$row['id']);
        if (($result['ok'] ?? false) === true) $sent++;
    }
    return ['checked' => count($rows), 'sent' => $sent];
}
