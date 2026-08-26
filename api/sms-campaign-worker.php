<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
require __DIR__ . '/sms-campaign-service.php';

if (PHP_SAPI !== 'cli') {
    json_response(['ok' => false, 'message' => 'Энэ endpoint зөвхөн server cron-д зориулагдсан.'], 403);
}

try {
    $result = sms_campaign_process_due(db());
    echo json_encode(['ok' => true, 'timezone' => SMS_TIMEZONE] + $result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, json_encode(['ok' => false, 'message' => $error->getMessage()], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(1);
}
