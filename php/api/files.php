<?php
/**
 * Files. Paths are relative to a user's own folder, e.g. "Raporlar/odev.docx".
 *
 * Own files (every signed-in user):
 *   GET  files.php?action=list&path=DIR
 *   GET  files.php?action=download&path=FILE[&inline=1]
 *   POST files.php?action=upload&path=DIR           multipart field "file[]"
 *   POST files.php?action=save&path=FILE            raw body, overwrites FILE
 *   POST files.php?action=save&dir=DIR&name=NAME    raw body, creates a new file (unique name)
 *   POST files.php?action=mkdir   {path, name}
 *   POST files.php?action=rename  {path, name}
 *   POST files.php?action=move    {path, to}
 *   POST files.php?action=delete  {path}
 *
 * Teachers, read-only access to students:
 *   GET  files.php?action=students
 *   GET  files.php?action=list&owner=UID&path=DIR
 *   GET  files.php?action=download&owner=UID&path=FILE
 */

declare(strict_types=1);
require __DIR__ . '/lib.php';

$user = require_user();

/**
 * Root folder for this request. Another user's folder is only reachable by a
 * teacher, only for a student, and only for reading.
 */
function target_root(array $user, bool $write): string
{
    $owner = param('owner');
    if ($owner === '' || $owner === $user['uid']) {
        return user_root($user['uid']);
    }
    if ($write) {
        fail('forbidden', 403, 'Öğrenci dosyaları salt okunurdur.');
    }
    if (!is_teacher($user)) {
        fail('forbidden', 403, 'Bu dosyalara erişim yetkiniz yok.');
    }
    $profile = load_profile($owner);
    if (!$profile || ($profile['role'] ?? '') !== 'ogrenci') {
        fail('not_found', 404, 'Öğrenci bulunamadı.');
    }
    return user_root($owner);
}

function existing(string $root, string $path, ?string $type = null): array
{
    $segments = path_segments($path);
    $abs = $segments ? $root . '/' . implode('/', $segments) : $root;
    if (!file_exists($abs)) {
        fail('not_found', 404, 'Dosya veya klasör bulunamadı.');
    }
    if ($type === 'dir' && !is_dir($abs)) {
        fail('not_a_folder', 400);
    }
    if ($type === 'file' && !is_file($abs)) {
        fail('not_a_file', 400);
    }
    return [$segments, $abs];
}

function require_allowed(string $name): void
{
    if (!valid_name($name)) {
        fail('invalid_name', 400, 'Bu ad kullanılamaz.');
    }
    if (!allowed_file($name)) {
        fail('unsupported_type', 400, 'Yalnızca ofis belgeleri saklanabilir.');
    }
}

/** Write the request body to $abs atomically. */
function write_body(string $abs): void
{
    $tmp = $abs . '.uploading-' . bin2hex(random_bytes(4));
    $in = fopen('php://input', 'rb');
    $out = fopen($tmp, 'wb');
    if (!$in || !$out) {
        fail('write_failed', 500);
    }
    $bytes = stream_copy_to_stream($in, $out);
    fclose($in);
    fclose($out);
    if ($bytes === false || $bytes === 0) {
        @unlink($tmp);
        fail('empty_body', 400, 'Dosya verisi alınamadı.');
    }
    if (!rename($tmp, $abs)) {
        @unlink($tmp);
        fail('write_failed', 500);
    }
}

function is_temp_file(string $name): bool
{
    return strpos($name, '.uploading-') !== false;
}

/** Number of files and newest modification time below $dir. */
function tree_stats(string $dir): array
{
    $count = 0;
    $latest = 0;
    if (is_dir($dir)) {
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
        foreach ($it as $file) {
            if ($file->isFile() && !is_temp_file($file->getFilename())) {
                $count++;
                $latest = max($latest, $file->getMTime());
            }
        }
    }
    return [$count, $latest];
}

switch (action()) {
    case 'students':
        if (!is_teacher($user)) {
            fail('forbidden', 403, 'Bu liste yalnızca öğretmenlere açıktır.');
        }
        $students = [];
        foreach (glob(data_dir('users') . '/*.json') ?: [] as $file) {
            $profile = json_decode((string)file_get_contents($file), true);
            if (!is_array($profile) || ($profile['role'] ?? '') !== 'ogrenci') {
                continue;
            }
            [$count, $latest] = tree_stats(data_dir('files') . '/' . uid_dir($profile['uid']));
            $students[] = [
                'uid' => $profile['uid'],
                'name' => $profile['name'] ?? '',
                'sinif' => $profile['sinif'] ?? '',
                'lastLogin' => $profile['last_login'] ?? null,
                'fileCount' => $count,
                'lastModified' => $latest ?: null,
            ];
        }
        json_response(['ok' => true, 'students' => $students]);

    case 'list':
        $root = target_root($user, false);
        [$segments, $abs] = existing($root, param('path'), 'dir');
        $items = [];
        foreach (scandir($abs) as $entry) {
            if ($entry === '.' || $entry === '..' || $entry[0] === '.' || is_temp_file($entry)) {
                continue;
            }
            $items[] = item_info(array_merge($segments, [$entry]), $abs . '/' . $entry);
        }
        $response = ['ok' => true, 'path' => rel_path($segments), 'items' => $items];
        $owner = param('owner');
        if ($owner !== '' && $owner !== $user['uid']) {
            $profile = load_profile($owner);
            $response['owner'] = ['uid' => $owner, 'name' => $profile['name'] ?? '', 'sinif' => $profile['sinif'] ?? ''];
            $response['readOnly'] = true;
        }
        $quota = (int)config()['quota_mb'];
        if ($quota > 0 && empty($response['readOnly'])) {
            $response['usage'] = dir_size($root);
            $response['quota'] = $quota * 1024 * 1024;
        }
        json_response($response);

    case 'download':
        $root = target_root($user, false);
        [$segments, $abs] = existing($root, param('path'), 'file');
        $name = end($segments);
        $disposition = param('inline') === '1' ? 'inline' : 'attachment';
        header('Content-Type: application/octet-stream');
        header('Content-Length: ' . filesize($abs));
        header("Content-Disposition: $disposition; filename=\"" . addcslashes(preg_replace('/[^\x20-\x7E]/', '_', $name), '"\\') . "\"; filename*=UTF-8''" . rawurlencode($name));
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        readfile($abs);
        exit;

    case 'upload':
        require_post();
        $root = target_root($user, true);
        [$segments, $abs] = existing($root, param('path'), 'dir');
        $files = $_FILES['file'] ?? null;
        if (!$files) {
            fail('no_file', 400, 'Dosya alınamadı. Sunucunun izin verdiğinden büyük olabilir.');
        }
        // Normalize single and multiple uploads to the same shape.
        if (!is_array($files['name'])) {
            $files = array_map(fn($v) => [$v], $files);
        }
        $saved = [];
        foreach ($files['name'] as $i => $name) {
            $name = trim(basename(str_replace('\\', '/', (string)$name)));
            if ($files['error'][$i] === UPLOAD_ERR_INI_SIZE || $files['error'][$i] === UPLOAD_ERR_FORM_SIZE) {
                fail('file_too_large', 413, 'Dosya sunucunun izin verdiğinden büyük.');
            }
            if ($files['error'][$i] !== UPLOAD_ERR_OK) {
                fail('upload_failed', 400, 'Yükleme başarısız (kod ' . $files['error'][$i] . ').');
            }
            require_allowed($name);
            check_quota($root, (int)$files['size'][$i]);
            $name = unique_name($abs, $name);
            if (!move_uploaded_file($files['tmp_name'][$i], $abs . '/' . $name)) {
                fail('write_failed', 500);
            }
            $saved[] = item_info(array_merge($segments, [$name]), $abs . '/' . $name);
        }
        json_response(['ok' => true, 'items' => $saved]);

    case 'save':
        require_post();
        $root = target_root($user, true);
        $length = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
        if (param('path') !== '') {
            [$segments, $abs] = existing($root, param('path'), 'file');
            check_quota($root, $length, (int)filesize($abs));
        } else {
            [$dirSegments, $dirAbs] = existing($root, param('dir'), 'dir');
            $name = trim(param('name'));
            require_allowed($name);
            check_quota($root, $length);
            $name = unique_name($dirAbs, $name);
            $segments = array_merge($dirSegments, [$name]);
            $abs = $dirAbs . '/' . $name;
        }
        write_body($abs);
        clearstatcache();
        json_response(['ok' => true, 'item' => item_info($segments, $abs)]);

    case 'mkdir':
        require_post();
        $root = target_root($user, true);
        [$segments, $abs] = existing($root, param('path'), 'dir');
        $name = trim(param('name'));
        if (!valid_name($name)) {
            fail('invalid_name', 400, 'Bu ad kullanılamaz.');
        }
        if (file_exists($abs . '/' . $name)) {
            fail('exists', 409, 'Bu adda bir dosya veya klasör zaten var.');
        }
        if (!mkdir($abs . '/' . $name, 0700)) {
            fail('write_failed', 500);
        }
        json_response(['ok' => true, 'item' => item_info(array_merge($segments, [$name]), $abs . '/' . $name)]);

    case 'rename':
        require_post();
        $root = target_root($user, true);
        [$segments, $abs] = existing($root, param('path'));
        if (!$segments) {
            fail('invalid_path', 400);
        }
        $name = trim(param('name'));
        if (is_dir($abs)) {
            if (!valid_name($name)) {
                fail('invalid_name', 400, 'Bu ad kullanılamaz.');
            }
        } else {
            require_allowed($name);
        }
        $parentSegments = array_slice($segments, 0, -1);
        $target = dirname($abs) . '/' . $name;
        // Allow changing only the letter case of a name.
        if (file_exists($target) && strcasecmp(end($segments), $name) !== 0) {
            fail('exists', 409, 'Bu adda bir dosya veya klasör zaten var.');
        }
        if (!rename($abs, $target)) {
            fail('write_failed', 500);
        }
        json_response(['ok' => true, 'item' => item_info(array_merge($parentSegments, [$name]), $target)]);

    case 'move':
        require_post();
        $root = target_root($user, true);
        [$segments, $abs] = existing($root, param('path'));
        [$toSegments, $toAbs] = existing($root, param('to'), 'dir');
        if (!$segments) {
            fail('invalid_path', 400);
        }
        // A folder cannot be moved into itself.
        if (array_slice($toSegments, 0, count($segments)) === $segments) {
            fail('invalid_target', 400, 'Bir klasör kendi içine taşınamaz.');
        }
        $name = end($segments);
        if (file_exists($toAbs . '/' . $name)) {
            fail('exists', 409, 'Hedefte bu adda bir dosya veya klasör zaten var.');
        }
        if (!rename($abs, $toAbs . '/' . $name)) {
            fail('write_failed', 500);
        }
        json_response(['ok' => true, 'item' => item_info(array_merge($toSegments, [$name]), $toAbs . '/' . $name)]);

    case 'delete':
        require_post();
        $root = target_root($user, true);
        [$segments, $abs] = existing($root, param('path'));
        if (!$segments) {
            fail('invalid_path', 400);
        }
        delete_tree($abs);
        json_response(['ok' => true]);

    default:
        fail('unknown_action', 404);
}
