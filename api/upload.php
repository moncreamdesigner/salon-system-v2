<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
require_auth();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
}

if (empty($_FILES['image']) || !is_array($_FILES['image'])) {
    json_response(['ok' => false, 'message' => 'Зураг илгээгдээгүй байна.'], 422);
}

$file = $_FILES['image'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    json_response(['ok' => false, 'message' => 'Зураг илгээгдэхэд алдаа гарлаа.'], 422);
}

$maxBytes = 12 * 1024 * 1024;
if (($file['size'] ?? 0) > $maxBytes) {
    json_response(['ok' => false, 'message' => 'Нэг зураг 12 MB-аас ихгүй байна.'], 413);
}

$tmpPath = (string)($file['tmp_name'] ?? '');
if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
    json_response(['ok' => false, 'message' => 'Зургийн түр файл олдсонгүй.'], 422);
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = (string)$finfo->file($tmpPath);
$allowed = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp',
];
if (!isset($allowed[$mime])) {
    json_response(['ok' => false, 'message' => 'JPEG, PNG эсвэл WebP зураг сонгоно уу.'], 415);
}

$scope = (string)($_POST['scope'] ?? 'public');
if (!in_array($scope, ['public', 'private'], true)) {
    json_response(['ok' => false, 'message' => 'Зургийн хадгалалтын төрөл буруу байна.'], 422);
}

$publicRoot = realpath(__DIR__ . '/..');
if ($publicRoot === false) {
    json_response(['ok' => false, 'message' => 'Системийн үндсэн фолдер олдсонгүй.'], 500);
}
$configuredStorage = trim((string)getenv('KHALGAI_MEDIA_STORAGE_DIR'));
$storageRoot = $configuredStorage !== ''
    ? rtrim($configuredStorage, DIRECTORY_SEPARATOR)
    : dirname($publicRoot) . DIRECTORY_SEPARATOR . 'khalgai-media-storage';
$uploadsDir = $storageRoot . DIRECTORY_SEPARATOR . $scope;
if (!is_dir($uploadsDir) && !@mkdir($uploadsDir, 0750, true) && !is_dir($uploadsDir)) {
    json_response(['ok' => false, 'message' => 'Deploy-оос тусдаа зургийн хадгалалт үүсгэж чадсангүй.'], 500);
}
if (!is_file($storageRoot . DIRECTORY_SEPARATOR . '.htaccess')) {
    @file_put_contents($storageRoot . DIRECTORY_SEPARATOR . '.htaccess', "Require all denied\nDeny from all\n");
}

$extension = $allowed[$mime];
$basename = date('Ymd_His') . '_' . bin2hex(random_bytes(6)) . '.' . $extension;
$destination = $uploadsDir . DIRECTORY_SEPARATOR . $basename;
if (!@move_uploaded_file($tmpPath, $destination)) {
    json_response(['ok' => false, 'message' => 'Зураг хадгалахад алдаа гарлаа.'], 500);
}
@chmod($destination, 0644);

$mediaUrl = 'api/media.php?scope=' . rawurlencode($scope) . '&file=' . rawurlencode($basename);
json_response(['ok' => true, 'url' => $mediaUrl, 'filename' => $basename, 'scope' => $scope, 'mime' => $mime, 'size' => filesize($destination) ?: 0]);
