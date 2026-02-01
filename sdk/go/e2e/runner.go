package main

import (
	"flag"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/binhonglee/slogx/sdk/go/slogx"
)

func emit(prefix string) {
	slogx.Info(fmt.Sprintf("%s alpha", prefix), map[string]any{"fixture": 1})
	slogx.Warn(fmt.Sprintf("%s beta", prefix), map[string]any{"fixture": true})
	slogx.Error(fmt.Sprintf("%s gamma", prefix), fmt.Errorf("%s error", prefix))
	slogx.Debug(fmt.Sprintf("%s delta", prefix), map[string]any{"nested": map[string]any{"ok": true}})
}

func main() {
	mode := flag.String("mode", "ws", "ws|ci")
	port := flag.Int("port", 8093, "port")
	filePath := flag.String("file", "", "ndjson output path")
	service := flag.String("service", "go-e2e", "service name")
	interval := flag.Duration("interval", 200*time.Millisecond, "ws emit interval")
	flag.Parse()

	ciMode := *mode == "ci"

	slogx.Init(slogx.Config{
		IsDev:       true,
		Port:        *port,
		ServiceName: *service,
		CIMode:      &ciMode,
		LogFilePath: *filePath,
		MaxEntries:  1000,
	})

	prefix := fmt.Sprintf("SDK GO %s", strings.ToUpper(*mode))

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	if *mode == "ws" {
		fmt.Printf("[slogx-e2e] READY ws://localhost:%d\n", *port)
		ticker := time.NewTicker(*interval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				emit(prefix)
			case <-stop:
				return
			}
		}
	}

	emit(prefix)
	time.Sleep(650 * time.Millisecond)
	emit(prefix)
	time.Sleep(700 * time.Millisecond)
}
