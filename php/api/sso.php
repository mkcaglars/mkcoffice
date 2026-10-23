<?php
/**
 * Portal SSO token verification (HS256 JWT issued by portal office-git.php).
 *
 * Kept free of side effects other than the injected single-use store, so it
 * can be tested on its own (see tests/sso_test.php).
 */

declare(strict_types=1);

final class SsoError extends Exception
{
}

function sso_b64url_decode(string $data)
{
    if ($data === '' || preg_match('/[^A-Za-z0-9_-]/', $data)) {
        return false;
    }
    $padded = strtr($data, '-_', '+/') . str_repeat('=', (4 - strlen($data) % 4) % 4);
    return base64_decode($padded, true);
}

function sso_b64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

/**
 * Verify a portal token and return the user claims.
 *
 * @param callable $claimJti fn(string $jti, int $exp): bool — atomically records
 *                           the jti; returns false if it was already used.
 * @throws SsoError with a message safe to show to the user (never the token).
 */
function sso_verify(string $token, string $key, int $now, int $skew, callable $claimJti): array
{
    if ($key === '') {
        throw new SsoError('Office SSO anahtarı ayarlanmamış.');
    }

    // 1. Three parts
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        throw new SsoError('Giriş anahtarı geçersiz.');
    }
    [$h64, $p64, $s64] = $parts;

    // 2. Header: exactly HS256
    $header = json_decode((string)sso_b64url_decode($h64), true);
    if (!is_array($header) || !isset($header['alg']) || $header['alg'] !== 'HS256') {
        throw new SsoError('Giriş anahtarı geçersiz.');
    }

    // 3. Signature, constant-time comparison
    $expected = hash_hmac('sha256', $h64 . '.' . $p64, $key, true);
    $signature = sso_b64url_decode($s64);
    if ($signature === false || !hash_equals($expected, $signature)) {
        throw new SsoError('Giriş anahtarının imzası geçersiz.');
    }

    // 4. Expiry
    $payload = json_decode((string)sso_b64url_decode($p64), true);
    if (!is_array($payload)) {
        throw new SsoError('Giriş anahtarı geçersiz.');
    }
    if (!isset($payload['exp']) || !is_numeric($payload['exp']) || (int)$payload['exp'] + $skew < $now) {
        throw new SsoError('Bağlantının süresi dolmuş. Portaldan tekrar giriş yapın.');
    }

    // 5. Required fields
    foreach (['uid', 'name', 'role'] as $field) {
        if (!isset($payload[$field]) || !is_scalar($payload[$field]) || trim((string)$payload[$field]) === '') {
            throw new SsoError('Giriş anahtarında kullanıcı bilgisi eksik.');
        }
    }
    if (!in_array($payload['role'], ['ogrenci', 'ogretmen'], true)) {
        throw new SsoError('Giriş anahtarındaki rol geçersiz.');
    }
    if (!isset($payload['jti']) || !is_string($payload['jti']) || $payload['jti'] === '') {
        throw new SsoError('Giriş anahtarı geçersiz.');
    }

    // 6. Single use
    if (!$claimJti($payload['jti'], (int)$payload['exp'] + $skew)) {
        throw new SsoError('Bu giriş bağlantısı daha önce kullanılmış. Portaldan tekrar giriş yapın.');
    }

    return [
        'uid' => trim((string)$payload['uid']),
        'name' => trim((string)$payload['name']),
        'role' => $payload['role'],
        'sinif' => isset($payload['sinif']) && is_scalar($payload['sinif']) ? trim((string)$payload['sinif']) : '',
    ];
}

/**
 * Single-use store backed by one file per jti. fopen(..., 'x') fails if the
 * file exists, which makes the claim atomic on any filesystem.
 */
function sso_file_jti_store(string $dir, int $now): callable
{
    return function (string $jti, int $expiresAt) use ($dir, $now): bool {
        if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
            throw new SsoError('Sunucu depolama klasörüne yazılamıyor.');
        }
        // Clean up records whose token has expired anyway.
        foreach (glob($dir . '/*.jti') ?: [] as $file) {
            $exp = (int)@file_get_contents($file);
            if ($exp > 0 && $exp < $now) {
                @unlink($file);
            }
        }
        $fp = @fopen($dir . '/' . hash('sha256', $jti) . '.jti', 'x');
        if (!$fp) {
            return false;
        }
        fwrite($fp, (string)$expiresAt);
        fclose($fp);
        return true;
    };
}
