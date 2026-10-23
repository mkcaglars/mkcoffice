<?php
/**
 * Test helper standing in for the portal's office-git.php: prints a fresh
 * SSO token. Never deploy this.
 *
 *   php tests/php/portal_token.php KEY UID "NAME" ROLE ["SINIF"] [EXP_OFFSET]
 */

declare(strict_types=1);
require __DIR__ . '/../../php/api/sso.php';

[$_, $key, $uid, $name, $role] = $argv;
$sinif = $argv[5] ?? '';
$now = time();
$exp = $now + (int)($argv[6] ?? 300);
$h = sso_b64url_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
$p = sso_b64url_encode(json_encode(compact('uid', 'name', 'role', 'sinif') + ['iat' => $now, 'exp' => $exp, 'jti' => bin2hex(random_bytes(16))], JSON_UNESCAPED_UNICODE));
$s = sso_b64url_encode(hash_hmac('sha256', "$h.$p", $key, true));
echo "$h.$p.$s";
