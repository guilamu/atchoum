<?php

/**
 * Authentication Service
 * Handles passwordless login with 6-digit codes
 */

class Auth
{
    /**
     * Request a login code
     * Generates 6-digit code, stores hash, sends email
     */
    public static function requestCode(string $email): array
    {
        // Validate email
        $email = strtolower(trim($email));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['success' => false, 'error' => 'Email invalide'];
        }

        // Check rate limiting
        if (RateLimiter::isBlocked($email, 'request_code')) {
            $remaining = RateLimiter::getBlockedUntil($email, 'request_code');
            $minutes = ceil($remaining / 60);
            return [
                'success' => false,
                'error' => "Trop de tentatives. Réessayez dans $minutes minute(s).",
                'blocked_until' => $remaining,
            ];
        }

        // Generate 6-digit code
        $code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $hashedToken = hash('sha256', $code);

        // Store token
        $db = Database::getInstance();

        // Delete any existing unused tokens for this email
        $stmt = $db->prepare('DELETE FROM auth_tokens WHERE email = ? AND used_at IS NULL');
        $stmt->execute([$email]);

        // Check if user exists
        $stmt = $db->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        // Insert new token
        $stmt = $db->prepare(
            'INSERT INTO auth_tokens (user_id, email, token_hash, expires_at, ip_address) 
             VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE), ?)'
        );
        $stmt->execute([
            $user ? $user['id'] : null,
            $email,
            $hashedToken,
            $_SERVER['REMOTE_ADDR'] ?? null,
        ]);

        // Send email
        $emailSent = Mailer::sendAuthCode($email, $code);

        if (!$emailSent) {
            return ['success' => false, 'error' => 'Erreur lors de l\'envoi de l\'email'];
        }

        // Record rate limiting
        RateLimiter::hit($email, 'request_code');

        // Mask email for response
        $maskedEmail = self::maskEmail($email);

        return [
            'success' => true,
            'message' => 'Code envoyé',
            'masked_email' => $maskedEmail,
        ];
    }

    /**
     * Verify login code and return JWT
     */
    public static function verifyCode(string $email, string $code): array
    {
        $email = strtolower(trim($email));
        $code = trim($code);

        // Validate inputs
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['success' => false, 'error' => 'Email invalide'];
        }

        if (!preg_match('/^\d{6}$/', $code)) {
            return ['success' => false, 'error' => 'Code invalide (6 chiffres requis)'];
        }

        // Check rate limiting
        if (RateLimiter::isBlocked($email, 'validate_code')) {
            $remaining = RateLimiter::getBlockedUntil($email, 'validate_code');
            $hours = ceil($remaining / 3600);
            return [
                'success' => false,
                'error' => "Trop de tentatives. Réessayez dans $hours heure(s).",
                'blocked_until' => $remaining,
            ];
        }

        $hashedToken = hash('sha256', $code);
        $db = Database::getInstance();

        // Find valid token
        $stmt = $db->prepare(
            'SELECT * FROM auth_tokens 
             WHERE email = ? 
             AND used_at IS NULL 
             AND expires_at > NOW()
             ORDER BY created_at DESC 
             LIMIT 1'
        );
        $stmt->execute([$email]);
        $token = $stmt->fetch();

        // Verify token
        if (!$token || !hash_equals($token['token_hash'], $hashedToken)) {
            RateLimiter::hit($email, 'validate_code');
            return ['success' => false, 'error' => 'Code invalide ou expiré'];
        }

        // Mark token as used
        $stmt = $db->prepare('UPDATE auth_tokens SET used_at = NOW() WHERE id = ?');
        $stmt->execute([$token['id']]);

        // Create or update user
        $stmt = $db->prepare('SELECT * FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user) {
            // Create new user
            $userId = Database::uuid();
            $stmt = $db->prepare(
                'INSERT INTO users (id, email, email_verified, last_login_at) 
                 VALUES (?, ?, TRUE, NOW())'
            );
            $stmt->execute([$userId, $email]);

            $user = [
                'id' => $userId,
                'email' => $email,
                'email_verified' => true,
                'consent_diagnostic' => false,
                'created_at' => date('Y-m-d H:i:s'),
            ];
        } else {
            // Update last login
            $stmt = $db->prepare('UPDATE users SET last_login_at = NOW(), email_verified = TRUE WHERE id = ?');
            $stmt->execute([$user['id']]);
        }

        // Clear rate limiting on success
        RateLimiter::clear($email, 'validate_code');
        RateLimiter::clear($email, 'request_code');

        // Generate JWT
        $jwt = JWT::encode([
            'user_id' => $user['id'],
            'email' => $email,
        ]);

        return [
            'success' => true,
            'token' => $jwt,
            'user' => [
                'id' => $user['id'],
                'email' => $email,
                'consent_diagnostic' => (bool)$user['consent_diagnostic'],
            ],
        ];
    }

    /**
     * Get current authenticated user
     */
    public static function getCurrentUser(): ?array
    {
        return JWT::getCurrentUser();
    }

    /**
     * Mask email for display (e.g., g***@example.com)
     */
    private static function maskEmail(string $email): string
    {
        $parts = explode('@', $email);
        if (count($parts) !== 2) {
            return $email;
        }

        $local = $parts[0];
        $domain = $parts[1];

        if (strlen($local) <= 2) {
            $masked = $local[0] . '*';
        } else {
            $masked = $local[0] . str_repeat('*', strlen($local) - 2) . $local[strlen($local) - 1];
        }

        return $masked . '@' . $domain;
    }
}
