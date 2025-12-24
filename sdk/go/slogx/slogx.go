package slogx

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net"
	"net/http"
	"path/filepath"
	"runtime"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type LogLevel string

const (
	DEBUG LogLevel = "DEBUG"
	INFO  LogLevel = "INFO"
	WARN  LogLevel = "WARN"
	ERROR LogLevel = "ERROR"
)

type Config struct {
	// IsDev is required. Must be true to enable slogx. Prevents accidental production use.
	IsDev       bool
	Port        int
	ServiceName string
}

type LogEntry struct {
	ID         string                 `json:"id"`
	Timestamp  string                 `json:"timestamp"`
	Level      LogLevel               `json:"level"`
	Args       []interface{}          `json:"args"`
	Stacktrace string                 `json:"stacktrace,omitempty"`
	Metadata   map[string]interface{} `json:"metadata"`
}

type SlogX struct {
	clients     map[*websocket.Conn]bool
	clientsMu   sync.RWMutex
	serviceName string
	upgrader    websocket.Upgrader
}

var instance *SlogX
var once sync.Once

func getInstance() *SlogX {
	once.Do(func() {
		instance = &SlogX{
			clients:     make(map[*websocket.Conn]bool),
			serviceName: "go-service",
			upgrader: websocket.Upgrader{
				CheckOrigin: func(r *http.Request) bool { return true },
			},
		}
	})
	return instance
}

func Init(config Config) {
	if !config.IsDev {
		// Silently skip initialization in production
		return
	}

	s := getInstance()

	if config.ServiceName != "" {
		s.serviceName = config.ServiceName
	}

	port := config.Port
	if port == 0 {
		port = 8080
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		conn, err := s.upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}

		s.clientsMu.Lock()
		s.clients[conn] = true
		s.clientsMu.Unlock()

		go func() {
			defer func() {
				s.clientsMu.Lock()
				delete(s.clients, conn)
				s.clientsMu.Unlock()
				conn.Close()
			}()
			for {
				if _, _, err := conn.ReadMessage(); err != nil {
					break
				}
			}
		}()
	})

	// Create listener first so we know the server is ready
	listener, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
	if err != nil {
		panic(fmt.Sprintf("[slogx] Failed to bind to port %d: %v", port, err))
	}

	fmt.Printf("[slogx] 🚀 Log server running at ws://localhost:%d\n", port)

	go func() {
		http.Serve(listener, mux)
	}()
}

func generateID() string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 13)
	for i := range b {
		b[i] = chars[rand.Intn(len(chars))]
	}
	return string(b)
}

func getCallerInfo() (file string, line int, funcName string, stack string) {
	pc := make([]uintptr, 10)
	n := runtime.Callers(5, pc)
	frames := runtime.CallersFrames(pc[:n])

	var stackLines string
	first := true
	for {
		frame, more := frames.Next()
		stackLines += fmt.Sprintf("at %s (%s:%d)\n", frame.Function, frame.File, frame.Line)
		if first {
			file = filepath.Base(frame.File)
			line = frame.Line
			funcName = filepath.Base(frame.Function)
			first = false
		}
		if !more {
			break
		}
	}
	return file, line, funcName, stackLines
}

func log(level LogLevel, args ...interface{}) {
	s := getInstance()

	s.clientsMu.RLock()
	if len(s.clients) == 0 {
		s.clientsMu.RUnlock()
		return
	}
	s.clientsMu.RUnlock()

	file, line, funcName, stack := getCallerInfo()

	processedArgs := make([]interface{}, len(args))
	finalStack := stack

	for i, arg := range args {
		if err, ok := arg.(error); ok {
			finalStack = fmt.Sprintf("%v\n%s", err, stack)
			processedArgs[i] = map[string]interface{}{
				"name":    "Error",
				"message": err.Error(),
				"stack":   finalStack,
			}
		} else {
			processedArgs[i] = Serialize(arg)
		}
	}

	entry := LogEntry{
		ID:         generateID(),
		Timestamp:  time.Now().UTC().Format(time.RFC3339Nano),
		Level:      level,
		Args:       processedArgs,
		Stacktrace: finalStack,
		Metadata: map[string]interface{}{
			"file":    file,
			"line":    line,
			"func":    funcName,
			"lang":    "go",
			"service": s.serviceName,
		},
	}

	payload, err := json.Marshal(entry)
	if err != nil {
		return
	}

	s.clientsMu.RLock()
	defer s.clientsMu.RUnlock()

	for conn := range s.clients {
		conn.WriteMessage(websocket.TextMessage, payload)
	}
}

func Debug(args ...interface{}) { log(DEBUG, args...) }
func Info(args ...interface{})  { log(INFO, args...) }
func Warn(args ...interface{})  { log(WARN, args...) }
func Error(args ...interface{}) { log(ERROR, args...) }
