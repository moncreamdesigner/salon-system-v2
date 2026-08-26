<?php
declare(strict_types=1);

require __DIR__ . '/../api/sms-campaign-service.php';

function expect_campaign(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, $message . PHP_EOL);
        exit(1);
    }
}

expect_campaign(sms_campaign_normalize_batch(0) === 10, 'Batch minimum must remain bounded.');
expect_campaign(sms_campaign_normalize_batch(50) === 50, 'Configured batch size must remain unchanged.');
expect_campaign(sms_campaign_normalize_batch(5000) === 100, 'Batch maximum must remain bounded.');
expect_campaign(sms_normalize_phone('+976 9911-2233') === '99112233', 'Mongolian customer phones must normalize.');
expect_campaign(sms_normalize_phone('9911223') === '', 'Invalid phone numbers must never enter the queue.');
expect_campaign(preg_match('/[^\x00-\x7F]/', sms_latinize('Халгай салон')) !== 1, 'Provider messages must be latinized.');

$timezone = new DateTimeZone(SMS_TIMEZONE);
expect_campaign(!sms_campaign_in_send_window(new DateTimeImmutable('2026-08-25 08:59:59', $timezone)), 'Marketing SMS must not start before business hours.');
expect_campaign(sms_campaign_in_send_window(new DateTimeImmutable('2026-08-25 09:00:00', $timezone)), 'Marketing SMS must start during business hours.');
expect_campaign(sms_campaign_in_send_window(new DateTimeImmutable('2026-08-25 18:59:59', $timezone)), 'Marketing SMS must continue through the configured final hour.');
expect_campaign(!sms_campaign_in_send_window(new DateTimeImmutable('2026-08-25 19:00:00', $timezone)), 'Marketing SMS must not continue overnight.');

echo "sms-campaign-worker-test: OK" . PHP_EOL;
