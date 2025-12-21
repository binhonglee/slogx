package slogx

import (
	"fmt"
	"reflect"
	"unsafe"
)

// Serialize converts any value to a JSON-serializable representation,
// including unexported struct fields. Handles cycles, pointers, and
// non-serializable types (channels, funcs) gracefully.
func Serialize(v interface{}) interface{} {
	if v == nil {
		return nil
	}
	seen := make(map[uintptr]bool)
	return serializeValue(reflect.ValueOf(v), seen)
}

func serializeValue(val reflect.Value, seen map[uintptr]bool) interface{} {
	if !val.IsValid() {
		return nil
	}

	// Dereference interfaces
	if val.Kind() == reflect.Interface {
		if val.IsNil() {
			return nil
		}
		return serializeValue(val.Elem(), seen)
	}

	// Dereference pointers with cycle detection
	if val.Kind() == reflect.Ptr {
		if val.IsNil() {
			return nil
		}
		ptr := val.Pointer()
		if seen[ptr] {
			return "[circular]"
		}
		seen[ptr] = true
		return serializeValue(val.Elem(), seen)
	}

	switch val.Kind() {
	case reflect.Struct:
		return serializeStruct(val, seen)

	case reflect.Map:
		return serializeMap(val, seen)

	case reflect.Slice:
		if val.IsNil() {
			return nil
		}
		return serializeSlice(val, seen)

	case reflect.Array:
		return serializeSlice(val, seen)

	case reflect.Chan:
		return fmt.Sprintf("<chan %s>", val.Type().Elem())

	case reflect.Func:
		if val.IsNil() {
			return "<nil func>"
		}
		return fmt.Sprintf("<func %s>", val.Type())

	case reflect.UnsafePointer:
		return fmt.Sprintf("<unsafe.Pointer %v>", val.Pointer())

	default:
		// Basic types: int, string, bool, float, etc.
		if val.CanInterface() {
			return val.Interface()
		}
		return fmt.Sprintf("%v", val)
	}
}

func serializeStruct(val reflect.Value, seen map[uintptr]bool) map[string]interface{} {
	result := make(map[string]interface{})
	t := val.Type()

	// Make value addressable if it isn't (needed for unexported fields)
	if !val.CanAddr() {
		valCopy := reflect.New(val.Type()).Elem()
		valCopy.Set(val)
		val = valCopy
	}

	for i := 0; i < val.NumField(); i++ {
		field := t.Field(i)
		fieldVal := val.Field(i)

		// Skip embedded anonymous fields that are unexported
		if field.Anonymous && !field.IsExported() {
			continue
		}

		// Access unexported fields via unsafe
		if !fieldVal.CanInterface() {
			fieldVal = reflect.NewAt(fieldVal.Type(), unsafe.Pointer(fieldVal.UnsafeAddr())).Elem()
		}

		result[field.Name] = serializeValue(fieldVal, seen)
	}

	return result
}

func serializeMap(val reflect.Value, seen map[uintptr]bool) interface{} {
	if val.IsNil() {
		return nil
	}

	// Check for cycles in maps
	ptr := val.Pointer()
	if seen[ptr] {
		return "[circular]"
	}
	seen[ptr] = true

	result := make(map[string]interface{})
	iter := val.MapRange()
	for iter.Next() {
		key := iter.Key()
		keyStr := fmt.Sprintf("%v", key.Interface())
		result[keyStr] = serializeValue(iter.Value(), seen)
	}
	return result
}

func serializeSlice(val reflect.Value, seen map[uintptr]bool) []interface{} {
	length := val.Len()
	result := make([]interface{}, length)
	for i := 0; i < length; i++ {
		result[i] = serializeValue(val.Index(i), seen)
	}
	return result
}
