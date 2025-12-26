# slogx PHP SDK

Real-time log streaming SDK for PHP. Stream structured logs from your PHP backend to a web UI over WebSockets.

## Installation

```bash
composer require binhonglee/slogx
```

## Quick Start

```php
<?php

require_once 'vendor/autoload.php';

use Slogx\slogx;

slogx::init([
    'isDev' => $_ENV['APP_ENV'] !== 'production',
    'port' => 8080,
    'serviceName' => 'my-php-service'
]);

// Log messages
slogx::info('Server started', ['port' => 8080]);
slogx::debug('Cache hit', ['key' => 'user:123']);
slogx::warn('High memory usage', ['percent' => 85]);

// Log exceptions
try {
    throw new \Exception('Database error');
} catch (\Exception $e) {
    slogx::error('Operation failed', $e);
}
```

## Requirements

- PHP 8.0 or higher
- `ext-pcntl` extension (recommended for background WebSocket server)
  - Without pcntl, server runs in foreground (blocking)
  - Most Linux/Unix systems have pcntl available
  - Not available on Windows by default

## Features

- **WebSocket streaming**: Low-latency real-time logs to browser UI
- **Structured logging**: Captures arguments, stack traces, source metadata
- **Development-only**: `isDev` flag prevents accidental production use
- **Simple API**: `init()` + `debug()`, `info()`, `warn()`, `error()`

## Usage

### Initialize

```php
slogx::init([
    'isDev' => true,      // Required - must be true to enable
    'port' => 8080,       // Optional - default 8080
    'serviceName' => 'my-service'  // Optional - default 'php-service'
]);
```

### Logging

```php
// Simple messages
slogx::info('User logged in');

// With data
slogx::info('Request received', [
    'method' => 'POST',
    'path' => '/api/users',
    'ip' => '192.168.1.1'
]);

// Multiple arguments
slogx::debug('Processing', $user, $request, $options);

// Exceptions
try {
    // ...
} catch (\Exception $e) {
    slogx::error('Failed to process', $e);
}
```

## Running the Demo

```bash
cd sdk/php
composer install
php server.php
```

Then open the slogx UI and connect to `ws://localhost:8082`.

## Testing

```bash
composer install
vendor/bin/phpunit
```

## License

MIT
