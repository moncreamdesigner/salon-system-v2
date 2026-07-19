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

$uploadRoot = realpath(__DIR__ . '/..');
if ($uploadRoot === false) {
    json_response(['ok' => false, 'message' => 'Хадгалах фолдер олдсонгүй.'], 500);
}
$uploadsDir = $uploadRoot . DIRECTORY_SEPARATOR . 'uploads';
if (!is_dir($uploadsDir) && !@mkdir($uploadsDir, 0775, true) && !is_dir($uploadsDir)) {
    json_response(['ok' => false, 'message' => 'Uploads фолдер үүсгэж чадсангүй.'], 500);
}

$extension = $allowed[$mime];
$basename = date('Ymd_His') . '_' . bin2hex(random_bytes(6)) . '.' . $extension;
$destination = $uploadsDir . DIRECTORY_SEPARATOR . $basename;
if (!@move_uploaded_file($tmpPath, $destination)) {
    json_response(['ok' => false, 'message' => 'Зураг хадгалахад алдаа гарлаа.'], 500);
}
@chmod($destination, 0644);

json_response(['ok' => true, 'url' => 'uploads/' . $basename, 'filename' => $basename, 'mime' => $mime, 'size' => filesize($destination) ?: 0]);
