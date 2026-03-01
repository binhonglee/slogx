---
title: Go SDK
sidebar_position: 4
---

Source: [`sdk/go/slogx/slogx.go`](https://github.com/binhonglee/slogx/blob/main/sdk/go/slogx/slogx.go)

## Install

```bash
go get github.com/binhonglee/slogx
```

## API

```go
type Config struct {
    IsDev       bool
    Port        int
    ServiceName string
    CIMode      *bool
    LogFilePath string
    MaxEntries  int
}

func Init(config Config)
func Debug(args ...interface{})
func Info(args ...interface{})
func Warn(args ...interface{})
func Error(args ...interface{})
```

## Example

```go
package main

import "github.com/binhonglee/slogx"

func main() {
    slogx.Init(slogx.Config{IsDev: true, ServiceName: "api", Port: 8080})
    slogx.Info("request completed", map[string]interface{}{"status": 200})
}
```
