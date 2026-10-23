<?php
/**
 * Shared helpers for the Office PHP backend.
 *
 * Data folder layout (config data_dir, outside the web root):
 *   .env                 PORTAL_SSO_ANAHTAR, PORTAL_ADRES
 *   files/<uid>/...      each user's documents and folders
 *   users/<uid>.json     profile from the last portal login (name, role, class)
 *   jti/                 single-use token records
 *   sessions/            PHP session files
 */

declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');

const OFFICE_EXTENSIONS = [
    // Documents
    'docx', 'doc', 'odt', 'rtf', 'txt', 'html', 'htm', 'mht', 'epub', 'fb2', 'docm', 'dotx', 'dotm', 'dot', 'ott',
    // Spreadsheets
    'xlsx', 'xls', 'ods', 'csv', 'xlsm', 'xltx', 'xltm', 'xlsb', 'ots', 'xlt',
    // Presentations
    'pptx', 'ppt', 'odp', 'ppsx', 'pptm', 'ppsm', 'potx', 'potm', 'otp', 'pps', 'pot', 'odg',
    // Diagrams
    'vsdx', 'vssx', 'vstx', 'vsdm', 'vssm', 'vstm',
    // Other
    'pdf', 'djvu', 'xps', 'oxps',
];

function config(): array
{
    static $config = null;
    if ($config === null) {
        $config = require __DIR__ . '/config.php';
    }
    return $config;
}

/** Values from <data_dir>/.env (KEY=value lines, # comments). */
function env(string $name, string $default = ''): string
{
    static $env = null;
    if ($env === null) {
        $env = [];
        $file = rtrim(config()['data_dir'], '/\\') . '/.env';
        if (is_readable($file)) {
            foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                $line = trim($line);
                if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) {
                    continue;
                }
                [$key, $value] = array_map('trim', explode('=', $line, 2));
                if (strlen($value) >= 2 && ($value[0] === '"' || $value[0] === "'") && substr($value, -1) === $value[0]) {
                    $value = substr($value, 1, -1);
                }
                $env[$key] = $value;
            }
        }
    }
    return $env[$name] ?? $default;
}

function portal_url(): string
{
    return rtrim(env('PORTAL_ADRES', 'https://portal.mkcaglar.com'), '/');
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

function json_response(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $error, int $status = 400, string $message = ''): void
{
    json_response(['ok' => false, 'error' => $error, 'message' => $message ?: $error], $status);
}

/** JSON body of a POST request. */
function body(): array
{
    static $body = null;
    if ($body === null) {
        $raw = file_get_contents('php://input');
        $body = json_decode($raw ?: '[]', true);
        if (!is_array($body)) {
            $body = [];
        }
    }
    return $body;
}

function param(string $name, string $default = ''): string
{
    $value = $_GET[$name] ?? body()[$name] ?? $default;
    return is_string($value) ? $value : $default;
}

/**
 * Every state-changing request must be a POST carrying the X-Office header.
 * Browsers cannot send custom headers cross-site without a CORS preflight,
 * which this API never approves, so this blocks CSRF.
 */
function require_post(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        fail('method_not_allowed', 405);
    }
    if (($_SERVER['HTTP_X_OFFICE'] ?? '') !== '1') {
        fail('bad_request', 400, 'Missing X-Office header');
    }
}

function action(): string
{
    return $_GET['action'] ?? '';
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/** A subfolder of the data folder, created on demand. */
function data_dir(string $sub = ''): string
{
    $dir = rtrim(config()['data_dir'], '/\\') . ($sub === '' ? '' : '/' . $sub);
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        fail('storage_unwritable', 500, 'Sunucu depolama klasörü oluşturulamadı.');
    }
    return $dir;
}

// ---------------------------------------------------------------------------
// Sessions & users
// ---------------------------------------------------------------------------

function is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $lifetime = (int)config()['session_lifetime'];
    // Own session folder: isolates us from other sites on shared hosting and
    // makes the lifetime below actually apply.
    session_save_path(data_dir('sessions'));
    ini_set('session.gc_maxlifetime', (string)$lifetime);
    ini_set('session.use_strict_mode', '1');
    session_name('OFFICESESSID');
    session_set_cookie_params([
        'lifetime' => $lifetime,
        'path' => '/',
        'secure' => is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

/** File-system safe folder name for a portal uid ("1234", "ogretmen-7"). */
function uid_dir(string $uid): string
{
    if (preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/', $uid)) {
        return $uid;
    }
    return 'u-' . substr(hash('sha256', $uid), 0, 32);
}

function current_user(): ?array
{
    start_session();
    $user = $_SESSION['user'] ?? null;
    if (!is_array($user)) {
        return null;
    }
    if (time() - (int)($_SESSION['login_at'] ?? 0) > (int)config()['session_lifetime']) {
        $_SESSION = [];
        return null;
    }
    return $user;
}

function require_user(): array
{
    $user = current_user();
    if (!$user) {
        fail('unauthorized', 401, 'Oturum yok veya süresi dolmuş. Portaldan giriş yapın.');
    }
    // Release the session lock so parallel requests are not serialized.
    session_write_close();
    return $user;
}

function is_teacher(array $user): bool
{
    return $user['role'] === 'ogretmen';
}

/** Open an Office session for verified portal claims. */
function login_session(array $claims): void
{
    start_session();
    session_regenerate_id(true);
    $_SESSION = [
        'user' => $claims,
        'login_at' => time(),
    ];
    // Remember the profile so teachers can list students by name and class.
    $profile = $claims + ['last_login' => time()];
    @file_put_contents(
        data_dir('users') . '/' . uid_dir($claims['uid']) . '.json',
        json_encode($profile, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT),
        LOCK_EX
    );
}

function load_profile(string $uid): ?array
{
    $file = data_dir('users') . '/' . uid_dir($uid) . '.json';
    if (!is_file($file)) {
        return null;
    }
    $profile = json_decode((string)file_get_contents($file), true);
    return is_array($profile) && ($profile['uid'] ?? null) === $uid ? $profile : null;
}

// ---------------------------------------------------------------------------
// User files
// ---------------------------------------------------------------------------

function user_root(string $uid): string
{
    $dir = data_dir('files') . '/' . uid_dir($uid);
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    return $dir;
}

function valid_name(string $name): bool
{
    $length = function_exists('mb_strlen') ? mb_strlen($name, 'UTF-8') : strlen($name);
    if ($name === '' || $name === '.' || $name === '..' || $length > 200) {
        return false;
    }
    if ($name[0] === '.' || preg_match('/[\/\\\\:*?"<>|\x00-\x1F\x7F]/u', $name)) {
        return false;
    }
    return trim($name) === $name;
}

function file_ext(string $name): string
{
    return strtolower(pathinfo($name, PATHINFO_EXTENSION));
}

function allowed_file(string $name): bool
{
    return in_array(file_ext($name), OFFICE_EXTENSIONS, true);
}

/** Normalize a client path ("a/b/c.docx") into a list of validated segments. */
function path_segments(string $path): array
{
    $segments = array_values(array_filter(explode('/', str_replace('\\', '/', $path)), 'strlen'));
    foreach ($segments as $segment) {
        if (!valid_name($segment)) {
            fail('invalid_path', 400);
        }
    }
    return $segments;
}

function rel_path(array $segments): string
{
    return implode('/', $segments);
}

/** Find a free "name (n).ext" in $dir. */
function unique_name(string $dir, string $name): string
{
    if (!file_exists($dir . '/' . $name)) {
        return $name;
    }
    $ext = pathinfo($name, PATHINFO_EXTENSION);
    $base = $ext === '' ? $name : substr($name, 0, -strlen($ext) - 1);
    for ($i = 1; $i < 10000; $i++) {
        $candidate = $base . ' (' . $i . ')' . ($ext === '' ? '' : '.' . $ext);
        if (!file_exists($dir . '/' . $candidate)) {
            return $candidate;
        }
    }
    fail('name_conflict', 409);
    return '';
}

function dir_size(string $dir): int
{
    $size = 0;
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $file) {
        $size += $file->getSize();
    }
    return $size;
}

function check_quota(string $root, int $incoming, int $replacing = 0): void
{
    $max = (int)config()['max_file_mb'] * 1024 * 1024;
    if ($max > 0 && $incoming > $max) {
        fail('file_too_large', 413, 'Dosya ' . config()['max_file_mb'] . ' MB sınırından büyük.');
    }
    $quota = (int)config()['quota_mb'] * 1024 * 1024;
    if ($quota > 0 && dir_size($root) - $replacing + $incoming > $quota) {
        fail('quota_exceeded', 413, 'Depolama kotanız doldu.');
    }
}

function item_info(array $segments, string $abs): array
{
    $isDir = is_dir($abs);
    return [
        'name' => end($segments) ?: '',
        'path' => rel_path($segments),
        'type' => $isDir ? 'dir' : 'file',
        'size' => $isDir ? 0 : filesize($abs),
        'mtime' => filemtime($abs),
    ];
}

function delete_tree(string $path): void
{
    if (is_dir($path) && !is_link($path)) {
        foreach (scandir($path) as $entry) {
            if ($entry !== '.' && $entry !== '..') {
                delete_tree($path . '/' . $entry);
            }
        }
        rmdir($path);
    } else {
        unlink($path);
    }
}

function ini_bytes(string $value): int
{
    $value = trim($value);
    $num = (int)$value;
    switch (strtolower(substr($value, -1))) {
        case 'g': $num *= 1024;
        case 'm': $num *= 1024;
        case 'k': $num *= 1024;
    }
    return $num;
}

/** The effective upload limit, the smallest of PHP's limits and our own. */
function upload_limit(): int
{
    $limits = array_filter([
        ini_bytes((string)ini_get('upload_max_filesize')),
        ini_bytes((string)ini_get('post_max_size')),
        (int)config()['max_file_mb'] * 1024 * 1024,
    ], fn($v) => $v > 0);
    return $limits ? min($limits) : 0;
}
