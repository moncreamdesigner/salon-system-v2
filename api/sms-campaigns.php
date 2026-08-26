<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require __DIR__ . '/sms-campaign-service.php';

verify_same_origin();
$user = require_admin();
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function sms_campaign_code_matches(PDO $pdo, string $submitted): bool
{
    $statement = $pdo->query("SELECT payload FROM app_sections WHERE section_key = 'generalSettings' LIMIT 1");
    $settings = json_decode((string)($statement->fetchColumn() ?: '{}'), true);
    $expected = (string)(is_array($settings) ? ($settings['deleteCode'] ?? '1989') : '1989');
    return preg_match('/^\d{4}$/', $submitted) === 1 && hash_equals($expected, $submitted);
}

function sms_campaign_summary_row(array $row): array
{
    foreach (['id', 'batch_size', 'total_count', 'pending_count', 'sent_count', 'failed_count', 'cancelled_count'] as $key) {
        $row[$key] = (int)($row[$key] ?? 0);
    }
    return $row;
}

function sms_campaign_summary(PDO $pdo, int $page = 1): array
{
    $pageSize = 20;
    $total = (int)$pdo->query('SELECT COUNT(*) FROM app_sms_campaigns')->fetchColumn();
    $pageCount = max(1, (int)ceil($total / $pageSize));
    $page = min(max(1, $page), $pageCount);
    $offset = ($page - 1) * $pageSize;
    $rows = $pdo->query("SELECT id, title, message, batch_size, status, total_count, pending_count, sent_count, failed_count, cancelled_count, created_by, last_error, started_at, completed_at, created_at FROM app_sms_campaigns ORDER BY id DESC LIMIT {$pageSize} OFFSET {$offset}")->fetchAll();
    return ['items' => array_map('sms_campaign_summary_row', $rows), 'pagination' => ['page' => $page, 'pageSize' => $pageSize, 'pageCount' => $pageCount, 'total' => $total]];
}

if ($method === 'GET') {
    $view = trim((string)($_GET['view'] ?? 'campaigns'));
    if ($view === 'audience') {
        json_response(['ok' => true, 'total' => count(sms_campaign_audience($pdo))]);
    }
    if ($view === 'recipients') {
        $campaignId = max(0, (int)($_GET['campaignId'] ?? 0));
        $campaignStatement = $pdo->prepare('SELECT id, title, total_count, pending_count, sent_count, failed_count, cancelled_count FROM app_sms_campaigns WHERE id = ? LIMIT 1');
        $campaignStatement->execute([$campaignId]);
        $campaign = $campaignStatement->fetch();
        if (!$campaign) json_response(['ok' => false, 'message' => 'SMS илгээлт олдсонгүй.'], 404);
        $pageSize = 100;
        $total = (int)$campaign['total_count'];
        $pageCount = max(1, (int)ceil($total / $pageSize));
        $page = min(max(1, (int)($_GET['page'] ?? 1)), $pageCount);
        $offset = ($page - 1) * $pageSize;
        $rows = $pdo->prepare("SELECT id, phone, status, attempts, max_attempts, last_error, sent_at, created_at FROM app_sms_campaign_recipients WHERE campaign_id = ? ORDER BY id ASC LIMIT {$pageSize} OFFSET {$offset}");
        $rows->execute([$campaignId]);
        json_response(['ok' => true, 'campaign' => sms_campaign_summary_row($campaign), 'recipients' => $rows->fetchAll(), 'pagination' => ['page' => $page, 'pageSize' => $pageSize, 'pageCount' => $pageCount, 'total' => $total]]);
    }
    if ($view !== 'campaigns') json_response(['ok' => false, 'message' => 'SMS хүсэлт буруу байна.'], 422);
    $summary = sms_campaign_summary($pdo, (int)($_GET['page'] ?? 1));
    $settings = sms_load_settings($pdo);
    json_response(['ok' => true, 'campaigns' => $summary['items'], 'pagination' => $summary['pagination'], 'defaultBatchSize' => SMS_CAMPAIGN_DEFAULT_BATCH, 'minBatchSize' => SMS_CAMPAIGN_MIN_BATCH, 'maxBatchSize' => SMS_CAMPAIGN_MAX_BATCH, 'characterLimit' => (int)($settings['characterLimit'] ?? SMS_ADMIN_LIMIT_MAX)]);
}

if ($method !== 'POST') json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
$payload = request_payload();
if (!sms_campaign_code_matches($pdo, trim((string)($payload['code'] ?? '')))) {
    json_response(['ok' => false, 'message' => 'Засах код буруу байна.'], 403);
}
$action = trim((string)($payload['action'] ?? ''));
$now = new DateTimeImmutable('now', new DateTimeZone(SMS_TIMEZONE));
$timestamp = $now->format('Y-m-d H:i:s');

if ($action === 'test') {
    $settings = sms_load_settings($pdo, true);
    if (($settings['enabled'] ?? false) !== true || trim((string)($settings['apiUrl'] ?? '')) === '' || trim((string)($settings['token'] ?? '')) === '') {
        json_response(['ok' => false, 'message' => 'Эхлээд SMS тохиргоогоо идэвхжүүлж хадгална уу.'], 409);
    }
    $phone = sms_normalize_phone((string)($payload['phone'] ?? ''));
    $message = sms_latinize(trim((string)($payload['message'] ?? '')));
    if ($phone === '') json_response(['ok' => false, 'message' => 'Туршилтын утас 8 оронтой байна.'], 422);
    if ($message === '') json_response(['ok' => false, 'message' => 'Эхлээд SMS агуулгаа бичнэ үү.'], 422);
    $lengthError = sms_message_length_error($message, (int)($settings['characterLimit'] ?? SMS_UNICODE_LIMIT));
    if ($lengthError !== '') json_response(['ok' => false, 'message' => $lengthError], 422);
    $booking = ['id' => 'campaign-test-' . bin2hex(random_bytes(6)), 'phone' => $phone, 'salon' => 'Сурталчилгаа', 'date' => $now->format('Y-m-d'), 'time' => $now->format('H:i')];
    $id = sms_enqueue_row($pdo, 'campaign:test:' . bin2hex(random_bytes(16)), 'test', $booking, $message, $now);
    $result = $id ? sms_dispatch_message($pdo, $id) : ['ok' => false, 'error' => 'Туршилтын SMS үүссэнгүй.'];
    if (($result['ok'] ?? false) !== true) {
        json_response(['ok' => false, 'message' => (string)($result['error'] ?? $result['message'] ?? 'SMS илгээгдсэнгүй.')], 502);
    }
    json_response(['ok' => true, 'message' => 'Сурталчилгааны туршилтын SMS амжилттай илгээгдлээ.']);
}

if ($action === 'create') {
    $settings = sms_load_settings($pdo, true);
    if (($settings['enabled'] ?? false) !== true || trim((string)($settings['apiUrl'] ?? '')) === '' || trim((string)($settings['token'] ?? '')) === '') {
        json_response(['ok' => false, 'message' => 'Эхлээд SMS тохиргоогоо идэвхжүүлж хадгална уу.'], 409);
    }
    $title = trim((string)($payload['title'] ?? ''));
    $message = sms_latinize(trim((string)($payload['message'] ?? '')));
    if ($title === '' || mb_strlen($title) > 120) json_response(['ok' => false, 'message' => 'Илгээлтийн нэрээ оруулна уу.'], 422);
    if ($message === '') json_response(['ok' => false, 'message' => 'SMS агуулгаа оруулна уу.'], 422);
    $lengthError = sms_message_length_error($message, (int)($settings['characterLimit'] ?? SMS_UNICODE_LIMIT));
    if ($lengthError !== '') json_response(['ok' => false, 'message' => $lengthError], 422);
    $batch = sms_campaign_normalize_batch($payload['batchSize'] ?? SMS_CAMPAIGN_DEFAULT_BATCH);
    $statement = $pdo->prepare("INSERT INTO app_sms_campaigns (title, message, batch_size, status, created_by) VALUES (?, ?, ?, 'draft', ?)");
    $statement->execute([$title, $message, $batch, (string)($user['username'] ?? '')]);
    json_response(['ok' => true, 'campaignId' => (int)$pdo->lastInsertId(), 'message' => 'SMS илгээлт бэлтгэгдлээ. Эхлүүлэх товч дарсны дараа л илгээгдэнэ.']);
}

$campaignId = max(0, (int)($payload['id'] ?? 0));
if ($campaignId < 1) json_response(['ok' => false, 'message' => 'SMS илгээлт олдсонгүй.'], 404);

if ($action === 'start') {
    $settings = sms_load_settings($pdo, true);
    if (($settings['enabled'] ?? false) !== true || trim((string)($settings['apiUrl'] ?? '')) === '' || trim((string)($settings['token'] ?? '')) === '') {
        json_response(['ok' => false, 'message' => 'SMS тохиргоо идэвхгүй эсвэл дутуу байна.'], 409);
    }
    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare('SELECT id, status FROM app_sms_campaigns WHERE id = ? LIMIT 1 FOR UPDATE');
        $statement->execute([$campaignId]);
        $campaign = $statement->fetch();
        if (!$campaign || !in_array((string)$campaign['status'], ['draft', 'paused'], true)) {
            $pdo->rollBack();
            json_response(['ok' => false, 'message' => 'Энэ SMS илгээлтийг эхлүүлэх боломжгүй байна.'], 409);
        }
        if ((string)$campaign['status'] === 'draft') {
            $phones = sms_campaign_audience($pdo);
            if (!$phones) {
                $pdo->rollBack();
                json_response(['ok' => false, 'message' => 'Хүчинтэй утасны дугаартай хэрэглэгч олдсонгүй.'], 422);
            }
            foreach (array_chunk($phones, 200) as $phoneBatch) {
                $values = implode(',', array_fill(0, count($phoneBatch), "(?, ?, 'pending', ?)"));
                $bindings = [];
                foreach ($phoneBatch as $phone) {
                    array_push($bindings, $campaignId, $phone, $timestamp);
                }
                $pdo->prepare("INSERT IGNORE INTO app_sms_campaign_recipients (campaign_id, phone, status, next_attempt_at) VALUES {$values}")->execute($bindings);
            }
            $total = count($phones);
            $pdo->prepare("UPDATE app_sms_campaigns SET status = 'running', total_count = ?, pending_count = ?, started_at = ?, next_run_at = ?, lease_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                ->execute([$total, $total, $timestamp, $timestamp, $campaignId]);
        } else {
            $pdo->prepare("UPDATE app_sms_campaigns SET status = 'running', next_run_at = ?, lease_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                ->execute([$timestamp, $campaignId]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        json_response(['ok' => false, 'message' => 'SMS илгээлт эхлүүлсэнгүй: ' . $error->getMessage()], 500);
    }
    json_response(['ok' => true, 'message' => 'SMS илгээлт серверийн дараалалд бүртгэгдлээ.']);
}

if ($action === 'pause') {
    $statement = $pdo->prepare("UPDATE app_sms_campaigns SET status = 'paused', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'running'");
    $statement->execute([$campaignId]);
    if ($statement->rowCount() < 1) json_response(['ok' => false, 'message' => 'Илгээлтийг түр зогсоох боломжгүй байна.'], 409);
    json_response(['ok' => true, 'message' => 'SMS илгээлтийг түр зогсоолоо.']);
}

if ($action === 'cancel') {
    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare("SELECT id, status FROM app_sms_campaigns WHERE id = ? AND status IN ('draft', 'running', 'paused') LIMIT 1 FOR UPDATE");
        $statement->execute([$campaignId]);
        if (!$statement->fetch()) {
            $pdo->rollBack();
            json_response(['ok' => false, 'message' => 'Илгээлтийг цуцлах боломжгүй байна.'], 409);
        }
        $cancelRecipients = $pdo->prepare("UPDATE app_sms_campaign_recipients SET status = 'cancelled', last_error = 'Админ цуцалсан', updated_at = CURRENT_TIMESTAMP WHERE campaign_id = ? AND status IN ('pending', 'failed')");
        $cancelRecipients->execute([$campaignId]);
        $cancelled = $cancelRecipients->rowCount();
        $pdo->prepare("UPDATE app_sms_campaigns SET status = 'cancelled', cancelled_count = cancelled_count + ?, pending_count = GREATEST(0, pending_count - ?), completed_at = ?, lease_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            ->execute([$cancelled, $cancelled, $timestamp, $campaignId]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        json_response(['ok' => false, 'message' => 'SMS илгээлт цуцалсангүй: ' . $error->getMessage()], 500);
    }
    json_response(['ok' => true, 'message' => 'SMS илгээлт цуцлагдлаа.']);
}

json_response(['ok' => false, 'message' => 'SMS үйлдэл буруу байна.'], 422);
