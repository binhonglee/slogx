<?php

require_once __DIR__ . '/vendor/autoload.php';

use Slogx\slogx;

slogx::init([
    'isDev' => true,
    'port' => 8082,
    'serviceName' => 'payment-service'
]);

echo "Simulating backend traffic...\n";

$users = [
    ['id' => 1, 'name' => 'Alice', 'role' => 'admin'],
    ['id' => 2, 'name' => 'Bob', 'role' => 'editor'],
    ['id' => 3, 'name' => 'Charlie', 'role' => 'viewer']
];

$endpoints = ['/api/login', '/api/dashboard', '/api/settings', '/api/data'];

$requestCount = 0;

while (true) {
    $requestCount++;
    $user = $users[array_rand($users)];
    $endpoint = $endpoints[array_rand($endpoints)];
    $rand = mt_rand() / mt_getrandmax();

    // Single message only
    if ($rand < 0.25) {
        slogx::info("Request completed: {$endpoint}");
    }

    // Single object only
    elseif ($rand < 0.35) {
        slogx::debug(['event' => 'cache_hit', 'key' => "user:{$user['id']}", 'ttl' => 3600]);
    }

    // Message + object (classic pattern)
    elseif ($rand < 0.6) {
        slogx::info("Incoming request: {$endpoint}", [
            'method' => 'GET',
            'ip' => '192.168.1.42',
            'request_id' => "req_{$requestCount}"
        ]);
    }

    // Multiple arguments
    elseif ($rand < 0.7) {
        slogx::debug('User context loaded', $user, [
            'session' => ['valid' => true, 'expires' => '2024-12-31T23:59:59Z']
        ]);
    }

    // Warning with single message
    elseif ($rand < 0.8) {
        slogx::warn('Memory usage above 80%');
    }

    // Warning with details
    elseif ($rand < 0.88) {
        slogx::warn('Query took longer than expected', [
            'duration_ms' => 450,
            'threshold_ms' => 200
        ]);
    }

    // Edge case: deeply nested object
    elseif ($rand < 0.92) {
        slogx::debug('Deep config loaded', [
            'level1' => ['level2' => ['level3' => ['level4' => ['level5' => ['value' => 'deep!']]]]]
        ]);
    }

    // Edge case: array with mixed types
    elseif ($rand < 0.95) {
        slogx::info('Batch processed', [1, 'two', ['three' => 3], null, true]);
    }

    // Edge case: unicode & special characters
    elseif ($rand < 0.97) {
        slogx::debug('Unicode test: 你好世界 🐘 émojis', [
            'special' => "<script>alert('xss')</script>",
            'quotes' => 'He said "hello"',
            'newlines' => "line1\nline2\ttabbed"
        ]);
    }

    // Error with stack trace
    elseif ($rand < 0.99) {
        try {
            throw new \Exception('Database connection lost');
        } catch (\Exception $e) {
            slogx::error('Critical failure', $e);
        }
    }

    // Edge case: empty/null values
    else {
        slogx::warn('Edge case test', [
            'empty' => (object)[],
            'emptyArr' => [],
            'nullVal' => null,
            'zero' => 0,
            'emptyStr' => ''
        ]);
    }

    sleep(2);
}
