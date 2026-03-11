<?php

/**
 * Atchoum! Backend Configuration Template
 * 
 * Copy this file to config.php and fill in your credentials
 */

return [
    // Atmo Data API credentials
    // Get credentials from: https://admindata.atmo-france.org/inscription-api
    'atmo_username' => 'YOUR_USERNAME',
    'atmo_password' => 'YOUR_PASSWORD',

    // Cache settings
    'cache_duration' => 12 * 3600, // 12 hours

    // Rate limiting (future use)
    'rate_limit_per_minute' => 60,
    'rate_limit_per_day' => 1000,
];
