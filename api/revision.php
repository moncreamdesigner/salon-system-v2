<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
$user = require_auth();
$pdo = db();

$revision = (int)$pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'revision'")->fetchColumn();
$requestedSections = [];
if (isset($_GET['sections']) && trim((string)$_GET['sections']) !== '') {
    $requestedSections = array_values(array_unique(array_filter(array_map(
        static fn(string $value): string => trim($value),
        explode(',', (string)$_GET['sections'])
    ))));
}

$sectionRevisions = [];
if ($requestedSections) {
    $placeholders = implode(',', array_fill(0, count($requestedSections), '?'));
    $statement = $pdo->prepare("SELECT section_key, revision FROM app_sections WHERE section_key IN ($placeholders)");
    $statement->execute($requestedSections);
    foreach ($statement->fetchAll() as $row) {
        $sectionRevisions[(string)$row['section_key']] = (int)$row['revision'];
    }
    foreach ($requestedSections as $key) {
        if (!array_key_exists($key, $sectionRevisions)) $sectionRevisions[$key] = 0;
    }
}

json_response([
    'ok' => true,
    'revision' => $revision,
    'scopeRevision' => scope_revision($pdo, $user),
    'sectionRevisions' => $sectionRevisions,
]);
