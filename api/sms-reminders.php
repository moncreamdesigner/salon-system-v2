<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require __DIR__ . '/sms-service.php';

if (PHP_SAPI !== 'cli') {
    json_response(['ok' => false, 'message' => 'Энэ endpoint зөвхөн server cron-д зориулагдсан.'], 403);
}

$timezone = new DateTimeZone(SMS_TIMEZONE);
$now = new DateTimeImmutable('now', $timezone);
if ((int)$now->format('G') < SMS_FIRST_CHECK_HOUR) {
    echo json_encode(['ok' => true, 'skipped' => true, 'timezone' => SMS_TIMEZONE, 'time' => $now->format('Y-m-d H:i:s')], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    exit(0);
}

try {
    $result = sms_dispatch_due(db());
    echo json_encode(['ok' => true, 'timezone' => SMS_TIMEZONE, 'time' => $now->format('Y-m-d H:i:s')] + $result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, json_encode(['ok' => false, 'message' => $error->getMessage()], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(1);
}
