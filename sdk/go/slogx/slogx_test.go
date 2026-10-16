package slogx

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestInit_FileAndStream(t *testing.T) {
	listener, err := net.Listen("tcp", ":0")
	if err != nil {
		t.Fatal(err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	listener.Close()

	logPath := filepath.Join(t.TempDir(), "both.ndjson")
	ciMode, stream := true, true
	Init(Config{
		IsDev:       true,
		Port:        port,
		ServiceName: "both-service",
		CIMode:      &ciMode,
		LogFilePath: logPath,
		Stream:      &stream,
	})
	s := getInstance()
	if s.ciWriter == nil {
		t.Fatal("expected file output to be enabled")
	}

	conn, _, err := websocket.DefaultDialer.Dial(fmt.Sprintf("ws://localhost:%d", port), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()

	deadline := time.Now().Add(5 * time.Second)
	for {
		s.clientsMu.RLock()
		n := len(s.clients)
		s.clientsMu.RUnlock()
		if n > 0 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("client never registered")
		}
		time.Sleep(10 * time.Millisecond)
	}

	Info("both")

	conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatal(err)
	}
	var streamed LogEntry
	if err := json.Unmarshal(msg, &streamed); err != nil {
		t.Fatal(err)
	}

	s.ciWriter.Flush()
	content, err := os.ReadFile(logPath)
	if err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(strings.TrimSpace(string(content)), "\n")
	var written LogEntry
	if err := json.Unmarshal([]byte(lines[len(lines)-1]), &written); err != nil {
		t.Fatal(err)
	}

	if streamed.ID != written.ID {
		t.Errorf("expected same entry in both outputs, got %s and %s", streamed.ID, written.ID)
	}
	if len(streamed.Args) != 1 || streamed.Args[0] != "both" {
		t.Errorf("unexpected args: %v", streamed.Args)
	}
}
