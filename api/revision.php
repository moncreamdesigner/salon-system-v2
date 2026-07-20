<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

verify_same_origin();
require_auth();

$revision = (int)db()->query("SELECT meta_value FROM app_meta WHERE meta_key = 'revision'")->fetchColumn();
json_response(['ok' => true, 'revision' => $revision]);
