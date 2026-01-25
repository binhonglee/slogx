import os
import json
import time
import shutil
import tempfile
import threading
from unittest.mock import patch
from slogx import CIWriter

def test_ci_writer_creates_directory():
    tmp_dir = tempfile.mkdtemp()
    try:
        log_path = os.path.join(tmp_dir, "nested", "dir", "test.ndjson")
        writer = CIWriter(log_path)
        writer.close()
        
        assert os.path.exists(log_path)
    finally:
        shutil.rmtree(tmp_dir)

def test_ci_writer_writes_and_flushes():
    tmp_fd, log_path = tempfile.mkstemp()
    os.close(tmp_fd)
    try:
        writer = CIWriter(log_path, max_entries=100)
        writer.write({"msg": "hello"})
        writer.write({"msg": "world"})
        writer.flush()
        
        with open(log_path, 'r') as f:
            lines = f.readlines()
            
        assert len(lines) == 2
        assert json.loads(lines[0])['msg'] == 'hello'
        assert json.loads(lines[1])['msg'] == 'world'
    finally:
        if os.path.exists(log_path):
            os.remove(log_path)

def test_rolling_window():
    tmp_fd, log_path = tempfile.mkstemp()
    os.close(tmp_fd)
    try:
        max_entries = 5
        writer = CIWriter(log_path, max_entries=max_entries)
        
        # Write 10 entries
        for i in range(10):
            writer.write({"i": i})
        
        writer.flush()
        
        with open(log_path, 'r') as f:
            lines = f.readlines()
            
        # Should contain ONLY the last 5 entries
        assert len(lines) == max_entries
        
        # Verify first remaining entry is index 5
        first = json.loads(lines[0])
        assert first['i'] == 5
        
        # Verify last is 9
        last = json.loads(lines[-1])
        assert last['i'] == 9
        
    finally:
        if os.path.exists(log_path):
            os.remove(log_path)

def test_auto_flush_on_overflow():
    tmp_fd, log_path = tempfile.mkstemp()
    os.close(tmp_fd)
    try:
        # max 2, so buffer trigger is > 3 (1.5 * 2 = 3)
        writer = CIWriter(log_path, max_entries=2)
        
        writer.write({"val": 1})
        writer.write({"val": 2})
        writer.write({"val": 3})
        writer.write({"val": 4}) 
        # Should trigger flush synchronously in _flush_unsafe call inside write
        
        with open(log_path, 'r') as f:
            content = f.read()
            
        assert len(content) > 0
        assert "val" in content
    finally:
        if os.path.exists(log_path):
            os.remove(log_path)
