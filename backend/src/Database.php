<?php

/**
 * Database Connection Class
 * Simple PDO wrapper for MySQL
 */

class Database
{
    private static ?PDO $instance = null;
    private static array $config = [];

    /**
     * Get PDO instance (singleton)
     */
    public static function getInstance(): PDO
    {
        if (self::$instance === null) {
            self::$config = self::loadConfig();

            $dsn = sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=%s',
                self::$config['host'],
                self::$config['port'],
                self::$config['database'],
                self::$config['charset']
            );

            self::$instance = new PDO(
                $dsn,
                self::$config['username'],
                self::$config['password'],
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]
            );
        }

        return self::$instance;
    }

    /**
     * Load database configuration
     */
    private static function loadConfig(): array
    {
        $configPath = dirname(__DIR__) . '/config/database.php';

        if (!file_exists($configPath)) {
            throw new Exception('Database configuration not found');
        }

        return require $configPath;
    }

    /**
     * Get a config value
     */
    public static function getConfig(string $key, $default = null)
    {
        if (empty(self::$config)) {
            self::$config = self::loadConfig();
        }
        return self::$config[$key] ?? $default;
    }

    /**
     * Generate a UUID v4
     */
    public static function uuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
