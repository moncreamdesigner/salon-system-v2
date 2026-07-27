<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
require_auth();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
}

$payload = request_payload();
$urls = $payload['urls'] ?? [];
if (!is_array($urls) || count($urls) > 30) {
    json_response(['ok' => false, 'message' => 'Устгах зургийн жагсаалт буруу байна.'], 422);
}

$publicRoot = realpath(__DIR__ . '/..');
if ($publicRoot === false) {
    json_response(['ok' => false, 'message' => 'Системийн үндсэн зам олдсонгүй.'], 500);
}

$configuredStorage = trim((string)getenv('KHALGAI_MEDIA_STORAGE_DIR'));
$storageRoot = $configuredStorage !== ''
    ? rtrim($configuredStorage, DIRECTORY_SEPARATOR)
    : dirname($publicRoot) . DIRECTORY_SEPARATOR . 'khalgai-media-storage';
$privateRoot = $storageRoot . DIRECTORY_SEPARATOR . 'private';
$deleted = 0;

foreach (array_values(array_unique($urls)) as $url) {
    if (!is_string($url)) continue;
    $query = [];
    parse_str((string)(parse_url($url, PHP_URL_QUERY) ?? ''), $query);
    if (($query['scope'] ?? '') !== 'private') continue;
    $filename = basename((string)($query['file'] ?? ''));
    if ($filename === '' || !preg_match('/^[A-Za-z0-9._-]+$/', $filename)) continue;
    $path = $privateRoot . DIRECTORY_SEPARATOR . $filename;
    if (!is_file($path)) continue;
    if (!@unlink($path)) {
        json_response(['ok' => false, 'message' => 'Оношилгооны зураг устгаж чадсангүй.'], 500);
    }
    $deleted++;
}

json_response(['ok' => true, 'deleted' => $deleted]);
