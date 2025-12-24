package main

import (
	"errors"
	"fmt"
	"math/rand"
	"time"

	"github.com/binhonglee/slogx"
)

type User struct {
	ID       int
	Name     string
	Role     string
	email    string // unexported - still visible in logs!
	apiToken string // unexported - still visible in logs!
}

type Session struct {
	Valid       bool
	Expires     string
	Permissions []string
	tokenHash   string
	loginIP     string
}

var users = []*User{
	{ID: 1, Name: "Alice", Role: "admin", email: "alice@example.com", apiToken: "tok_abc123"},
	{ID: 2, Name: "Bob", Role: "editor", email: "bob@example.com", apiToken: "tok_def456"},
	{ID: 3, Name: "Charlie", Role: "viewer", email: "charlie@example.com", apiToken: "tok_ghi789"},
}

var endpoints = []string{"/api/login", "/api/dashboard", "/api/settings", "/api/data"}

func main() {
	slogx.Init(slogx.Config{
		IsDev:       true,
		Port:        8082,
		ServiceName: "gateway-service",
	})

	fmt.Println("Simulating backend traffic...")

	requestCount := 0

	for {
		requestCount++
		user := users[rand.Intn(len(users))]
		endpoint := endpoints[rand.Intn(len(endpoints))]
		r := rand.Float64()

		// Single message only
		if r < 0.25 {
			slogx.Info(fmt.Sprintf("Request completed: %s", endpoint))

			// Single object only
		} else if r < 0.35 {
			slogx.Debug(map[string]interface{}{
				"event": "cache_hit",
				"key":   fmt.Sprintf("user:%d", user.ID),
				"ttl":   3600,
			})

			// Message + object (classic pattern)
		} else if r < 0.6 {
			slogx.Info(fmt.Sprintf("Incoming request: %s", endpoint), map[string]interface{}{
				"method":     "GET",
				"ip":         "192.168.1.42",
				"request_id": fmt.Sprintf("req_%d", requestCount),
			})

			// Multiple arguments with unexported fields
		} else if r < 0.7 {
			session := &Session{
				Valid:     true,
				Expires:   "2024-12-31T23:59:59Z",
				tokenHash: "sha256:a1b2c3d4e5f6",
				loginIP:   "192.168.1.42",
			}
			slogx.Debug("User context loaded", user, session)

			// Warning with single message
		} else if r < 0.8 {
			slogx.Warn("Memory usage above 80%")

			// Warning with details
		} else if r < 0.88 {
			slogx.Warn("Query took longer than expected", map[string]interface{}{
				"duration_ms":  450,
				"threshold_ms": 200,
			})

			// Edge case: deeply nested object
		} else if r < 0.92 {
			slogx.Debug("Deep config loaded", map[string]interface{}{
				"level1": map[string]interface{}{
					"level2": map[string]interface{}{
						"level3": map[string]interface{}{
							"level4": map[string]interface{}{
								"level5": map[string]interface{}{"value": "deep!"},
							},
						},
					},
				},
			})

			// Edge case: slice with mixed types
		} else if r < 0.95 {
			slogx.Info("Batch processed", []interface{}{1, "two", map[string]int{"three": 3}, nil, true})

			// Edge case: unicode & special characters
		} else if r < 0.97 {
			slogx.Debug("Unicode test: 你好世界 🦫 émojis", map[string]interface{}{
				"special":  "<script>alert('xss')</script>",
				"quotes":   `He said "hello"`,
				"newlines": "line1\nline2\ttabbed",
			})

			// Error with stack trace
		} else if r < 0.99 {
			err := errors.New("Database connection lost")
			slogx.Error("Critical failure", err)

			// Edge case: empty/nil values
		} else {
			slogx.Warn("Edge case test", map[string]interface{}{
				"empty":    map[string]interface{}{},
				"emptyArr": []interface{}{},
				"nilVal":   nil,
				"zero":     0,
				"emptyStr": "",
			})
		}

		time.Sleep(1500 * time.Millisecond)
	}
}
