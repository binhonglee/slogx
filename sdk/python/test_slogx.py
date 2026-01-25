"""Unit tests for the slogx Python SDK."""

import os
import pytest
import json
import tempfile
from datetime import datetime
from unittest.mock import MagicMock, patch
from slogx import SlogX, LogLevel, _detect_ci, CI_ENV_VARS


class TestLogLevel:
    """Tests for LogLevel enum."""

    def test_log_levels_exist(self):
        assert LogLevel.DEBUG.value == 'DEBUG'
        assert LogLevel.INFO.value == 'INFO'
        assert LogLevel.WARN.value == 'WARN'
        assert LogLevel.ERROR.value == 'ERROR'

    def test_log_levels_are_strings(self):
        for level in LogLevel:
            assert isinstance(level.value, str)


class TestSlogXInitialization:
    """Tests for SlogX initialization."""

    def test_default_initialization(self):
        s = SlogX()
        assert s._service_name == 'python-service'
        assert s._clients == set()
        assert s._server is None
        assert s._loop is None


class TestIDGeneration:
    """Tests for ID generation."""

    def test_generate_id_length(self):
        s = SlogX()
        id1 = s._generate_id()
        assert len(id1) == 13

    def test_generate_id_uniqueness(self):
        s = SlogX()
        ids = set()
        for _ in range(100):
            ids.add(s._generate_id())
        assert len(ids) == 100

    def test_generate_id_characters(self):
        s = SlogX()
        id1 = s._generate_id()
        valid_chars = set('abcdefghijklmnopqrstuvwxyz0123456789')
        assert all(c in valid_chars for c in id1)


class TestCallerInfo:
    """Tests for caller info extraction."""

    def test_get_caller_info_returns_dict(self):
        s = SlogX()
        info = s._get_caller_info()
        assert isinstance(info, dict)
        assert 'file' in info
        assert 'line' in info
        assert 'func' in info
        assert 'clean_stack' in info

    def test_get_caller_info_file(self):
        s = SlogX()
        info = s._get_caller_info()
        # Should get this test file
        assert info['file'] == 'test_slogx.py'

    def test_get_caller_info_line_number(self):
        s = SlogX()
        line_before = self._get_line_number()
        info = s._get_caller_info()
        # Line should be close to where we called it
        assert isinstance(info['line'], int)
        assert info['line'] > 0

    def _get_line_number(self):
        import inspect
        return inspect.currentframe().f_lineno

    def test_get_caller_info_function_name(self):
        s = SlogX()
        info = s._get_caller_info()
        assert info['func'] == 'test_get_caller_info_function_name'

    def test_get_caller_info_stack_trace(self):
        s = SlogX()
        info = s._get_caller_info()
        assert info['clean_stack'] is not None
        assert 'test_slogx.py' in info['clean_stack']


class TestExceptionHandling:
    """Tests for exception serialization."""

    def test_exception_serialization(self):
        s = SlogX()

        class MockClient:
            async def send(self, data):
                pass

        # Test the serialization logic directly
        try:
            raise ValueError("Test error")
        except ValueError as e:
            import traceback
            stack = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
            serialized = {
                'name': type(e).__name__,
                'message': str(e),
                'stack': stack
            }

            assert serialized['name'] == 'ValueError'
            assert serialized['message'] == 'Test error'
            assert 'ValueError: Test error' in serialized['stack']

    def test_custom_exception_serialization(self):
        class CustomError(Exception):
            pass

        try:
            raise CustomError("Custom message")
        except CustomError as e:
            import traceback
            stack = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
            serialized = {
                'name': type(e).__name__,
                'message': str(e),
                'stack': stack
            }

            assert serialized['name'] == 'CustomError'
            assert serialized['message'] == 'Custom message'


class TestLogEntryStructure:
    """Tests for log entry structure."""

    def test_log_entry_has_required_fields(self):
        s = SlogX()
        caller = s._get_caller_info()

        entry = {
            'id': s._generate_id(),
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': LogLevel.INFO.value,
            'args': ['test message'],
            'stacktrace': caller.get('clean_stack'),
            'metadata': {
                'file': caller.get('file'),
                'line': caller.get('line'),
                'func': caller.get('func'),
                'lang': 'python',
                'service': s._service_name
            }
        }

        assert 'id' in entry
        assert 'timestamp' in entry
        assert 'level' in entry
        assert 'args' in entry
        assert 'metadata' in entry
        assert entry['metadata']['lang'] == 'python'

    def test_log_entry_json_serializable(self):
        s = SlogX()
        caller = s._get_caller_info()

        entry = {
            'id': s._generate_id(),
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': LogLevel.INFO.value,
            'args': ['test', {'key': 'value'}, 42, True, None],
            'stacktrace': caller.get('clean_stack'),
            'metadata': {
                'file': caller.get('file'),
                'line': caller.get('line'),
                'func': caller.get('func'),
                'lang': 'python',
                'service': s._service_name
            }
        }

        # Should not raise
        json_str = json.dumps(entry)
        assert isinstance(json_str, str)

        # Should be valid JSON
        parsed = json.loads(json_str)
        assert parsed['level'] == 'INFO'


class TestTimestamp:
    """Tests for timestamp generation."""

    def test_timestamp_format(self):
        timestamp = datetime.utcnow().isoformat() + 'Z'
        # Should be ISO format with Z suffix
        assert timestamp.endswith('Z')
        assert 'T' in timestamp

    def test_timestamp_parseable(self):
        timestamp = datetime.utcnow().isoformat() + 'Z'
        # Remove Z for parsing
        parsed = datetime.fromisoformat(timestamp.rstrip('Z'))
        assert isinstance(parsed, datetime)


class TestArgumentProcessing:
    """Tests for argument processing in logs."""

    def test_string_args(self):
        args = ['simple string']
        processed = [arg for arg in args]
        assert processed == ['simple string']

    def test_dict_args(self):
        args = [{'key': 'value', 'nested': {'deep': True}}]
        json_str = json.dumps(args[0])
        assert 'key' in json_str
        assert 'nested' in json_str

    def test_mixed_args(self):
        args = ['message', {'data': 123}, [1, 2, 3], None, True]
        json_str = json.dumps(args, default=str)
        parsed = json.loads(json_str)
        assert len(parsed) == 5

    def test_non_serializable_with_default_str(self):
        class CustomClass:
            def __str__(self):
                return 'CustomClass instance'

        args = [CustomClass()]
        json_str = json.dumps(args, default=str)
        assert 'CustomClass instance' in json_str


class TestCIMode:
    def test_detect_ci_env_var(self, monkeypatch):
        # Clear all CI env vars first (we might be running in CI)
        for var in CI_ENV_VARS:
            monkeypatch.delenv(var, raising=False)
        assert _detect_ci() is False

        monkeypatch.setenv('CI', 'true')
        assert _detect_ci() is True

        monkeypatch.delenv('CI', raising=False)
        assert _detect_ci() is False

    def test_init_ci_mode_forced(self):
        s = SlogX()
        with tempfile.TemporaryDirectory() as tmp_dir:
            log_path = os.path.join(tmp_dir, 'logs', 'test.ndjson')
            s.init(
                is_dev=True,
                service_name='ci-service',
                ci_mode=True,
                log_file_path=log_path,
                max_entries=10
            )

            assert s._ci_writer is not None
            assert s._loop is None

            s.info('hello', {'ok': True})
            s._ci_writer.flush()

            with open(log_path, 'r') as f:
                lines = [line for line in f if line.strip()]

            assert len(lines) >= 1
            entry = json.loads(lines[-1])
            assert entry['metadata']['service'] == 'ci-service'
            assert entry['metadata']['lang'] == 'python'

        s.close()

    def test_init_ci_mode_auto_detect(self, monkeypatch):
        s = SlogX()
        with tempfile.TemporaryDirectory() as tmp_dir:
            log_path = os.path.join(tmp_dir, 'logs', 'auto.ndjson')
            monkeypatch.setenv('CI', 'true')
            s.init(
                is_dev=True,
                service_name='auto-ci',
                ci_mode=None,
                log_file_path=log_path
            )

            assert s._ci_writer is not None
            s.info('auto')
            s._ci_writer.flush()
            assert os.path.exists(log_path)

        s.close()


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
