<?php

/**
 * Rate Limiter
 * Prevents brute force attacks on authentication
 */

class RateLimiter
{
    /**
     * Check if action is rate limited
     * Returns true if blocked, false if allowed
     */
    public static function isBlocked(string $email, string $actionType): bool
    {
        $db = Database::getInstance();

        // Check if currently blocked
        $stmt = $db->prepare(
            'SELECT blocked_until FROM rate_limiting 
             WHERE email = ? AND action_type = ? AND blocked_until > NOW()'
        );
        $stmt->execute([$email, $actionType]);

        if ($stmt->fetch()) {
            return true;
        }

        // Check attempt counts
        $limits = self::getLimits($actionType);

        $stmt = $db->prepare(
            'SELECT attempts, window_start FROM rate_limiting 
             WHERE email = ? AND action_type = ? 
             AND window_start > DATE_SUB(NOW(), INTERVAL ? SECOND)'
        );
        $stmt->execute([$email, $actionType, $limits['window_seconds']]);
        $record = $stmt->fetch();

        if ($record && $record['attempts'] >= $limits['max_attempts']) {
            // Block the user
            self::block($email, $actionType, $limits['block_duration']);
            return true;
        }

        return false;
    }

    /**
     * Record an attempt
     */
    public static function hit(string $email, string $actionType): void
    {
        $db = Database::getInstance();
        $limits = self::getLimits($actionType);

        // Check for existing record in current window
        $stmt = $db->prepare(
            'SELECT id, attempts FROM rate_limiting 
             WHERE email = ? AND action_type = ? 
             AND window_start > DATE_SUB(NOW(), INTERVAL ? SECOND)'
        );
        $stmt->execute([$email, $actionType, $limits['window_seconds']]);
        $record = $stmt->fetch();

        if ($record) {
            // Increment attempts
            $stmt = $db->prepare(
                'UPDATE rate_limiting SET attempts = attempts + 1 WHERE id = ?'
            );
            $stmt->execute([$record['id']]);
        } else {
            // Create new record
            $stmt = $db->prepare(
                'INSERT INTO rate_limiting (email, action_type, attempts, window_start) 
                 VALUES (?, ?, 1, NOW())'
            );
            $stmt->execute([$email, $actionType]);
        }
    }

    /**
     * Block user for specified duration
     */
    private static function block(string $email, string $actionType, int $seconds): void
    {
        $db = Database::getInstance();

        $stmt = $db->prepare(
            'UPDATE rate_limiting 
             SET blocked_until = DATE_ADD(NOW(), INTERVAL ? SECOND) 
             WHERE email = ? AND action_type = ?'
        );
        $stmt->execute([$seconds, $email, $actionType]);
    }

    /**
     * Clear rate limiting for successful action
     */
    public static function clear(string $email, string $actionType): void
    {
        $db = Database::getInstance();

        $stmt = $db->prepare(
            'DELETE FROM rate_limiting WHERE email = ? AND action_type = ?'
        );
        $stmt->execute([$email, $actionType]);
    }

    /**
     * Get limits for action type
     */
    private static function getLimits(string $actionType): array
    {
        if ($actionType === 'request_code') {
            return [
                'max_attempts' => Database::getConfig('rate_limit_request_code_per_hour', 1),
                'window_seconds' => 3600, // 1 hour
                'block_duration' => 3600, // Block for 1 hour
            ];
        }

        if ($actionType === 'validate_code') {
            return [
                'max_attempts' => Database::getConfig('rate_limit_verify_attempts_per_day', 2),
                'window_seconds' => 86400, // 24 hours
                'block_duration' => 86400, // Block for 24 hours
            ];
        }

        // Default
        return [
            'max_attempts' => 10,
            'window_seconds' => 3600,
            'block_duration' => 3600,
        ];
    }

    /**
     * Get remaining time until unblocked (in seconds)
     */
    public static function getBlockedUntil(string $email, string $actionType): ?int
    {
        $db = Database::getInstance();

        $stmt = $db->prepare(
            'SELECT UNIX_TIMESTAMP(blocked_until) - UNIX_TIMESTAMP(NOW()) as remaining
             FROM rate_limiting 
             WHERE email = ? AND action_type = ? AND blocked_until > NOW()'
        );
        $stmt->execute([$email, $actionType]);
        $result = $stmt->fetch();

        return $result ? (int)$result['remaining'] : null;
    }
}
