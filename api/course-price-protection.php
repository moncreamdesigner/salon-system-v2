<?php
declare(strict_types=1);

// Existing courses are contracts: changing the catalog must not reprice them.
// Check the original values after entity merging as well as for older clients.
function assert_course_prices_preserved(array $current, array $incoming): void
{
    if (!is_array($incoming['customers'] ?? null)) return;
    $oldCustomers = [];
    foreach ((array)($current['customers'] ?? []) as $customer) {
        if (is_array($customer)) $oldCustomers[(string)($customer['id'] ?? '')] = $customer;
    }
    foreach ($incoming['customers'] as $customer) {
        if (!is_array($customer)) continue;
        $old = $oldCustomers[(string)($customer['id'] ?? '')] ?? null;
        if (!$old) continue;
        $oldCourses = [];
        foreach ((array)($old['serviceHistory'] ?? []) as $service) {
            if (is_array($service) && ($service['kind'] ?? '') === 'course' && !empty($service['id'])) $oldCourses[(string)$service['id']] = $service;
        }
        foreach ((array)($customer['serviceHistory'] ?? []) as $service) {
            if (!is_array($service)) continue;
            $previous = $oldCourses[(string)($service['id'] ?? '')] ?? null;
            if (!$previous) continue;
            foreach (['basePrice', 'visitsTotal', 'employeeDiscountAmount'] as $key) {
                if (!array_key_exists($key, $previous)) continue;
                if ((float)($service[$key] ?? 0) !== (float)$previous[$key]) {
                    throw new DomainException('Бүртгэлтэй курсын үнэ, хөнгөлөлт, оролтын тоог шинэ үнээр солих боломжгүй. Хуудсаа шинэчлээд дахин оролдоно уу.');
                }
            }
            // Closing a course explicitly allows its separate single-visit
            // settlement price; normal edits must preserve the agreed price.
            $closing = empty($previous['transferClosed']) && !empty($service['transferClosed']) && is_array($service['courseClosurePricing'] ?? null);
            if (!$closing && (float)($previous['singleVisitPrice'] ?? 0) > 0 && (float)($service['singleVisitPrice'] ?? 0) !== (float)$previous['singleVisitPrice']) {
                throw new DomainException('Энэ курсын нэг удаагийн үнэ бүртгэх үеийн үнээр хадгалагдана.');
            }
            if (is_array($previous['priceSnapshot'] ?? null) && ($service['priceSnapshot'] ?? null) != $previous['priceSnapshot']) {
                throw new DomainException('Курсын бүртгэлийн үнийн нөхцөлийг өөрчлөх боломжгүй.');
            }
        }
    }
}

function assert_service_price_versions_preserved(array $previous, array $next): void
{
    $today = (new DateTimeImmutable('now', new DateTimeZone('Asia/Ulaanbaatar')))->format('Y-m-d');
    foreach (['single', 'course'] as $kind) {
        foreach ((array)($next[$kind] ?? []) as $item) {
            if (!is_array($item)) continue;
            $oldItem = null;
            foreach ((array)($previous[$kind] ?? []) as $candidate) {
                if (!is_array($candidate)) continue;
                $sameService = !empty($item['code']) ? ($candidate['code'] ?? '') === $item['code'] : ($candidate['name'] ?? '') === ($item['name'] ?? '');
                if ($sameService && ($candidate['customer'] ?? '') === ($item['customer'] ?? '')) { $oldItem = $candidate; break; }
            }
            if (!empty($oldItem['priceVersions'])) {
                foreach (['price', 'singleVisitPrice', 'visits'] as $key) {
                    if (($item[$key] ?? null) != ($oldItem[$key] ?? null)) throw new DomainException('Өмнөх үнийн түүхийг солих боломжгүй. Шинэ хувилбарыг огноогоор нэмнэ үү.');
                }
            }
            $oldVersions = [];
            foreach ((array)($oldItem['priceVersions'] ?? []) as $version) $oldVersions[(string)($version['effectiveFrom'] ?? '')] = $version;
            $newVersions = [];
            foreach ((array)($item['priceVersions'] ?? []) as $version) {
                if (!is_array($version)) throw new DomainException('Үнийн хувилбар буруу байна.');
                $date = (string)($version['effectiveFrom'] ?? '');
                if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) !== 1 || (float)($version['price'] ?? 0) <= 0 || isset($newVersions[$date])) throw new DomainException('Үнийн огноо, дүнг шалгана уу.');
                if ($date < $today && ($oldVersions[$date] ?? null) != $version) throw new DomainException('Өнгөрсөн үнийн түүхийг өөрчлөх боломжгүй.');
                $newVersions[$date] = $version;
            }
            foreach ($oldVersions as $date => $version) {
                if (!isset($newVersions[$date])) throw new DomainException('Үнийн түүх алга болсон тул хадгалсангүй. Хуудсаа шинэчилнэ үү.');
            }
        }
    }
}

function backup_before_service_price_change(PDO $pdo, int $revision): int
{
    $data = [];
    foreach ($pdo->query('SELECT section_key, payload FROM app_sections ORDER BY section_key')->fetchAll() as $row) {
        $data[(string)$row['section_key']] = json_decode((string)$row['payload'], true);
    }
    $encoded = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($encoded === false) throw new RuntimeException('Үнэ шинэчлэхийн өмнөх backup үүссэнгүй.');
    $statement = $pdo->prepare('INSERT INTO app_backups (revision, reason, payload) VALUES (?, ?, ?)');
    $statement->execute([$revision, 'Үйлчилгээний үнэ шинэчлэхийн өмнөх автомат backup', $encoded]);
    return (int)$pdo->lastInsertId();
}
