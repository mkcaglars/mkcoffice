<?php
/**
 * Office session. Sign-in happens only through the portal (giris.php).
 *
 *   GET  auth.php?action=status   current user, portal address
 *   POST auth.php?action=logout   close the Office session (the portal session stays)
 */

declare(strict_types=1);
require __DIR__ . '/lib.php';

switch (action()) {
    case 'status':
        json_response([
            'ok' => true,
            'user' => current_user(),
            'portalUrl' => portal_url(),
            'uploadLimit' => upload_limit(),
        ]);

    case 'logout':
        require_post();
        start_session();
        $_SESSION = [];
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 3600,
            'path' => $params['path'],
            'secure' => $params['secure'],
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_destroy();
        json_response(['ok' => true, 'portalUrl' => portal_url()]);

    default:
        fail('unknown_action', 404);
}
