<?php
declare(strict_types=1);

require_once __DIR__ . '/sms-service.php';

const SMS_CAMPAIGN_MIN_BATCH = 10;
const SMS_CAMPAIGN_MAX_BATCH = 100;
const SMS_CAMPAIGN_DEFAULT_BATCH = 50;
const SMS_CAMPAIGN_FIRST_HOUR = 9;
const SMS_CAMPAIGN_LAST_HOUR = 18;

function sms_campaign_normalize_batch(mixed $value): int
{
    return max(SMS_CAMPAIGN_MIN_BATCH, min(SMS_CAMPAIGN_MAX_BATCH, (int)$value));
}

function sms_campaign_audience(PDO $pdo): array
{
    $phones = [];
    foreach (sms_section_rows($pdo, 'customers') as $customer) {
        if (!is_array($customer) || ($customer['deleted'] ?? false) === true) continue;
        $phone = sms_normalize_phone((string)($customer['phone'] ?? ''));
        if ($phone !== '') $phones[$phone] = true;
    }
    return array_keys($phones);
}

function sms_campaign_in_send_window(DateTimeImmutable $now): bool
{
    $hour = (int)$now->format('G');
    return $hour >= SMS_CAMPAIGN_FIRST_HOUR && $hour <= SMS_CAMPAIGN_LAST_HOUR;
}

function sms_campaign_process_due(PDO $pdo): array
{
    $settings = sms_load_settings($pdo, true);
    $now = new DateTimeImmutable('now', new DateTimeZone(SMS_TIMEZONE));
    if (($settings['enabled'] ?? false) !== true || !sms_campaign_in_send_window($now)) {
        return ['checked' => 0, 'sent' => 0, 'failed' => 0, 'skipped' => true];
    }

    $timestamp = $now->format('Y-m-d H:i:s');
    $pdo->beginTransaction();
    try {
        $pdo->prepare("UPDATE app_sms_campaign_recipients SET status = 'failed', next_attempt_at = ?, last_error = 'Илгээлт тасарсан тул дахин оролдоно', updated_at = CURRENT_TIMESTAMP WHERE status = 'sending' AND updated_at < DATE_SUB(?, INTERVAL 15 MINUTE)")
            ->execute([$timestamp, $timestamp]);
        $campaignQuery = $pdo->prepare("SELECT * FROM app_sms_campaigns WHERE status = 'running' AND next_run_at <= ? AND (lease_until IS NULL OR lease_until < ?) ORDER BY id ASC LIMIT 1 FOR UPDATE");
        $campaignQuery->execute([$timestamp, $timestamp]);
        $campaign = $campaignQuery->fetch();
        if (!$campaign) {
            $pdo->commit();
            return ['checked' => 0, 'sent' => 0, 'failed' => 0];
        }
        $leaseUntil = $now->modify('+15 minutes')->format('Y-m-d H:i:s');
        $nextRun = $now->modify('+1 minute')->format('Y-m-d H:i:s');
        $pdo->prepare('UPDATE app_sms_campaigns SET lease_until = ?, next_run_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            ->execute([$leaseUntil, $nextRun, (int)$campaign['id']]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }

    $limit = sms_campaign_normalize_batch($campaign['batch_size'] ?? SMS_CAMPAIGN_DEFAULT_BATCH);
    $pdo->beginTransaction();
    try {
        $recipientQuery = $pdo->prepare("SELECT id, phone, attempts, max_attempts FROM app_sms_campaign_recipients WHERE campaign_id = ? AND ((status = 'pending') OR (status = 'failed' AND next_attempt_at IS NOT NULL AND next_attempt_at <= ?)) AND attempts < max_attempts ORDER BY id ASC LIMIT {$limit} FOR UPDATE");
        $recipientQuery->execute([(int)$campaign['id'], $timestamp]);
        $recipients = $recipientQuery->fetchAll();
        if ($recipients) {
            $ids = array_map(static fn(array $row): int => (int)$row['id'], $recipients);
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $pdo->prepare("UPDATE app_sms_campaign_recipients SET status = 'sending', attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP WHERE id IN ({$placeholders})")->execute($ids);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }

    $sent = 0;
    $failed = 0;
    foreach ($recipients as $recipient) {
        $result = sms_http_send($settings, (string)$recipient['phone'], (string)$campaign['message']);
        $attempts = (int)$recipient['attempts'] + 1;
        $final = ($result['ok'] ?? false) !== true && (($result['retryable'] ?? true) !== true || $attempts >= (int)$recipient['max_attempts']);
        $pdo->beginTransaction();
        try {
            if (($result['ok'] ?? false) === true) {
                $pdo->prepare("UPDATE app_sms_campaign_recipients SET status = 'sent', next_attempt_at = NULL, last_error = '', provider_response = ?, sent_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'sending'")
                    ->execute([(string)($result['response'] ?? ''), $timestamp, (int)$recipient['id']]);
                $pdo->prepare('UPDATE app_sms_campaigns SET sent_count = sent_count + 1, pending_count = GREATEST(0, pending_count - 1), last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                    ->execute(['', (int)$campaign['id']]);
                $sent++;
            } elseif ($final) {
                $errorText = mb_substr((string)($result['error'] ?? 'SMS илгээгдсэнгүй.'), 0, 500);
                $pdo->prepare("UPDATE app_sms_campaign_recipients SET status = 'permanent_failed', next_attempt_at = NULL, last_error = ?, provider_response = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'sending'")
                    ->execute([$errorText, (string)($result['response'] ?? ''), (int)$recipient['id']]);
                $pdo->prepare('UPDATE app_sms_campaigns SET failed_count = failed_count + 1, pending_count = GREATEST(0, pending_count - 1), last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                    ->execute([$errorText, (int)$campaign['id']]);
                $failed++;
            } else {
                $errorText = mb_substr((string)($result['error'] ?? 'SMS илгээгдсэнгүй.'), 0, 500);
                $retryAt = $now->modify('+5 minutes')->format('Y-m-d H:i:s');
                $pdo->prepare("UPDATE app_sms_campaign_recipients SET status = 'failed', next_attempt_at = ?, last_error = ?, provider_response = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'sending'")
                    ->execute([$retryAt, $errorText, (string)($result['response'] ?? ''), (int)$recipient['id']]);
                $pdo->prepare('UPDATE app_sms_campaigns SET last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$errorText, (int)$campaign['id']]);
            }
            $pdo->prepare("UPDATE app_sms_campaigns SET status = CASE WHEN pending_count <= 0 THEN 'completed' ELSE status END, completed_at = CASE WHEN pending_count <= 0 THEN COALESCE(completed_at, ?) ELSE completed_at END, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
                ->execute([$timestamp, (int)$campaign['id']]);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
    }

    $pdo->prepare("UPDATE app_sms_campaigns SET status = CASE WHEN pending_count <= 0 THEN 'completed' ELSE status END, completed_at = CASE WHEN pending_count <= 0 THEN COALESCE(completed_at, ?) ELSE completed_at END, lease_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        ->execute([$timestamp, (int)$campaign['id']]);
    return ['campaignId' => (int)$campaign['id'], 'checked' => count($recipients), 'sent' => $sent, 'failed' => $failed];
}
