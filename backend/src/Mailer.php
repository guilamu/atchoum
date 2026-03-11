<?php

/**
 * Email Mailer with Brevo (primary) + SendPulse (fallback)
 *
 * Brevo is used for the first 290 emails/day (limit: 300).
 * After 290 or on any Brevo error, SendPulse takes over.
 * Daily counter resets at midnight (server time).
 */

class Mailer
{
    private const BREVO_DAILY_LIMIT = 290;
    private const COUNTER_FILE = __DIR__ . '/../../cache/email_counter.json';

    // ==========================================
    // PUBLIC API
    // ==========================================

    /**
     * Send authentication code email
     */
    public static function sendAuthCode(string $email, string $code): bool
    {
        $fromEmail = Database::getConfig('email_from', 'noreply@yourdomain.com');
        $fromName = Database::getConfig('email_from_name', 'Atchoum!');
        $subject = "🤧 Votre code Atchoum! : $code";
        $htmlContent = self::getEmailTemplate($code);
        $textContent = "Votre code de connexion Atchoum! est : $code\n\nCe code expire dans 15 minutes.\nNe le partagez avec personne.";

        return self::send($email, $subject, $htmlContent, $textContent, $fromEmail, $fromName);
    }

    /**
     * Send raw HTML email
     */
    public static function sendRaw(string $email, string $subject, string $htmlContent): bool
    {
        $fromEmail = Database::getConfig('email_from', 'noreply@yourdomain.com');
        $fromName = Database::getConfig('email_from_name', 'Atchoum!');

        return self::send($email, $subject, $htmlContent, null, $fromEmail, $fromName);
    }

    // ==========================================
    // SEND WITH FALLBACK
    // ==========================================

    /**
     * Send email: try Brevo first (if under daily limit), fallback to SendPulse
     */
    private static function send(
        string $to,
        string $subject,
        string $htmlContent,
        ?string $textContent,
        string $fromEmail,
        string $fromName
    ): bool {
        $counter = self::getDailyCounter();

        // Try Brevo if under the daily limit
        if ($counter < self::BREVO_DAILY_LIMIT) {
            $brevoResult = self::sendViaBrevo($to, $subject, $htmlContent, $textContent, $fromEmail, $fromName);
            if ($brevoResult) {
                self::incrementCounter();
                return true;
            }
            // Brevo failed — fall through to SendPulse
            error_log("Brevo failed, falling back to SendPulse for: $to");
        } else {
            error_log("Brevo daily limit reached ($counter/" . self::BREVO_DAILY_LIMIT . "), using SendPulse for: $to");
        }

        // Fallback: SendPulse
        return self::sendViaSendPulse($to, $subject, $htmlContent, $textContent, $fromEmail, $fromName);
    }

    // ==========================================
    // BREVO
    // ==========================================

    private static function sendViaBrevo(
        string $to,
        string $subject,
        string $htmlContent,
        ?string $textContent,
        string $fromEmail,
        string $fromName
    ): bool {
        $apiKey = Database::getConfig('brevo_api_key');

        if (empty($apiKey) || $apiKey === 'your_brevo_api_key_here') {
            error_log('Brevo API key not configured');
            return false;
        }

        $data = [
            'sender' => [
                'name' => $fromName,
                'email' => $fromEmail,
            ],
            'to' => [
                ['email' => $to],
            ],
            'subject' => $subject,
            'htmlContent' => $htmlContent,
        ];

        if ($textContent) {
            $data['textContent'] = $textContent;
        }

        $ch = curl_init('https://api.brevo.com/v3/smtp/email');

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'accept: application/json',
                'api-key: ' . $apiKey,
                'content-type: application/json',
            ],
            CURLOPT_POSTFIELDS => json_encode($data),
            CURLOPT_TIMEOUT => 30,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            error_log("Brevo curl error: $error");
            return false;
        }

        if ($httpCode >= 200 && $httpCode < 300) {
            return true;
        }

        error_log("Brevo API error: HTTP $httpCode - $response");
        return false;
    }

    // ==========================================
    // SENDPULSE
    // ==========================================

    private static function sendViaSendPulse(
        string $to,
        string $subject,
        string $htmlContent,
        ?string $textContent,
        string $fromEmail,
        string $fromName
    ): bool {
        $token = self::getSendPulseToken();
        if (!$token) {
            error_log('SendPulse: failed to get access token');
            return false;
        }

        $data = [
            'email' => [
                'subject' => $subject,
                'from' => [
                    'name' => $fromName,
                    'email' => $fromEmail,
                ],
                'to' => [
                    ['email' => $to],
                ],
                'html' => $htmlContent,
            ],
        ];

        if ($textContent) {
            $data['email']['text'] = $textContent;
        }

        $ch = curl_init('https://api.sendpulse.com/smtp/emails');

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $token,
                'Content-Type: application/json',
            ],
            CURLOPT_POSTFIELDS => json_encode($data),
            CURLOPT_TIMEOUT => 30,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            error_log("SendPulse curl error: $error");
            return false;
        }

        if ($httpCode >= 200 && $httpCode < 300) {
            error_log("SendPulse: email sent successfully to $to");
            return true;
        }

        error_log("SendPulse API error: HTTP $httpCode - $response");
        return false;
    }

    /**
     * Get SendPulse OAuth2 access token (cached for 1 hour)
     */
    private static function getSendPulseToken(): ?string
    {
        $tokenFile = __DIR__ . '/../../cache/sendpulse_token.json';

        // Check cached token
        if (file_exists($tokenFile)) {
            $cached = json_decode(file_get_contents($tokenFile), true);
            if ($cached && isset($cached['token'], $cached['expires']) && $cached['expires'] > time()) {
                return $cached['token'];
            }
        }

        // Request new token
        $clientId = Database::getConfig('sendpulse_client_id');
        $clientSecret = Database::getConfig('sendpulse_client_secret');

        if (empty($clientId) || empty($clientSecret)) {
            error_log('SendPulse credentials not configured');
            return null;
        }

        $ch = curl_init('https://api.sendpulse.com/oauth/access_token');

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
            ],
            CURLOPT_POSTFIELDS => json_encode([
                'grant_type' => 'client_credentials',
                'client_id' => $clientId,
                'client_secret' => $clientSecret,
            ]),
            CURLOPT_TIMEOUT => 15,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error || $httpCode !== 200) {
            error_log("SendPulse token error: HTTP $httpCode - $error - $response");
            return null;
        }

        $data = json_decode($response, true);
        if (!isset($data['access_token'])) {
            error_log("SendPulse token response missing access_token: $response");
            return null;
        }

        // Cache token (expires_in is typically 3600 seconds)
        $expiresIn = $data['expires_in'] ?? 3600;
        $cache = [
            'token' => $data['access_token'],
            'expires' => time() + $expiresIn - 60, // 1 min safety margin
        ];
        @file_put_contents($tokenFile, json_encode($cache));

        return $data['access_token'];
    }

    // ==========================================
    // DAILY COUNTER (resets at midnight)
    // ==========================================

    /**
     * Get today's email count for Brevo
     */
    private static function getDailyCounter(): int
    {
        if (!file_exists(self::COUNTER_FILE)) {
            return 0;
        }

        $data = json_decode(file_get_contents(self::COUNTER_FILE), true);
        if (!$data || ($data['date'] ?? '') !== date('Y-m-d')) {
            return 0; // Different day = reset
        }

        return (int)($data['count'] ?? 0);
    }

    /**
     * Increment today's Brevo email counter
     */
    private static function incrementCounter(): void
    {
        $today = date('Y-m-d');
        $data = ['date' => $today, 'count' => 0];

        if (file_exists(self::COUNTER_FILE)) {
            $existing = json_decode(file_get_contents(self::COUNTER_FILE), true);
            if ($existing && ($existing['date'] ?? '') === $today) {
                $data['count'] = (int)($existing['count'] ?? 0);
            }
        }

        $data['count']++;
        @file_put_contents(self::COUNTER_FILE, json_encode($data));
    }

    // ==========================================
    // EMAIL TEMPLATE
    // ==========================================

    /**
     * Get HTML email template
     */
    private static function getEmailTemplate(string $code): string
    {
        return <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
        .container { max-width: 500px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; }
        .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px; }
        .content { padding: 30px 25px; }
        .code-box { background: #f8f9fa; border: 2px dashed #667eea; border-radius: 12px; padding: 25px; text-align: center; margin: 25px 0; }
        .code { font-size: 42px; font-weight: bold; letter-spacing: 8px; color: #333; font-family: monospace; }
        .warning { background: #fff3cd; border-radius: 8px; padding: 15px; margin: 20px 0; }
        .warning p { margin: 0; color: #856404; font-size: 14px; }
        .footer { padding: 20px 25px; border-top: 1px solid #eee; }
        .footer p { color: #999; font-size: 12px; margin: 5px 0; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤧 Atchoum!</h1>
            <p>Votre application de suivi des pollens</p>
        </div>
        
        <div class="content">
            <h2 style="color: #333; margin-top: 0;">Votre code de connexion</h2>
            <p style="color: #666;">Utilisez ce code pour vous connecter à votre compte :</p>
            
            <div class="code-box">
                <div class="code">{$code}</div>
            </div>
            
            <div class="warning">
                <p>⏱️ <strong>Ce code expire dans 15 minutes</strong><br>
                🔒 Ne le partagez avec personne</p>
            </div>
        </div>
        
        <div class="footer">
            <p>Vous n'avez pas demandé ce code ? Ignorez cet email.</p>
            <p>© 2026 Atchoum! - Application open source<br>Données fournies par Atmo Data</p>
        </div>
    </div>
</body>
</html>
HTML;
    }
}
