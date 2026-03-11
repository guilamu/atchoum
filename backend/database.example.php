<?php

/**
 * Database Configuration for Atchoum!
 * 
 * Copy this to /var/www/atchoum/config/database.php on the server
 * and fill in your MySQL credentials.
 */

return [
    'host' => 'localhost',
    'port' => 3306,
    'database' => 'atchoum',
    'username' => 'atchoum_user',      // Change this
    'password' => 'your_password',      // Change this
    'charset' => 'utf8mb4',

    // JWT Configuration
    'jwt_secret' => 'change_this_to_a_random_64_character_string_for_production',
    'jwt_expiry_days' => 30,

    // Brevo (Sendinblue) Email Configuration
    'brevo_api_key' => 'your_brevo_api_key_here',
    'email_from' => 'noreply@yourdomain.com',
    'email_from_name' => 'Atchoum!',

    // SendPulse Email Fallback (used after 290 Brevo emails/day or on Brevo error)
    'sendpulse_client_id' => 'your_sendpulse_client_id',
    'sendpulse_client_secret' => 'your_sendpulse_client_secret',

    // Rate Limiting (strict as requested)
    'rate_limit_request_code_per_hour' => 1,
    'rate_limit_verify_attempts_per_day' => 2,
];
