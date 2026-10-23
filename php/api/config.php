<?php
/**
 * Office — server configuration.
 *
 * Secrets do NOT go here. They live in the .env file inside the data folder,
 * which must be outside the web root (see .env.example).
 */

return [
    // Data folder: .env, user files, single-use token records, sessions.
    // Default: "office-data" next to the web root, e.g. with the site in
    // /home/USER/public_html this is /home/USER/office-data.
    'data_dir' => dirname(__DIR__, 2) . '/office-data',

    // Per-user storage quota in megabytes. 0 = unlimited.
    'quota_mb' => 0,

    // Largest file that can be uploaded or saved, in megabytes.
    // PHP's upload_max_filesize / post_max_size must also allow it.
    'max_file_mb' => 100,

    // Office session lifetime (seconds).
    'session_lifetime' => 8 * 60 * 60,

    // Accepted clock difference between the portal and this server (seconds).
    'clock_skew' => 30,
];
