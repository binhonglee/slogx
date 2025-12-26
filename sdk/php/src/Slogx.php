<?php

namespace Slogx;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;
use React\EventLoop\Loop;

enum LogLevel: string
{
    case DEBUG = 'DEBUG';
    case INFO = 'INFO';
    case WARN = 'WARN';
    case ERROR = 'ERROR';
}

class SlogxServer implements MessageComponentInterface
{
    protected $clients;

    public function __construct()
    {
        $this->clients = new \SplObjectStorage();
    }

    public function onOpen(ConnectionInterface $conn): void
    {
        $this->clients->attach($conn);
    }

    public function onMessage(ConnectionInterface $from, $msg): void
    {
        // We don't expect messages from clients, but handle gracefully
    }

    public function onClose(ConnectionInterface $conn): void
    {
        $this->clients->detach($conn);
    }

    public function onError(ConnectionInterface $conn, \Exception $e): void
    {
        $this->clients->detach($conn);
        $conn->close();
    }

    public function broadcast(string $message): void
    {
        foreach ($this->clients as $client) {
            $client->send($message);
        }
    }

    public function hasClients(): bool
    {
        return count($this->clients) > 0;
    }
}

class Slogx
{
    private static ?Slogx $instance = null;
    private ?SlogxServer $wsServer = null;
    private string $serviceName = 'php-service';
    private bool $initialized = false;

    private function __construct()
    {
    }

    public static function getInstance(): Slogx
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Initialize the SlogX server (instance method).
     * Starts a WebSocket server on the specified port (default 8080).
     *
     * @param array $config Configuration array with keys:
     *                      - isDev: bool (required) Must be true to enable slogx
     *                      - port: int (optional) WebSocket server port (default 8080)
     *                      - serviceName: string (optional) Service name for log metadata
     * @return void
     */
    private function initInstance(array $config): void
    {
        if (!isset($config['isDev']) || !$config['isDev']) {
            // Silently skip initialization in production
            return;
        }

        $port = $config['port'] ?? 8080;
        $this->serviceName = $config['serviceName'] ?? 'php-service';

        $this->wsServer = new SlogxServer();
        $server = IoServer::factory(
            new HttpServer(
                new WsServer($this->wsServer)
            ),
            $port
        );

        $this->initialized = true;

        // Try to run server in background if pcntl extension is available
        if (function_exists('pcntl_fork')) {
            $pid = pcntl_fork();
            if ($pid === -1) {
                echo "[slogx] Warning: Failed to fork process. Logging will be disabled.\n";
                $this->initialized = false;
                return;
            } elseif ($pid === 0) {
                // Child process - run the WebSocket server
                echo "[slogx] 🚀 Log server running at ws://localhost:{$port}\n";
                $server->run();
                exit(0);
            }
            // Parent process continues
            // Give child process time to start
            usleep(100000); // 100ms
        } else {
            echo "[slogx] 🚀 Log server starting at ws://localhost:{$port}\n";
            echo "[slogx] Note: pcntl extension not available. Server running in foreground.\n";
            echo "[slogx] For background mode, install pcntl extension or run server separately.\n";
            // Server will block - this is only for demo purposes
            // In production use, pcntl should be available, or run server separately
            $server->run();
        }
    }

    /**
     * Generate a random ID for log entries
     */
    private function generateId(): string
    {
        $chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        $id = '';
        for ($i = 0; $i < 13; $i++) {
            $id .= $chars[random_int(0, strlen($chars) - 1)];
        }
        return $id;
    }

    /**
     * Get caller information from the stack trace
     */
    private function getCallerInfo(): array
    {
        $trace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS);

        // Skip internal frames (this file's methods)
        $thisFile = __FILE__;
        $caller = null;
        $stackFrames = [];

        foreach ($trace as $frame) {
            if (!isset($frame['file']) || $frame['file'] === $thisFile) {
                continue;
            }

            if ($caller === null) {
                $caller = $frame;
            }

            $stackFrames[] = $frame;
        }

        if ($caller === null) {
            return [
                'file' => null,
                'line' => null,
                'func' => null,
                'clean_stack' => null
            ];
        }

        // Build clean stack trace
        $cleanStack = '';
        foreach ($stackFrames as $frame) {
            $file = $frame['file'] ?? 'unknown';
            $line = $frame['line'] ?? 0;
            $func = $frame['function'] ?? 'anonymous';
            if (isset($frame['class'])) {
                $func = $frame['class'] . $frame['type'] . $func;
            }
            $cleanStack .= "at {$func} ({$file}:{$line})\n";
        }

        return [
            'file' => basename($caller['file']),
            'line' => $caller['line'] ?? null,
            'func' => $caller['function'] ?? 'anonymous',
            'clean_stack' => $cleanStack
        ];
    }

    /**
     * Core logging function
     */
    private function log(LogLevel $level, mixed ...$args): void
    {
        if (!$this->initialized || $this->wsServer === null || !$this->wsServer->hasClients()) {
            return;
        }

        $caller = $this->getCallerInfo();
        $processedArgs = [];
        $finalStack = $caller['clean_stack'];

        foreach ($args as $arg) {
            if ($arg instanceof \Throwable) {
                $finalStack = $arg->getTraceAsString();
                $processedArgs[] = [
                    'name' => get_class($arg),
                    'message' => $arg->getMessage(),
                    'stack' => $finalStack,
                    'code' => $arg->getCode()
                ];
            } else {
                $processedArgs[] = $this->serialize($arg);
            }
        }

        $entry = [
            'id' => $this->generateId(),
            'timestamp' => gmdate('Y-m-d\TH:i:s.u\Z'),
            'level' => $level->value,
            'args' => $processedArgs,
            'stacktrace' => $finalStack,
            'metadata' => [
                'file' => $caller['file'],
                'line' => $caller['line'],
                'func' => $caller['func'],
                'lang' => 'php',
                'service' => $this->serviceName
            ]
        ];

        $payload = json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($payload === false) {
            return;
        }

        $this->wsServer->broadcast($payload);
    }

    /**
     * Serialize values for JSON output
     */
    private function serialize(mixed $value): mixed
    {
        if (is_resource($value)) {
            return sprintf('[resource: %s]', get_resource_type($value));
        }

        if (is_object($value)) {
            if (method_exists($value, '__toString')) {
                return (string) $value;
            }
            return get_object_vars($value);
        }

        return $value;
    }

    // Instance logging methods (internal use)

    private function debugInstance(mixed ...$args): void
    {
        $this->log(LogLevel::DEBUG, ...$args);
    }

    private function infoInstance(mixed ...$args): void
    {
        $this->log(LogLevel::INFO, ...$args);
    }

    private function warnInstance(mixed ...$args): void
    {
        $this->log(LogLevel::WARN, ...$args);
    }

    private function errorInstance(mixed ...$args): void
    {
        $this->log(LogLevel::ERROR, ...$args);
    }

    // Static convenience methods (public API)

    /**
     * Initialize the SlogX server.
     * Starts a WebSocket server on the specified port (default 8080).
     *
     * @param array $config Configuration array with keys:
     *                      - isDev: bool (required) Must be true to enable slogx
     *                      - port: int (optional) WebSocket server port (default 8080)
     *                      - serviceName: string (optional) Service name for log metadata
     * @return void
     */
    public static function init(array $config): void
    {
        self::getInstance()->initInstance($config);
    }

    public static function debug(mixed ...$args): void
    {
        self::getInstance()->debugInstance(...$args);
    }

    public static function info(mixed ...$args): void
    {
        self::getInstance()->infoInstance(...$args);
    }

    public static function warn(mixed ...$args): void
    {
        self::getInstance()->warnInstance(...$args);
    }

    public static function error(mixed ...$args): void
    {
        self::getInstance()->errorInstance(...$args);
    }
}

// Create lowercase alias to match other SDKs (slogx.info() in Python/TypeScript)
if (!class_exists('Slogx\\slogx', false)) {
    class_alias(Slogx::class, 'Slogx\\slogx');
}
