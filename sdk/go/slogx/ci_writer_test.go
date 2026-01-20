package slogx

import (
	"encoding/json"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestCIWriter_WriteAndFlush(t *testing.T) {
	// Setup temp directory
	tmpDir, err := ioutil.TempDir("", "slogx_go_test")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	filePath := filepath.Join(tmpDir, "test.ndjson")
	writer := NewCIWriter(filePath, 100)
	defer writer.Close()

	// Write some entries
	entry1 := map[string]string{"msg": "test1"}
	entry2 := map[string]string{"msg": "test2"}

	writer.Write(entry1)
	writer.Write(entry2)
	writer.Flush()

	// Verify content
	content, err := ioutil.ReadFile(filePath)
	if err != nil {
		t.Fatal(err)
	}

	lines := strings.Split(strings.TrimSpace(string(content)), "\n")
	if len(lines) != 2 {
		t.Errorf("Expected 2 lines, got %d", len(lines))
	}

	var readEntry1 map[string]string
	if err := json.Unmarshal([]byte(lines[0]), &readEntry1); err != nil {
		t.Fatal(err)
	}
	if readEntry1["msg"] != "test1" {
		t.Errorf("Expected test1, got %s", readEntry1["msg"])
	}
}

func TestCIWriter_RollingWindow(t *testing.T) {
	tmpDir, err := ioutil.TempDir("", "slogx_go_rolling")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	filePath := filepath.Join(tmpDir, "rolling.ndjson")
	maxEntries := 5
	writer := NewCIWriter(filePath, maxEntries)
	defer writer.Close()

	// Write 10 entries
	for i := 0; i < 10; i++ {
		writer.Write(map[string]int{"idx": i})
	}
	writer.Flush()

	// Verify file only has last 5 entries
	content, err := ioutil.ReadFile(filePath)
	if err != nil {
		t.Fatal(err)
	}

	lines := strings.Split(strings.TrimSpace(string(content)), "\n")
	if len(lines) != maxEntries {
		t.Errorf("Expected %d lines, got %d", maxEntries, len(lines))
	}

	// First line should be index 5 (since 0-9 were written, last 5 are 5,6,7,8,9)
	var firstEntry map[string]int
	if err := json.Unmarshal([]byte(lines[0]), &firstEntry); err != nil {
		t.Fatal(err)
	}
	if firstEntry["idx"] != 5 {
		t.Errorf("Expected first entry to be 5, got %d", firstEntry["idx"])
	}
}

func TestCIWriter_EnsureDirectoryExists(t *testing.T) {
	tmpDir, err := ioutil.TempDir("", "slogx_go_nested")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	nestedPath := filepath.Join(tmpDir, "level1", "level2", "nested.ndjson")
	writer := NewCIWriter(nestedPath, 100)
	defer writer.Close()

	writer.Write(map[string]string{"msg": "created"})
	writer.Flush()

	if _, err := os.Stat(nestedPath); os.IsNotExist(err) {
		t.Error("File path was not created")
	}
}

func TestCIWriter_AutoFlush(t *testing.T) {
	tmpDir, err := ioutil.TempDir("", "slogx_go_autoflush")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	filePath := filepath.Join(tmpDir, "autoflush.ndjson")
	// Small max entries to trigger forced flush
	writer := NewCIWriter(filePath, 2)
	defer writer.Close()

	// Writing > 1.5 * maxEntries (1.5 * 2 = 3) should trigger flush
	writer.Write(map[string]int{"i": 1})
	writer.Write(map[string]int{"i": 2})
	writer.Write(map[string]int{"i": 3})
	writer.Write(map[string]int{"i": 4}) 

	// Give it a tiny moment if async, though in go implementation it's synchronous check after write buffer lock
	// But flush happens in same goroutine? No, check implementation:
	// shouldFlush := len(w.buffer) > int(float64(w.maxEntries)*1.5) ... if shouldFlush { w.Flush() }
	// So it is synchronous to the Write call.

	content, err := ioutil.ReadFile(filePath)
	if err != nil {
		t.Fatal(err)
	}
	
	// Should have flushed at least some. 
	if len(content) == 0 {
		t.Error("Auto flush did not happen")
	}
}

func TestCIWriter_TimerFlush(t *testing.T) {
	tmpDir, err := ioutil.TempDir("", "slogx_go_timer")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	filePath := filepath.Join(tmpDir, "timer.ndjson")
	writer := NewCIWriter(filePath, 100)
	
	writer.Write(map[string]string{"msg": "waiting"})
	
	// Don't call Flush manually. Wait for ticker (500ms in implementation)
	time.Sleep(1 * time.Second)
	
	content, err := ioutil.ReadFile(filePath)
	if err != nil {
		t.Fatal(err)
	}

	if len(content) == 0 {
		t.Error("Timer flush did not happen")
	}
	
	writer.Close()
}
