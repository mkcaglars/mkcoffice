<?php
/**
 * One-time migration: move documents from an old system's per-user folders
 * into the portal uid folders used by the SSO version.
 *
 *   php uid-tasima.php ESKI_KLASOR ESLEME.csv [--uygula]
 *
 * ESKI_KLASOR   folder with one subfolder per old user, e.g. old-data/files
 * ESLEME.csv    two columns per line: old_username,uid   (e.g. "ayse,1234",
 *               "mehmet.hoca,ogretmen-7"); a header line is allowed
 * --uygula      actually move the files. Without it only a report is printed.
 *
 * Files are moved into <data_dir>/files/<uid>/; name clashes get " (n)".
 * Run it from the command line (SSH or the hosting panel's terminal).
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit;
}

$args = array_values(array_filter(array_slice($argv, 1), fn($a) => $a !== '--uygula'));
$apply = in_array('--uygula', $argv, true);
if (count($args) !== 2) {
    fwrite(STDERR, "Kullanım: php uid-tasima.php ESKI_KLASOR ESLEME.csv [--uygula]\n");
    exit(2);
}
[$oldRoot, $mapFile] = $args;
$oldRoot = rtrim($oldRoot, '/');
$dataDir = dirname(__DIR__);
$newRoot = $dataDir . '/files';

if (!is_dir($oldRoot)) {
    fwrite(STDERR, "Eski klasör bulunamadı: $oldRoot\n");
    exit(1);
}

// Same folder naming as php/api/lib.php uid_dir().
function uid_dir(string $uid): string
{
    if (preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/', $uid)) {
        return $uid;
    }
    return 'u-' . substr(hash('sha256', $uid), 0, 32);
}

$map = [];
foreach (file($mapFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $n => $line) {
    $cols = array_map('trim', str_getcsv($line));
    if (count($cols) < 2 || $cols[0] === '' || $cols[1] === '') {
        fwrite(STDERR, "Eşleme satırı " . ($n + 1) . " atlandı: $line\n");
        continue;
    }
    if ($n === 0 && in_array(strtolower($cols[1]), ['uid', 'yeni', 'yeni_uid'], true)) {
        continue; // header
    }
    $map[strtolower($cols[0])] = $cols[1];
}

$matched = [];
$unmatched = [];
foreach (scandir($oldRoot) as $entry) {
    if ($entry[0] === '.' || !is_dir("$oldRoot/$entry")) {
        continue;
    }
    $count = iterator_count(new RecursiveIteratorIterator(new RecursiveDirectoryIterator("$oldRoot/$entry", FilesystemIterator::SKIP_DOTS)));
    if (isset($map[strtolower($entry)])) {
        $matched[] = [$entry, $map[strtolower($entry)], $count];
    } else {
        $unmatched[] = [$entry, $count];
    }
}

echo "Eşleşmeyen kullanıcılar (" . count($unmatched) . "):\n";
foreach ($unmatched as [$name, $count]) {
    echo "  - $name ($count öğe) — taşınmayacak\n";
}
echo "\nEşleşen kullanıcılar (" . count($matched) . "):\n";
foreach ($matched as [$name, $uid, $count]) {
    echo "  - $name → $uid ($count öğe)\n";
}

if (!$apply) {
    echo "\nDeneme çalıştırması: hiçbir şey taşınmadı. Listeyi kontrol edip --uygula ile tekrar çalıştırın.\n";
    exit(0);
}

function unique_target(string $dir, string $name): string
{
    if (!file_exists("$dir/$name")) {
        return "$dir/$name";
    }
    $ext = pathinfo($name, PATHINFO_EXTENSION);
    $base = $ext === '' ? $name : substr($name, 0, -strlen($ext) - 1);
    for ($i = 1; ; $i++) {
        $candidate = "$dir/$base ($i)" . ($ext === '' ? '' : ".$ext");
        if (!file_exists($candidate)) {
            return $candidate;
        }
    }
}

function move_tree(string $from, string $to): int
{
    if (!is_dir($to)) {
        mkdir($to, 0700, true);
    }
    $moved = 0;
    foreach (scandir($from) as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }
        if (is_dir("$from/$entry") && is_dir("$to/$entry")) {
            $moved += move_tree("$from/$entry", "$to/$entry");
            @rmdir("$from/$entry");
        } else {
            rename("$from/$entry", unique_target($to, $entry));
            $moved++;
        }
    }
    return $moved;
}

echo "\nTaşınıyor...\n";
foreach ($matched as [$name, $uid]) {
    $moved = move_tree("$oldRoot/$name", $newRoot . '/' . uid_dir($uid));
    @rmdir("$oldRoot/$name");
    echo "  ✓ $name → $uid: $moved öğe\n";
}
echo "Tamamlandı.\n";
