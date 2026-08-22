import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const publicApi = fs.readFileSync(new URL("../api/public.php", import.meta.url), "utf8");
const deleteUpload = fs.readFileSync(new URL("../api/delete-upload.php", import.meta.url), "utf8");
const rollingBackups = fs.readFileSync(new URL("../api/rolling-backups.php", import.meta.url), "utf8");
const fullBackups = fs.readFileSync(new URL("../api/full-backups.php", import.meta.url), "utf8");
const bootstrap = fs.readFileSync(new URL("../api/bootstrap.php", import.meta.url), "utf8");
const usersApi = fs.readFileSync(new URL("../api/users.php", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

assert.match(
  bootstrap,
  /function require_auth\(bool \$keepSessionOpen = false\)[\s\S]*session_write_close\(\);/,
  "Authenticated API requests must release the PHP session lock before long database or backup work"
);
assert.match(
  usersApi,
  /require_admin\(true\)/,
  "The user-management endpoint must keep its session open when updating the signed-in user"
);

const serverInitializer = app.slice(
  app.indexOf("async function initializeServerStorage("),
  app.indexOf("const AUTO_REFRESH_VIEWS")
);
const loginHandler = app.slice(
  app.indexOf('overlay.querySelector("#serverLoginForm")'),
  app.indexOf("const VIEW_SERVER_SECTIONS")
);
assert.match(
  loginHandler,
  /const loginSections = VIEW_SERVER_SECTIONS\[activeView\] \|\| null;[\s\S]*await synchronizeServerState\(null, loginSections, loginSections \? activeView : null\);/,
  "Signing in must load only the active operational view instead of the full database"
);
assert.match(
  serverInitializer,
  /const initialSections = VIEW_SERVER_SECTIONS\[activeView\] \|\| null;[\s\S]*await synchronizeServerState\(null, initialSections, initialSections \? activeView : null\);[\s\S]*renderActiveView\(activeView, \{ force: true \}\);/,
  "Daily operational data must render immediately after the active-view server state loads"
);
assert.doesNotMatch(
  serverInitializer.slice(serverInitializer.indexOf("async function initializeServerStorage(")),
  /load(?:Database|Rolling|Full)Backups|loadRecoveryJournal|loadChangeEvents/,
  "Backup metadata must not block the initial operational screen"
);
const databaseTabSetter = app.slice(
  app.indexOf("function setDatabaseTab("),
  app.indexOf("function formatBackupCreatedAt(")
);
assert.match(
  databaseTabSetter,
  /activeDatabaseTab === "backup"[\s\S]*loadDatabaseBackups[\s\S]*loadRollingBackups[\s\S]*loadRecoveryJournal[\s\S]*loadChangeEvents[\s\S]*loadFullBackups/,
  "Backup and recovery metadata must load lazily only when the backup tab opens"
);

assert.doesNotMatch(
  publicApi,
  /count\(\$bookings\)\s*>\s*5000|array_slice\(\$bookings,\s*0,\s*5000\)/,
  "Public booking must never silently discard old bookings"
);
assert.match(
  publicApi,
  /Historical rows and phone[\s\S]*'salon'[\s\S]*'date'[\s\S]*'time'[\s\S]*'status'/,
  "Anonymous booking reads must receive only future slot occupancy fields"
);
assert.match(
  publicApi,
  /\$singleSalon[\s\S]*\$holiday\['salons'\]/,
  "Public booking must support both holiday record formats without closing unrelated salons"
);

const applyServerData = app.slice(
  app.indexOf("function applyServerData("),
  app.indexOf("function showServerSyncOverlay(")
);
const renderVouchers = app.slice(
  app.indexOf("function renderVouchers("),
  app.indexOf("function renderGiftCards(")
);
assert.doesNotMatch(
  renderVouchers,
  /ensureVoucherLogRoleIds\(\)\s*\)\s*saveState|ensureVoucherLogRoleIds\(\)\s*&&\s*saveState/,
  "Opening the voucher page must not persist a data migration"
);
assert.doesNotMatch(
  applyServerData,
  /normalizeCustomerNamesWithoutSurname|ensureCustomerBonusTypeRules|stripLegacyEmbeddedImages/,
  "Loading server data must not run destructive migrations"
);
assert.match(
  applyServerData,
  /applyPendingCustomerProfileUpdates[\s\S]*applyPendingPaymentMutations/,
  "Durable pending user operations must still be replayed"
);

assert.doesNotMatch(
  deleteUpload,
  /unlink\(\$path\)/,
  "Diagnosis delete must not permanently unlink the active media file"
);
assert.match(
  deleteUpload,
  /rename\(\$path,\s*\$trashPath\)/,
  "Diagnosis media must move to recoverable trash"
);
assert.match(
  app,
  /clearPendingServerOperation\(savingOperationId\);[\s\S]*flushMediaTrashRequestsThrough\(savingMutationVersion\)/,
  "Diagnosis media cleanup must start only after the database operation commits"
);
assert.match(
  rollingBackups,
  /create_rolling_backup\(\$pdo,\s*\$root,\s*true,\s*'cron'\)/,
  "Server cron backups must be distinguishable from browser-triggered backups"
);
assert.match(
  rollingBackups,
  /last_server_cron_at/,
  "Cron health must use a dedicated server heartbeat"
);
assert.match(
  rollingBackups,
  /prune_media_trash\(30\)/,
  "Cron must clean only media that has completed the trash retention period"
);
assert.match(
  rollingBackups,
  /hash_file\('sha256',\s*\$finalPath\)[\s\S]*hash_equals\(\$expectedHash,\s*hash\('sha256',\s*\$compressed\)\)/,
  "Rolling backups must store and verify a checksum"
);
assert.match(
  fullBackups,
  /PHP_SAPI\s*===\s*'cli'[\s\S]*create_full_backup\(\$pdo,\s*'Сарын автомат server full backup',\s*true\)/,
  "Monthly full backups must run without an admin browser"
);
assert.match(
  fullBackups,
  /\$zipOpen\s*=\s*false;[\s\S]*\$zipOpen\s*=\s*true;[\s\S]*\$zip->close\(\)[\s\S]*\$zipOpen\s*=\s*false;[\s\S]*if\s*\(!empty\(\$zipOpen\)/,
  "A completed full backup ZIP must not be closed a second time in cleanup"
);
assert.match(
  fullBackups,
  /const\s+FULL_BACKUP_KEEP_COUNT\s*=\s*5\s*;/,
  "Full backup retention must preserve the latest five versions"
);
assert.match(
  app,
  /result\.settings\?\.keepCount[\s\S]*databaseFullBackupPolicy[\s\S]*serverFullBackupSettings\.keepCount/,
  "Full backup UI must render retention from the server setting"
);
assert.match(
  index,
  /id="databaseFullBackupPolicy">30 хоног тутам · сүүлийн 5 хувилбар[\s\S]*Бүрэн нөөц ZIP үүсгэх/,
  "Full backup UI defaults and action label must match the active Mongolian policy"
);

console.log("data-safety-release-a.test: OK");
