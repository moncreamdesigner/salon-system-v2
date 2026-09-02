<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
$user = require_auth();
$pdo = db();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_response(['ok' => false, 'message' => 'Method зөвшөөрөгдөөгүй.'], 405);
}

function voucher_role_rows(PDO $pdo, string $section, bool $lock = false): array
{
    $sql = 'SELECT payload FROM app_sections WHERE section_key = ? LIMIT 1' . ($lock ? ' FOR UPDATE' : '');
    $statement = $pdo->prepare($sql);
    $statement->execute([$section]);
    $decoded = json_decode((string)($statement->fetchColumn() ?: ($section === 'pricePolicy' ? '{}' : '[]')), true);
    return is_array($decoded) ? $decoded : [];
}

function voucher_role_index(array $roles, string $id): ?int
{
    foreach ($roles as $index => $role) {
        if (is_array($role) && (string)($role['id'] ?? '') === $id) return (int)$index;
    }
    return null;
}

function voucher_role_next_id(array $roles): string
{
    $max = 0;
    foreach ($roles as $role) {
        if (is_array($role)) $max = max($max, (int)($role['id'] ?? 0));
    }
    return (string)($max + 1);
}

function voucher_role_validate(array $role): array
{
    $name = trim((string)($role['name'] ?? ''));
    $position = trim((string)($role['position'] ?? ''));
    if ($name === '' || mb_strlen($name, 'UTF-8') > 100) {
        throw new InvalidArgumentException('Ваучерийн эрхийн нэр 1-100 тэмдэгт байна.');
    }
    if (mb_strlen($position, 'UTF-8') > 100) {
        throw new InvalidArgumentException('Албан тушаал 100 тэмдэгтээс урт байж болохгүй.');
    }
    return [
        'id' => trim((string)($role['id'] ?? '')),
        'name' => $name,
        'position' => $position,
        'cashierCommissionEligible' => ($role['cashierCommissionEligible'] ?? false) === true,
    ];
}

function voucher_role_assert_unique(array $roles, array $candidate, string $ignoreId = ''): void
{
    $candidateName = mb_strtolower((string)$candidate['name'], 'UTF-8');
    $candidatePosition = mb_strtolower((string)$candidate['position'], 'UTF-8');
    foreach ($roles as $role) {
        if (!is_array($role) || (string)($role['id'] ?? '') === $ignoreId) continue;
        if (
            mb_strtolower(trim((string)($role['name'] ?? '')), 'UTF-8') === $candidateName
            && mb_strtolower(trim((string)($role['position'] ?? '')), 'UTF-8') === $candidatePosition
        ) {
            throw new DomainException('Ижил нэр, албан тушаалтай ваучерийн эрх бүртгэлтэй байна.');
        }
    }
}

function voucher_role_update_policy(array $pricePolicy, string $roleId, bool $eligible, array $user): array
{
    $current = is_array($pricePolicy['performance'] ?? null) ? $pricePolicy['performance'] : [];
    $cashier = is_array($current['cashier'] ?? null) ? $current['cashier'] : [];
    $ids = array_values(array_unique(array_map('strval', is_array($cashier['voucherRoleIds'] ?? null) ? $cashier['voucherRoleIds'] : [])));
    $hadRole = in_array($roleId, $ids, true);
    if ($hadRole === $eligible) return [$pricePolicy, false];

    $ids = array_values(array_filter($ids, static fn(string $id): bool => $id !== $roleId));
    if ($eligible) $ids[] = $roleId;

    $versions = is_array($pricePolicy['performanceVersions'] ?? null) ? array_values($pricePolicy['performanceVersions']) : [];
    $maxVersion = (int)($current['version'] ?? 0);
    foreach ($versions as $version) {
        if (is_array($version)) $maxVersion = max($maxVersion, (int)($version['version'] ?? 0));
    }
    $currentVersion = (int)($current['version'] ?? 0);
    $currentConfigured = ($current['configured'] ?? false) === true;
    if ($currentConfigured && $currentVersion > 0) {
        $hasCurrent = false;
        foreach ($versions as $version) {
            if (is_array($version) && (int)($version['version'] ?? 0) === $currentVersion) {
                $hasCurrent = true;
                break;
            }
        }
        if (!$hasCurrent) $versions[] = $current;
    }

    $next = $current;
    $next['version'] = max(1, $maxVersion + 1);
    $next['effectiveFrom'] = (new DateTimeImmutable('today', new DateTimeZone('Asia/Ulaanbaatar')))->format('Y-m-d');
    $next['createdAt'] = (new DateTimeImmutable('now', new DateTimeZone('Asia/Ulaanbaatar')))->format(DATE_ATOM);
    $next['createdBy'] = (string)($user['username'] ?? 'system');
    $next['cashier'] = array_merge($cashier, ['voucherRoleIds' => $ids]);
    $versions = array_values(array_filter($versions, static fn(mixed $version): bool =>
        !is_array($version) || (int)($version['version'] ?? 0) !== (int)$next['version']
    ));
    $versions[] = $next;
    $pricePolicy['performance'] = $next;
    $pricePolicy['performanceVersions'] = $versions;
    return [$pricePolicy, true];
}

$payload = request_payload();
$action = trim((string)($payload['action'] ?? 'upsert'));
$operationId = substr(trim((string)($payload['operationId'] ?? '')), 0, 120);
$baseRole = is_array($payload['baseRole'] ?? null) ? $payload['baseRole'] : null;
$inputRole = is_array($payload['role'] ?? null) ? $payload['role'] : [];
$requestedId = trim((string)($payload['id'] ?? $inputRole['id'] ?? ''));
if (!in_array($action, ['upsert', 'delete'], true)) {
    json_response(['ok' => false, 'message' => 'Ваучерийн эрхийн үйлдэл буруу байна.'], 422);
}

try {
    $pdo->beginTransaction();
    $revisionStatement = $pdo->query("SELECT meta_value FROM app_meta WHERE meta_key = 'revision' FOR UPDATE");
    $currentRevision = (int)$revisionStatement->fetchColumn();
    if ($operationId !== '') {
        $existingOperation = $pdo->prepare('SELECT actor_user_id, result_payload FROM app_operations WHERE operation_id = ? LIMIT 1');
        $existingOperation->execute([$operationId]);
        $operationRow = $existingOperation->fetch();
        if ($operationRow) {
            if ((int)($operationRow['actor_user_id'] ?? 0) !== (int)($user['id'] ?? 0)) {
                $pdo->rollBack();
                json_response(['ok' => false, 'message' => 'Үйлдлийн дугаар өөр хэрэглэгчид хамаарч байна.'], 409);
            }
            $storedResult = json_decode((string)$operationRow['result_payload'], true);
            $pdo->rollBack();
            json_response((is_array($storedResult) ? $storedResult : ['ok' => true]) + ['idempotentReplay' => true]);
        }
    }

    $roles = array_values(array_filter(voucher_role_rows($pdo, 'voucherRoles', true), 'is_array'));
    $pricePolicy = voucher_role_rows($pdo, 'pricePolicy', true);
    $roleIndex = $requestedId !== '' ? voucher_role_index($roles, $requestedId) : null;
    $policyChanged = false;
    $savedRole = null;
    $deletedId = '';

    if ($action === 'delete') {
        if ($requestedId === '') throw new InvalidArgumentException('Устгах ваучерийн эрх тодорхойгүй байна.');
        if ($roleIndex !== null) {
            $currentRole = $roles[$roleIndex];
            if ($baseRole !== null && $currentRole != $baseRole) {
                throw new DomainException('Энэ ваучерийн эрхийг өөр хэрэглэгч шинэчилсэн байна. Дахин ачаалж шалгана уу.');
            }
            array_splice($roles, $roleIndex, 1);
            [$pricePolicy, $policyChanged] = voucher_role_update_policy($pricePolicy, $requestedId, false, $user);
        }
        $deletedId = $requestedId;
    } else {
        $candidate = voucher_role_validate($inputRole);
        if ($requestedId === '') {
            $candidate['id'] = voucher_role_next_id($roles);
            voucher_role_assert_unique($roles, $candidate);
            array_unshift($roles, $candidate);
        } else {
            if ($roleIndex === null) throw new DomainException('Засах ваучерийн эрх олдсонгүй. Дахин ачаална уу.');
            $currentRole = $roles[$roleIndex];
            if ($baseRole !== null && $currentRole != $baseRole && $currentRole != $candidate) {
                throw new DomainException('Энэ ваучерийн эрхийг өөр хэрэглэгч шинэчилсэн байна. Дахин ачаалж шалгана уу.');
            }
            $candidate['id'] = $requestedId;
            voucher_role_assert_unique($roles, $candidate, $requestedId);
            $roles[$roleIndex] = $candidate;
        }
        $savedRole = $candidate;
        [$pricePolicy, $policyChanged] = voucher_role_update_policy(
            $pricePolicy,
            (string)$candidate['id'],
            (bool)$candidate['cashierCommissionEligible'],
            $user
        );
    }

    $nextRevision = $currentRevision + 1;
    $upsert = $pdo->prepare('INSERT INTO app_sections (section_key, payload, revision) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE payload = VALUES(payload), revision = VALUES(revision), updated_at = CURRENT_TIMESTAMP');
    $upsert->execute(['voucherRoles', json_encode($roles, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $nextRevision]);
    $savedSections = ['voucherRoles'];
    if ($policyChanged) {
        $upsert->execute(['pricePolicy', json_encode($pricePolicy, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), $nextRevision]);
        $savedSections[] = 'pricePolicy';
    }
    $meta = $pdo->prepare("UPDATE app_meta SET meta_value = ? WHERE meta_key = 'revision'");
    $meta->execute([(string)$nextRevision]);
    $nextScopeRevision = bump_scope_revisions($pdo, $user, $savedSections);
    $writeLog = $pdo->prepare('INSERT INTO app_write_log (revision, actor_user_id, actor_username, actor_role, actor_salon, client_id, sections, removed_count) VALUES (?, ?, ?, ?, ?, ?, ?, 0)');
    $writeLog->execute([
        $nextRevision,
        (int)($user['id'] ?? 0) ?: null,
        (string)($user['username'] ?? ''),
        (string)($user['role'] ?? ''),
        (string)($user['salon'] ?? ''),
        substr(trim((string)($payload['clientId'] ?? '')), 0, 80),
        json_encode($savedSections, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
    $result = [
        'ok' => true,
        'action' => $action,
        'role' => $savedRole,
        'deletedId' => $deletedId,
        'voucherRoles' => $roles,
        'pricePolicy' => $pricePolicy,
        'revision' => $nextRevision,
        'scopeRevision' => $nextScopeRevision,
        'sectionRevisions' => array_fill_keys($savedSections, $nextRevision),
    ];
    if ($operationId !== '') {
        $operation = $pdo->prepare('INSERT INTO app_operations (operation_id, revision, actor_user_id, actor_username, actor_role, actor_salon, sections, result_payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $operation->execute([
            $operationId,
            $nextRevision,
            (int)($user['id'] ?? 0) ?: null,
            (string)($user['username'] ?? ''),
            (string)($user['role'] ?? ''),
            (string)($user['salon'] ?? ''),
            json_encode($savedSections, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);
    }
    $pdo->commit();
    json_response($result);
} catch (InvalidArgumentException $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    json_response(['ok' => false, 'message' => $error->getMessage()], 422);
} catch (DomainException $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    json_response(['ok' => false, 'conflict' => true, 'voucherRoleConflict' => true, 'message' => $error->getMessage()], 409);
} catch (Throwable $error) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    $incidentId = gmdate('YmdHis') . '-' . bin2hex(random_bytes(3));
    error_log('Voucher role mutation failed [' . $incidentId . ']: ' . $error->getMessage());
    json_response(['ok' => false, 'message' => 'Ваучерийн эрх хадгалж чадсангүй.', 'incidentId' => $incidentId], 500);
}
