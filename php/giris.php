<?php
/**
 * Portal SSO entry point.
 *
 *   giris.php?token=<JWT>   verify the portal token, open an Office session, go to /
 *   giris.php?tani=1        key diagnostics (teachers only): length + fingerprint
 *
 * The token and the key are never logged, echoed or put in error messages.
 */

declare(strict_types=1);
require __DIR__ . '/api/lib.php';
require __DIR__ . '/api/sso.php';

header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');

function page(string $title, string $message, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    $portal = htmlspecialchars(portal_url(), ENT_QUOTES);
    $title = htmlspecialchars($title, ENT_QUOTES);
    $message = htmlspecialchars($message, ENT_QUOTES);
    echo <<<HTML
<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>{$title} — MKC Ofis</title>
<style>
  :root { color-scheme: light dark; --bg: #f5f5f5; --card: #fff; --fg: #1c1c1c; --muted: #605e5c; --accent: #d04f2f; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0b0b0b; --card: #1a1a1a; --fg: #f2f2f2; --muted: #a8a8a8; } }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, sans-serif; padding: 16px; box-sizing: border-box; }
  .card { background: var(--card); border-radius: 16px; padding: 32px; max-width: 420px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,.08); text-align: center; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p { color: var(--muted); margin: 0 0 24px; }
  a { display: inline-block; background: var(--accent); color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 10px; font-weight: 600; }
</style>
</head>
<body>
<div class="card">
  <h1>{$title}</h1>
  <p>{$message}</p>
  <a href="{$portal}">Portala dön</a>
</div>
</body>
</html>
HTML;
    exit;
}

// --- Diagnostics -------------------------------------------------------------
if (isset($_GET['tani'])) {
    $user = current_user();
    if (!$user || !is_teacher($user)) {
        page('Yetkisiz', 'Bu sayfa yalnızca öğretmen oturumuyla açılabilir.', 403);
    }
    $key = env('PORTAL_SSO_ANAHTAR');
    page(
        'SSO tanı',
        $key === ''
            ? 'PORTAL_SSO_ANAHTAR ayarlanmamış.'
            : 'Anahtar uzunluğu: ' . strlen($key) . ' karakter · SHA-256 parmak izi: ' . substr(hash('sha256', $key), 0, 8)
    );
}

// --- Login -------------------------------------------------------------------
$token = $_GET['token'] ?? '';
if (!is_string($token) || $token === '') {
    page('Portaldan giriş yapın', 'Office\'e portal üzerinden giriş yapılır.', 400);
}

try {
    $now = time();
    $claims = sso_verify(
        $token,
        env('PORTAL_SSO_ANAHTAR'),
        $now,
        (int)config()['clock_skew'],
        sso_file_jti_store(data_dir('jti'), $now)
    );
} catch (SsoError $e) {
    page('Giriş yapılamadı', $e->getMessage(), 401);
}
unset($token);

login_session($claims);

// Leave the token out of the address bar and history.
header('Location: /', true, 303);
exit;
