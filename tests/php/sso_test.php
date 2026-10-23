<?php
/**
 * Portal SSO token verification tests.
 *
 *   php tests/php/sso_test.php
 */

declare(strict_types=1);
require __DIR__ . '/../../php/api/sso.php';

const KEY = '0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0';

function make_token(array $payload, string $key = KEY, array $header = ['alg' => 'HS256', 'typ' => 'JWT']): string
{
    $h = sso_b64url_encode(json_encode($header));
    $p = sso_b64url_encode(json_encode($payload, JSON_UNESCAPED_UNICODE));
    $s = sso_b64url_encode(hash_hmac('sha256', "$h.$p", $key, true));
    return "$h.$p.$s";
}

function claims(int $now, array $override = []): array
{
    return array_merge([
        'uid' => '1234',
        'name' => 'Ayşe Yılmaz',
        'role' => 'ogrenci',
        'sinif' => '11 Yazılım A',
        'iat' => $now,
        'exp' => $now + 300,
        'jti' => bin2hex(random_bytes(16)),
    ], $override);
}

$now = 1760000000;
$jtiDir = sys_get_temp_dir() . '/office-sso-test-' . bin2hex(random_bytes(4));
$store = sso_file_jti_store($jtiDir, $now);

$passed = 0;
$failed = 0;

function check(string $name, callable $fn, ?string $expectError): void
{
    global $passed, $failed;
    try {
        $result = $fn();
        if ($expectError === null) {
            echo "  ✓ $name\n";
            $passed++;
        } else {
            echo "  ✗ $name — expected rejection, got " . json_encode($result, JSON_UNESCAPED_UNICODE) . "\n";
            $failed++;
        }
    } catch (SsoError $e) {
        if ($expectError !== null && strpos($e->getMessage(), $expectError) !== false) {
            echo "  ✓ $name → \"{$e->getMessage()}\"\n";
            $passed++;
        } else {
            echo "  ✗ $name — unexpected error \"{$e->getMessage()}\"\n";
            $failed++;
        }
    }
}

echo "Portal SSO token tests\n";

check('valid token', function () use ($now, $store) {
    $user = sso_verify(make_token(claims($now)), KEY, $now, 30, $store);
    assert_same($user, ['uid' => '1234', 'name' => 'Ayşe Yılmaz', 'role' => 'ogrenci', 'sinif' => '11 Yazılım A']);
    return $user;
}, null);

check('valid teacher token without class', function () use ($now, $store) {
    $user = sso_verify(make_token(claims($now, ['uid' => 'ogretmen-7', 'role' => 'ogretmen', 'sinif' => ''])), KEY, $now, 30, $store);
    assert_same($user['role'], 'ogretmen');
    return $user;
}, null);

check('expired token', fn() => sso_verify(make_token(claims($now - 400)), KEY, $now, 30, $store), 'süresi dolmuş');

check('expired within clock skew is accepted', fn() => sso_verify(make_token(claims($now, ['exp' => $now - 20])), KEY, $now, 30, $store), null);

check('expired beyond clock skew', fn() => sso_verify(make_token(claims($now, ['exp' => $now - 31])), KEY, $now, 30, $store), 'süresi dolmuş');

check('tampered signature', function () use ($now, $store) {
    $token = make_token(claims($now));
    $token[strlen($token) - 2] = $token[strlen($token) - 2] === 'A' ? 'B' : 'A';
    return sso_verify($token, KEY, $now, 30, $store);
}, 'imzası geçersiz');

check('signed with another key', fn() => sso_verify(make_token(claims($now), str_repeat('x', 64)), KEY, $now, 30, $store), 'imzası geçersiz');

check('tampered payload (role changed after signing)', function () use ($now, $store) {
    [$h, , $s] = explode('.', make_token(claims($now)));
    $p = sso_b64url_encode(json_encode(claims($now, ['role' => 'ogretmen'])));
    return sso_verify("$h.$p.$s", KEY, $now, 30, $store);
}, 'imzası geçersiz');

check('alg: none', function () use ($now, $store) {
    $h = sso_b64url_encode(json_encode(['alg' => 'none', 'typ' => 'JWT']));
    $p = sso_b64url_encode(json_encode(claims($now)));
    return sso_verify("$h.$p.", KEY, $now, 30, $store);
}, 'geçersiz');

check('alg: HS512', fn() => sso_verify(make_token(claims($now), KEY, ['alg' => 'HS512', 'typ' => 'JWT']), KEY, $now, 30, $store), 'geçersiz');

check('alg: hs256 (wrong case)', fn() => sso_verify(make_token(claims($now), KEY, ['alg' => 'hs256', 'typ' => 'JWT']), KEY, $now, 30, $store), 'geçersiz');

check('same jti used twice', function () use ($now, $store) {
    $token = make_token(claims($now, ['jti' => 'tekrar-123']));
    sso_verify($token, KEY, $now, 30, $store);
    return sso_verify($token, KEY, $now, 30, $store);
}, 'daha önce kullanılmış');

check('missing uid', function () use ($now, $store) {
    $c = claims($now);
    unset($c['uid']);
    return sso_verify(make_token($c), KEY, $now, 30, $store);
}, 'eksik');

check('empty name', fn() => sso_verify(make_token(claims($now, ['name' => '  '])), KEY, $now, 30, $store), 'eksik');

check('missing role', function () use ($now, $store) {
    $c = claims($now);
    unset($c['role']);
    return sso_verify(make_token($c), KEY, $now, 30, $store);
}, 'eksik');

check('invalid role', fn() => sso_verify(make_token(claims($now, ['role' => 'admin'])), KEY, $now, 30, $store), 'rol geçersiz');

check('missing exp', function () use ($now, $store) {
    $c = claims($now);
    unset($c['exp']);
    return sso_verify(make_token($c), KEY, $now, 30, $store);
}, 'süresi dolmuş');

check('missing jti', function () use ($now, $store) {
    $c = claims($now);
    unset($c['jti']);
    return sso_verify(make_token($c), KEY, $now, 30, $store);
}, 'geçersiz');

check('two parts only', fn() => sso_verify('abc.def', KEY, $now, 30, $store), 'geçersiz');

check('garbage token', fn() => sso_verify('!!!.@@@.###', KEY, $now, 30, $store), 'geçersiz');

check('empty server key', fn() => sso_verify(make_token(claims($now)), '', $now, 30, $store), 'ayarlanmamış');

check('expired jti records are cleaned up', function () use ($now, $jtiDir) {
    $later = sso_file_jti_store($jtiDir, $now + 10000);
    $later('temizlik-tetikleyici', $now + 10300);
    $left = count(glob($jtiDir . '/*.jti'));
    if ($left !== 1) {
        throw new SsoError("expected 1 record after cleanup, found $left");
    }
    return true;
}, null);

function assert_same($actual, $expected): void
{
    if ($actual !== $expected) {
        throw new SsoError('assertion failed: ' . json_encode($actual, JSON_UNESCAPED_UNICODE));
    }
}

array_map('unlink', glob($jtiDir . '/*'));
@rmdir($jtiDir);

echo "\n$passed passed, $failed failed\n";
exit($failed === 0 ? 0 : 1);
