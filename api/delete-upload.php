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
$trashRoot = $storageRoot . DIRECTORY_SEPARATOR . 'trash';
if (!is_dir($trashRoot) && !@mkdir($trashRoot, 0750, true) && !is_dir($trashRoot)) {
    json_response(['ok' => false, 'message' => 'Зургийн түр хадгалалтын хавтас үүсгэж чадсангүй.'], 500);
}
$trashed = 0;

foreach (array_values(array_unique($urls)) as $url) {
    if (!is_string($url)) continue;
    $query = [];
    parse_str((string)(parse_url($url, PHP_URL_QUERY) ?? ''), $query);
    if (($query['scope'] ?? '') !== 'private') continue;
    $filename = basename((string)($query['file'] ?? ''));
    if ($filename === '' || !preg_match('/^[A-Za-z0-9._-]+$/', $filename)) continue;
    $path = $privateRoot . DIRECTORY_SEPARATOR . $filename;
    if (!is_file($path)) continue;
    $trashName = gmdate('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '_' . $filename;
    $trashPath = $trashRoot . DIRECTORY_SEPARATOR . $trashName;
    if (!@rename($path, $trashPath)) {
        json_response(['ok' => false, 'message' => 'Оношилгооны зургийг түр хадгалалт руу шилжүүлж чадсангүй.'], 500);
    }
    $trashed++;
}

json_response(['ok' => true, 'trashed' => $trashed, 'retentionDays' => 30]);
