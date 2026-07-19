<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    exit;
}

$scope = (string)($_GET['scope'] ?? 'public');
if (!in_array($scope, ['public', 'private'], true)) {
    http_response_code(404);
    exit;
}
if ($scope === 'private') require_auth();

$filename = (string)($_GET['file'] ?? '');
if (!preg_match('/^\d{8}_\d{6}_[a-f0-9]{12}\.(?:jpg|png|webp)$/', $filename)) {
    http_response_code(404);
    exit;
}

$publicRoot = realpath(__DIR__ . '/..');
if ($publicRoot === false) {
    http_response_code(500);
    exit;
}
$configuredStorage = trim((string)getenv('KHALGAI_MEDIA_STORAGE_DIR'));
$storageRoot = $configuredStorage !== ''
    ? rtrim($configuredStorage, DIRECTORY_SEPARATOR)
    : dirname($publicRoot) . DIRECTORY_SEPARATOR . 'khalgai-media-storage';
$scopeRoot = realpath($storageRoot . DIRECTORY_SEPARATOR . $scope);
if ($scopeRoot === false) {
    http_response_code(404);
    exit;
}
$path = realpath($scopeRoot . DIRECTORY_SEPARATOR . $filename);
if ($path === false || !is_file($path) || !str_starts_with($path, $scopeRoot . DIRECTORY_SEPARATOR)) {
    http_response_code(404);
    exit;
}

$mime = (string)(new finfo(FILEINFO_MIME_TYPE))->file($path);
if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
    http_response_code(415);
    exit;
}

header('Content-Type: ' . $mime);
header('Content-Length: ' . (string)filesize($path));
header('Content-Disposition: inline; filename="' . $filename . '"');
header('X-Content-Type-Options: nosniff');
header($scope === 'public'
    ? 'Cache-Control: public, max-age=31536000, immutable'
    : 'Cache-Control: private, no-store');
readfile($path);
