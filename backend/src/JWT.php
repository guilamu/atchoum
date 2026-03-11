<?php

/**
 * Simple JWT Implementation
 * Uses HS256 (HMAC-SHA256) for signing
 */

class JWT
{
    /**
     * Encode payload into JWT token
     */
    public static function encode(array $payload): string
    {
        $secret = Database::getConfig('jwt_secret');
        $expiryDays = Database::getConfig('jwt_expiry_days', 30);

        // Add expiration if not present
        if (!isset($payload['exp'])) {
            $payload['exp'] = time() + ($expiryDays * 24 * 3600);
        }

        // Add issued at
        $payload['iat'] = time();

        $header = self::base64UrlEncode(json_encode([
            'typ' => 'JWT',
            'alg' => 'HS256'
        ]));

        $payloadEncoded = self::base64UrlEncode(json_encode($payload));
        $signature = self::base64UrlEncode(
            hash_hmac('sha256', "$header.$payloadEncoded", $secret, true)
        );

        return "$header.$payloadEncoded.$signature";
    }

    /**
     * Decode and validate JWT token
     * Returns payload array or null if invalid
     */
    public static function decode(string $token): ?array
    {
        $secret = Database::getConfig('jwt_secret');
        $parts = explode('.', $token);

        if (count($parts) !== 3) {
            return null;
        }

        [$header, $payload, $signature] = $parts;

        // Verify signature
        $expectedSignature = self::base64UrlEncode(
            hash_hmac('sha256', "$header.$payload", $secret, true)
        );

        if (!hash_equals($expectedSignature, $signature)) {
            return null;
        }

        $payloadData = json_decode(self::base64UrlDecode($payload), true);

        if (!$payloadData) {
            return null;
        }

        // Check expiration
        if (isset($payloadData['exp']) && $payloadData['exp'] < time()) {
            return null;
        }

        return $payloadData;
    }

    /**
     * Extract token from Authorization header
     */
    public static function getTokenFromHeader(): ?string
    {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';

        if (preg_match('/Bearer\s+(.+)$/i', $authHeader, $matches)) {
            return $matches[1];
        }

        return null;
    }

    /**
     * Get current authenticated user from JWT
     */
    public static function getCurrentUser(): ?array
    {
        $token = self::getTokenFromHeader();

        if (!$token) {
            return null;
        }

        $payload = self::decode($token);

        if (!$payload || !isset($payload['user_id'])) {
            return null;
        }

        // Fetch user from database
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$payload['user_id']]);

        return $stmt->fetch() ?: null;
    }

    private static function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string
    {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
