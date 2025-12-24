package slogx

import impl "github.com/binhonglee/slogx/sdk/go/slogx"

type LogLevel = impl.LogLevel
type Config = impl.Config
type LogEntry = impl.LogEntry
type SlogX = impl.SlogX

func Init(config Config) { impl.Init(config) }

func Debug(args ...interface{}) { impl.Debug(args...) }
func Info(args ...interface{})  { impl.Info(args...) }
func Warn(args ...interface{})  { impl.Warn(args...) }
func Error(args ...interface{}) { impl.Error(args...) }
