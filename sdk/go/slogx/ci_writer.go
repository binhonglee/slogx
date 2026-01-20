package slogx

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// CIWriter handles writing log entries to a file in NDJSON format.
// Implements a rolling window to prevent unbounded file growth.
type CIWriter struct {
	filePath    string
	maxEntries  int
	buffer      []string
	bufferMu    sync.Mutex
	entryCount  int
	closed      bool
	flushTicker *time.Ticker
	done        chan bool
}

// NewCIWriter creates a new CIWriter instance.
func NewCIWriter(filePath string, maxEntries int) *CIWriter {
	if maxEntries <= 0 {
		maxEntries = 10000
	}

	// Ensure directory exists
	dir := filepath.Dir(filePath)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		os.MkdirAll(dir, 0755)
	}

	// Clear existing file (fresh run)
	ioutil.WriteFile(filePath, []byte(""), 0644)

	w := &CIWriter{
		filePath:    filePath,
		maxEntries:  maxEntries,
		buffer:      make([]string, 0),
		flushTicker: time.NewTicker(500 * time.Millisecond),
		done:        make(chan bool),
	}

	go w.flushLoop()

	return w
}

func (w *CIWriter) flushLoop() {
	for {
		select {
		case <-w.flushTicker.C:
			w.Flush()
		case <-w.done:
			w.flushTicker.Stop()
			return
		}
	}
}

// Write adds a log entry to the buffer.
func (w *CIWriter) Write(entry interface{}) {
	w.bufferMu.Lock()
	if w.closed {
		w.bufferMu.Unlock()
		return
	}

	bytes, err := json.Marshal(entry)
	if err == nil {
		w.buffer = append(w.buffer, string(bytes))
		w.entryCount++
	}
	
	shouldFlush := len(w.buffer) > int(float64(w.maxEntries)*1.5)
	w.bufferMu.Unlock()

	if shouldFlush {
		w.Flush()
	}
}

// Flush writes buffered entries to the file.
func (w *CIWriter) Flush() {
	w.bufferMu.Lock()
	if len(w.buffer) == 0 {
		w.bufferMu.Unlock()
		return
	}

	content := strings.Join(w.buffer, "\n") + "\n"
	w.buffer = make([]string, 0)
	w.bufferMu.Unlock()

	f, err := os.OpenFile(w.filePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		fmt.Printf("[slogx] Failed to open log file: %v\n", err)
		return
	}
	defer f.Close()

	if _, err := f.WriteString(content); err != nil {
		fmt.Printf("[slogx] Failed to write to log file: %v\n", err)
	}

	w.enforceRollingWindow()
}

// enforceRollingWindow ensures the file doesn't exceed maxEntries.
func (w *CIWriter) enforceRollingWindow() {
	// Simple implementation: read all, trim, write back.
	// For huge files this might be slow, but maxEntries defaults to 10k so it's fine.
	content, err := ioutil.ReadFile(w.filePath)
	if err != nil {
		return
	}

	lines := strings.Split(strings.TrimSpace(string(content)), "\n")
	if len(lines) <= w.maxEntries {
		return
	}

	// Keep last maxEntries
	trimmed := lines[len(lines)-w.maxEntries:]
	newContent := strings.Join(trimmed, "\n") + "\n"

	ioutil.WriteFile(w.filePath, []byte(newContent), 0644)
}

// Close flushes and stops the writer.
func (w *CIWriter) Close() {
	w.bufferMu.Lock()
	if w.closed {
		w.bufferMu.Unlock()
		return
	}
	w.closed = true
	w.bufferMu.Unlock()

	w.done <- true
	w.Flush()
}
