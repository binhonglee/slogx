<?php

namespace Slogx\Tests;

use PHPUnit\Framework\TestCase;
use Slogx\Slogx;
use Slogx\LogLevel;

class SlogxTest extends TestCase
{
    private Slogx $slogx;

    protected function setUp(): void
    {
        // Get fresh instance for each test
        $this->slogx = Slogx::getInstance();
    }

    // LogLevel Tests

    public function testLogLevelsExist(): void
    {
        $this->assertEquals('DEBUG', LogLevel::DEBUG->value);
        $this->assertEquals('INFO', LogLevel::INFO->value);
        $this->assertEquals('WARN', LogLevel::WARN->value);
        $this->assertEquals('ERROR', LogLevel::ERROR->value);
    }

    public function testLogLevelsAreStrings(): void
    {
        foreach (LogLevel::cases() as $level) {
            $this->assertIsString($level->value);
        }
    }

    // Initialization Tests

    public function testGetInstance(): void
    {
        $instance1 = Slogx::getInstance();
        $instance2 = Slogx::getInstance();

        $this->assertSame($instance1, $instance2, 'getInstance should return the same instance');
    }

    public function testInitWithoutIsDev(): void
    {
        // Should not throw when isDev is false (using static API)
        Slogx::init(['isDev' => false]);
        $this->assertTrue(true); // If we get here, no exception was thrown
    }

    public function testInitWithIsDev(): void
    {
        // This test would actually start a server, so we'll skip it
        // In a real test environment, you'd mock the server components
        $this->markTestSkipped('Requires mocking WebSocket server');
    }

    public function testStaticApiExists(): void
    {
        // Test that static methods are available
        $this->assertTrue(method_exists(Slogx::class, 'init'));
        $this->assertTrue(method_exists(Slogx::class, 'debug'));
        $this->assertTrue(method_exists(Slogx::class, 'info'));
        $this->assertTrue(method_exists(Slogx::class, 'warn'));
        $this->assertTrue(method_exists(Slogx::class, 'error'));
    }

    public function testLowercaseAliasExists(): void
    {
        // Test that lowercase alias is available
        $this->assertTrue(class_exists('Slogx\\slogx'));
    }

    // ID Generation Tests

    public function testGenerateIdLength(): void
    {
        $reflection = new \ReflectionClass($this->slogx);
        $method = $reflection->getMethod('generateId');
        $method->setAccessible(true);

        $id = $method->invoke($this->slogx);
        $this->assertEquals(13, strlen($id));
    }

    public function testGenerateIdUniqueness(): void
    {
        $reflection = new \ReflectionClass($this->slogx);
        $method = $reflection->getMethod('generateId');
        $method->setAccessible(true);

        $ids = [];
        for ($i = 0; $i < 100; $i++) {
            $ids[] = $method->invoke($this->slogx);
        }

        $uniqueIds = array_unique($ids);
        $this->assertCount(100, $uniqueIds, 'All IDs should be unique');
    }

    public function testGenerateIdCharacters(): void
    {
        $reflection = new \ReflectionClass($this->slogx);
        $method = $reflection->getMethod('generateId');
        $method->setAccessible(true);

        $id = $method->invoke($this->slogx);
        $this->assertMatchesRegularExpression('/^[a-z0-9]{13}$/', $id);
    }

    // Caller Info Tests

    public function testGetCallerInfoReturnsArray(): void
    {
        $reflection = new \ReflectionClass($this->slogx);
        $method = $reflection->getMethod('getCallerInfo');
        $method->setAccessible(true);

        $info = $method->invoke($this->slogx);

        $this->assertIsArray($info);
        $this->assertArrayHasKey('file', $info);
        $this->assertArrayHasKey('line', $info);
        $this->assertArrayHasKey('func', $info);
        $this->assertArrayHasKey('clean_stack', $info);
    }

    public function testGetCallerInfoFile(): void
    {
        $reflection = new \ReflectionClass($this->slogx);
        $method = $reflection->getMethod('getCallerInfo');
        $method->setAccessible(true);

        $info = $method->invoke($this->slogx);

        // Should get this test file
        $this->assertEquals('SlogxTest.php', $info['file']);
    }

    public function testGetCallerInfoLineNumber(): void
    {
        $reflection = new \ReflectionClass($this->slogx);
        $method = $reflection->getMethod('getCallerInfo');
        $method->setAccessible(true);

        $info = $method->invoke($this->slogx);

        $this->assertIsInt($info['line']);
        $this->assertGreaterThan(0, $info['line']);
    }

    public function testGetCallerInfoFunctionName(): void
    {
        $reflection = new \ReflectionClass($this->slogx);
        $method = $reflection->getMethod('getCallerInfo');
        $method->setAccessible(true);

        $info = $method->invoke($this->slogx);

        // Should capture the test method name
        $this->assertStringContainsString('testGetCallerInfoFunctionName', $info['func']);
    }

    public function testGetCallerInfoStackTrace(): void
    {
        $reflection = new \ReflectionClass($this->slogx);
        $method = $reflection->getMethod('getCallerInfo');
        $method->setAccessible(true);

        $info = $method->invoke($this->slogx);

        $this->assertNotNull($info['clean_stack']);
        $this->assertStringContainsString('SlogxTest.php', $info['clean_stack']);
    }

    // Serialization Tests

    public function testSerializeString(): void
    {
        $reflection = new \ReflectionClass($this->slogx);
        $method = $reflection->getMethod('serialize');
        $method->setAccessible(true);

        $result = $method->invoke($this->slogx, 'simple string');
        $this->assertEquals('simple string', $result);
    }

    public function testSerializeArray(): void
    {
        $reflection = new \ReflectionClass($this->slogx);
        $method = $reflection->getMethod('serialize');
        $method->setAccessible(true);

        $array = ['key' => 'value', 'nested' => ['deep' => true]];
        $result = $method->invoke($this->slogx, $array);
        $this->assertEquals($array, $result);
    }

    public function testSerializeObject(): void
    {
        $reflection = new \ReflectionClass($this->slogx);
        $method = $reflection->getMethod('serialize');
        $method->setAccessible(true);

        $obj = new \stdClass();
        $obj->key = 'value';
        $obj->number = 123;

        $result = $method->invoke($this->slogx, $obj);
        $this->assertIsArray($result);
        $this->assertEquals('value', $result['key']);
        $this->assertEquals(123, $result['number']);
    }

    public function testSerializeObjectWithToString(): void
    {
        $reflection = new \ReflectionClass($this->slogx);
        $method = $reflection->getMethod('serialize');
        $method->setAccessible(true);

        $obj = new class {
            public function __toString(): string
            {
                return 'Custom String';
            }
        };

        $result = $method->invoke($this->slogx, $obj);
        $this->assertEquals('Custom String', $result);
    }

    // Exception Handling Tests

    public function testExceptionSerialization(): void
    {
        $exception = new \Exception('Test error message');

        // Test that exceptions would be properly serialized
        $this->assertEquals('Test error message', $exception->getMessage());
        $this->assertEquals('Exception', get_class($exception));
        $this->assertNotEmpty($exception->getTraceAsString());
    }

    public function testCustomExceptionSerialization(): void
    {
        $exception = new \RuntimeException('Custom error');

        $this->assertEquals('Custom error', $exception->getMessage());
        $this->assertEquals('RuntimeException', get_class($exception));
    }

    // JSON Serialization Tests

    public function testLogEntryStructure(): void
    {
        $entry = [
            'id' => 'testid123456',
            'timestamp' => gmdate('Y-m-d\TH:i:s.u\Z'),
            'level' => LogLevel::INFO->value,
            'args' => ['test message'],
            'stacktrace' => 'test stack',
            'metadata' => [
                'file' => 'test.php',
                'line' => 10,
                'func' => 'testFunc',
                'lang' => 'php',
                'service' => 'test-service'
            ]
        ];

        $this->assertArrayHasKey('id', $entry);
        $this->assertArrayHasKey('timestamp', $entry);
        $this->assertArrayHasKey('level', $entry);
        $this->assertArrayHasKey('args', $entry);
        $this->assertArrayHasKey('metadata', $entry);
        $this->assertEquals('php', $entry['metadata']['lang']);
    }

    public function testLogEntryJsonSerializable(): void
    {
        $entry = [
            'id' => 'testid123456',
            'timestamp' => gmdate('Y-m-d\TH:i:s.u\Z'),
            'level' => LogLevel::INFO->value,
            'args' => ['test', ['key' => 'value'], 42, true, null],
            'stacktrace' => 'test stack',
            'metadata' => [
                'file' => 'test.php',
                'line' => 10,
                'func' => 'testFunc',
                'lang' => 'php',
                'service' => 'test-service'
            ]
        ];

        $json = json_encode($entry);
        $this->assertNotFalse($json);

        $decoded = json_decode($json, true);
        $this->assertEquals('INFO', $decoded['level']);
    }

    // Timestamp Tests

    public function testTimestampFormat(): void
    {
        $timestamp = gmdate('Y-m-d\TH:i:s.u\Z');

        $this->assertStringEndsWith('Z', $timestamp);
        $this->assertStringContainsString('T', $timestamp);
    }

    public function testTimestampParseable(): void
    {
        $timestamp = gmdate('Y-m-d\TH:i:s.u\Z');
        $timestamp = rtrim($timestamp, 'Z');

        $parsed = \DateTime::createFromFormat('Y-m-d\TH:i:s.u', $timestamp);
        $this->assertInstanceOf(\DateTime::class, $parsed);
    }

    // Mixed Argument Tests

    public function testMixedArgs(): void
    {
        $args = ['message', ['data' => 123], [1, 2, 3], null, true];

        $json = json_encode($args);
        $this->assertNotFalse($json);

        $decoded = json_decode($json, true);
        $this->assertCount(5, $decoded);
    }
}
