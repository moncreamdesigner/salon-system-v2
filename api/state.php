<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
$user = require_auth();
$pdo = db();

function load_all_sections(PDO $pdo, array $keys = []): array
{
    if ($keys) {
        $placeholders = implode(',', array_fill(0, count($keys), '?'));
        $statement = $pdo->prepare("SELECT section_key, payload FROM app_sections WHERE section_key IN ($placeholders) ORDER BY section_key");
        $statement->execute($keys);
        $rows = $statement->fetchAll();
    } else {
        $rows = $pdo->query('SELECT section_key, payload FROM app_sections ORDER BY section_key')->fetchAll();
    }
    $data = [];
    foreach ($rows as $row) $data[$row['section_key']] = json_decode((string)$row['payload'], true);
    return $data;
}

function item_belongs_to_salon(array $item, string $salon, string $section): bool
{
    if ($section === 'assignments') return ($item['from'] ?? '') === $salon || ($item['to'] ?? '') === $salon;
    if ($section === 'holidays') {
        $scopes = is_array($item['salons'] ?? null) ? $item['salons'] : [];
        return ($item['salon'] ?? '') === $salon || in_array($salon, $scopes, true);
    }
    return ($item['salon'] ?? '') === $salon;
}

function scope_sections_for_user(array $data, array $user): array
{
    if (($user['role'] ?? '') !== 'salon') return $data;
    $salon = (string)($user['salon'] ?? '');
    foreach (['bookings', 'kassSchedules', 'services', 'holidays', 'assignments', 'staff'] as $section) {
        if (!is_array($data[$section] ?? null)) continue;
        $data[$section] = array_values(array_filter($data[$section], static fn($item): bool =>
            is_array($item) && item_belongs_to_salon($item, $salon, $section)
        ));
    }
    return $data;
}

function merge_salon_sections(array $current, array $incoming, array $user, bool $partial = false): array
{
    if (($user['role'] ?? '') !== 'salon') return $incoming;
    $salon = (string)($user['salon'] ?? '');
    $restricted = ['salons', 'staff', 'assignments', 'generalSettings', 'homepageSettings', 'pricePolicy', 'discounts', 'voucherRoles', 'catalog', '_serviceSettings', 'diagnosisTypes', 'customerTypes', 'customerTypeRules'];
    foreach ($restricted as $section) {
        if ($partial) unset($incoming[$section]);
        elseif (array_key_exists($section, $current)) $incoming[$section] = $current[$section];
        else unset($incoming[$section]);
    }
    foreach (['bookings', 'kassSchedules', 'services', 'holidays'] as $section) {
        if ($partial && !array_key_exists($section, $incoming)) continue;
        $oldRows = is_array($current[$section] ?? null) ? $current[$section] : [];
        $newRows = is_array($incoming[$section] ?? null) ? $incoming[$section] : [];
        $preserved = array_filter($oldRows, static fn($item): bool => !is_array($item) || !item_belongs_to_salon($item, $salon, $section));
        $owned = array_filter($newRows, static fn($item): bool => is_array($item) && item_belongs_to_salon($item, $salon, $section));
        $incoming[$section] = array_values(array_merge($owned, $preserved));
    }
    if (array_key_exists('audit', $incoming) && is_array($incoming['audit'])) {
        $mergedAudit = [];
        $seenAudit = [];
        foreach (array_merge($incoming['audit'], is_array($current['audit'] ?? null) ? $current['audit'] : []) as $entry) {
            if (!is_array($entry)) continue;
            $key = (string)($entry['id'] ?? $entry['paymentId'] ?? '') . '|' . (string)($entry['createdAt'] ?? '') . '|' . (string)($entry['title'] ?? '') . '|' . (string)($entry['meta'] ?? '');
            if (isset($seenAudit[$key])) continue;
            $seenAudit[$key] = true;
            $mergedAudit[] = $entry;
        }
        $incoming['audit'] = $mergedAudit;
    }
    return $incoming;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    $revision = (int)$pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'revision'")->fetchColumn();
    $requestedSections = array_values(array_filter(array_map('trim', explode(',', (string)($_GET['sections'] ?? ''))), static fn(string $key): bool => preg_match('/^[A-Za-z0-9_:-]{1,80}$/', $key) === 1));
    $data = scope_sections_for_user(load_all_sections($pdo, $requestedSections), $user);
    json_response(['ok' => true, 'revision' => $revision, 'scopeRevision' => scope_revision($pdo, $user), 'empty' => count($data) === 0, 'partial' => count($requestedSections) > 0, 'data' => $data]);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'PUT') {
    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
}

$payload = request_payload();
$sections = $payload['data'] ?? null;
$clientRevision = filter_var($payload['revision'] ?? null, FILTER_VALIDATE_INT);
$partial = ($payload['partial'] ?? false) === true;
$clientScopeRevision = filter_var($payload['scopeRevision'] ?? null, FILTER_VALIDATE_INT);
if (!is_array($sections) || array_is_list($sections)) {
    json_response(['ok' => false, 'message' => 'Өгөгдлийн бүтэц буруу байна.'], 422);
}
$encoded = json_encode($sections, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($encoded === false || strlen($encoded) > 50 * 1024 * 1024) {
    json_response(['ok' => false, 'message' => 'Өгөгдлийн хэмжээ хэтэрсэн байна.'], 413);
}

try {
    $pdo->beginTransaction();
    $revisionStmt = $pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'revision' FOR UPDATE");
    $currentRevision = (int)$revisionStmt->fetchColumn();
    $currentScopeRevision = scope_revision($pdo, $user, true);
    $conflict = $partial
        ? ($clientScopeRevision === false || $clientScopeRevision === null || (int)$clientScopeRevision !== $currentScopeRevision)
        : ($clientRevision === false || $clientRevision === null || (int)$clientRevision !== $currentRevision);
    if ($conflict) {
        $pdo->rollBack();
        json_response([
            'ok' => false,
            'conflict' => true,
            'currentRevision' => $currentRevision,
            'currentScopeRevision' => $currentScopeRevision,
            'message' => 'Мэдээлэл өөр хэрэглэгчийн үйлдлээр шинэчлэгдсэн байна. Хуудсыг шинэчлээд дахин оролдоно уу.'
        ], 409);
    }
    $currentSections = load_all_sections($pdo, $partial ? array_keys($sections) : []);
    $sections = merge_salon_sections($currentSections, $sections, $user, $partial);
    $nextRevision = $currentRevision + 1;

    $backupIntervalDays = (int)$pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'backup_interval_days'")->fetchColumn();
    $allowedBackupIntervals = [0, 1, 7, 14, 30, 90];
    if (!in_array($backupIntervalDays, $allowedBackupIntervals, true)) $backupIntervalDays = 7;
    $lastBackupStatement = $pdo->prepare('SELECT created_at FROM app_backups WHERE reason = ? ORDER BY id DESC LIMIT 1');
    $lastBackupStatement->execute(['Автомат backup']);
    $lastBackup = $lastBackupStatement->fetchColumn();
    $backupDue = $backupIntervalDays > 0 && (!$lastBackup || strtotime((string)$lastBackup) <= time() - ($backupIntervalDays * 86400));
    if ($currentRevision > 0 && $backupDue) {
        $oldRows = $pdo->query('SELECT section_key, payload FROM app_sections')->fetchAll();
        $oldData = [];
        foreach ($oldRows as $row) $oldData[$row['section_key']] = json_decode($row['payload'], true);
        $backup = $pdo->prepare('INSERT INTO app_backups (revision, reason, payload) VALUES (?, ?, ?)');
        $backup->execute([$currentRevision, 'Автомат backup', json_encode($oldData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);
    }

    $upsert = $pdo->prepare('INSERT INTO app_sections (section_key, payload, revision) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload), revision = VALUES(revision), updated_at = CURRENT_TIMESTAMP');
    foreach ($sections as $key => $value) {
        if (!preg_match('/^[A-Za-z0-9_:-]{1,80}$/', (string)$key)) throw new RuntimeException('Section key буруу.');
        $sectionJson = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($sectionJson === false) throw new RuntimeException('JSON хөрвүүлэлт амжилтгүй.');
        $upsert->execute([(string)$key, $sectionJson, $nextRevision]);
    }
    $meta = $pdo->prepare("UPDATE app_meta SET meta_value = ? WHERE meta_key = 'revision'");
    $meta->execute([(string)$nextRevision]);
    $nextScopeRevision = bump_scope_revisions($pdo, $user, array_keys($sections));
    $pdo->exec('DELETE FROM app_backups WHERE id NOT IN (SELECT id FROM (SELECT id FROM app_backups ORDER BY id DESC LIMIT 3) AS keep_rows)');
    $pdo->commit();
    json_response(['ok' => true, 'revision' => $nextRevision, 'scopeRevision' => $nextScopeRevision, 'savedSections' => array_keys($sections), 'savedBy' => $user['username'] ?? 'admin']);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    json_response(['ok' => false, 'message' => 'Server хадгалалт амжилтгүй.'], 500);
}
