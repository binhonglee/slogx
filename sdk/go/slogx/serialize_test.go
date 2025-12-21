package slogx

import (
	"testing"
)

// --- Test structs ---

type PublicStruct struct {
	Name  string
	Value int
}

type mixedStruct struct {
	Public  string
	private string
	Count   int
	hidden  bool
}

type nestedStruct struct {
	ID    int
	Inner *mixedStruct
}

type circularStruct struct {
	Name string
	Self *circularStruct
}

type withPointers struct {
	Ptr    *string
	NilPtr *int
}

type withChan struct {
	Ch   chan int
	Name string
}

type withFunc struct {
	Fn   func() error
	Name string
}

type withMap struct {
	Data map[string]int
}

type withSlice struct {
	Items []string
}

// --- Tests ---

func TestSerialize_Nil(t *testing.T) {
	result := Serialize(nil)
	if result != nil {
		t.Errorf("expected nil, got %v", result)
	}
}

func TestSerialize_BasicTypes(t *testing.T) {
	tests := []struct {
		name     string
		input    interface{}
		expected interface{}
	}{
		{"string", "hello", "hello"},
		{"int", 42, 42},
		{"float", 3.14, 3.14},
		{"bool", true, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := Serialize(tt.input)
			if result != tt.expected {
				t.Errorf("expected %v, got %v", tt.expected, result)
			}
		})
	}
}

func TestSerialize_PublicStruct(t *testing.T) {
	input := PublicStruct{Name: "test", Value: 123}
	result := Serialize(input)

	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map, got %T", result)
	}

	if m["Name"] != "test" {
		t.Errorf("expected Name=test, got %v", m["Name"])
	}
	if m["Value"] != 123 {
		t.Errorf("expected Value=123, got %v", m["Value"])
	}
}

func TestSerialize_UnexportedFields(t *testing.T) {
	input := mixedStruct{
		Public:  "visible",
		private: "hidden-value",
		Count:   42,
		hidden:  true,
	}
	result := Serialize(input)

	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map, got %T", result)
	}

	// Public fields
	if m["Public"] != "visible" {
		t.Errorf("expected Public=visible, got %v", m["Public"])
	}
	if m["Count"] != 42 {
		t.Errorf("expected Count=42, got %v", m["Count"])
	}

	// Unexported fields should also be present
	if m["private"] != "hidden-value" {
		t.Errorf("expected private=hidden-value, got %v", m["private"])
	}
	if m["hidden"] != true {
		t.Errorf("expected hidden=true, got %v", m["hidden"])
	}
}

func TestSerialize_NestedStruct(t *testing.T) {
	inner := &mixedStruct{Public: "inner", private: "secret", Count: 10, hidden: false}
	input := nestedStruct{ID: 1, Inner: inner}
	result := Serialize(input)

	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map, got %T", result)
	}

	if m["ID"] != 1 {
		t.Errorf("expected ID=1, got %v", m["ID"])
	}

	innerMap, ok := m["Inner"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected Inner to be map, got %T", m["Inner"])
	}

	if innerMap["private"] != "secret" {
		t.Errorf("expected Inner.private=secret, got %v", innerMap["private"])
	}
}

func TestSerialize_NilPointer(t *testing.T) {
	input := nestedStruct{ID: 1, Inner: nil}
	result := Serialize(input)

	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map, got %T", result)
	}

	if m["Inner"] != nil {
		t.Errorf("expected Inner=nil, got %v", m["Inner"])
	}
}

func TestSerialize_CircularReference(t *testing.T) {
	input := &circularStruct{Name: "root"}
	input.Self = input // circular reference

	result := Serialize(input)

	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map, got %T", result)
	}

	if m["Name"] != "root" {
		t.Errorf("expected Name=root, got %v", m["Name"])
	}

	if m["Self"] != "[circular]" {
		t.Errorf("expected Self=[circular], got %v", m["Self"])
	}
}

func TestSerialize_Pointer(t *testing.T) {
	s := "hello"
	input := withPointers{Ptr: &s, NilPtr: nil}
	result := Serialize(input)

	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map, got %T", result)
	}

	if m["Ptr"] != "hello" {
		t.Errorf("expected Ptr=hello, got %v", m["Ptr"])
	}
	if m["NilPtr"] != nil {
		t.Errorf("expected NilPtr=nil, got %v", m["NilPtr"])
	}
}

func TestSerialize_Channel(t *testing.T) {
	ch := make(chan int)
	input := withChan{Ch: ch, Name: "test"}
	result := Serialize(input)

	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map, got %T", result)
	}

	chStr, ok := m["Ch"].(string)
	if !ok {
		t.Fatalf("expected Ch to be string, got %T", m["Ch"])
	}
	if chStr != "<chan int>" {
		t.Errorf("expected Ch=<chan int>, got %v", chStr)
	}
}

func TestSerialize_Func(t *testing.T) {
	fn := func() error { return nil }
	input := withFunc{Fn: fn, Name: "test"}
	result := Serialize(input)

	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map, got %T", result)
	}

	fnStr, ok := m["Fn"].(string)
	if !ok {
		t.Fatalf("expected Fn to be string, got %T", m["Fn"])
	}
	if fnStr != "<func func() error>" {
		t.Errorf("expected Fn=<func func() error>, got %v", fnStr)
	}
}

func TestSerialize_NilFunc(t *testing.T) {
	input := withFunc{Fn: nil, Name: "test"}
	result := Serialize(input)

	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map, got %T", result)
	}

	if m["Fn"] != "<nil func>" {
		t.Errorf("expected Fn=<nil func>, got %v", m["Fn"])
	}
}

func TestSerialize_Map(t *testing.T) {
	input := withMap{Data: map[string]int{"a": 1, "b": 2}}
	result := Serialize(input)

	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map, got %T", result)
	}

	data, ok := m["Data"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected Data to be map, got %T", m["Data"])
	}

	if data["a"] != 1 {
		t.Errorf("expected Data[a]=1, got %v", data["a"])
	}
	if data["b"] != 2 {
		t.Errorf("expected Data[b]=2, got %v", data["b"])
	}
}

func TestSerialize_NilMap(t *testing.T) {
	input := withMap{Data: nil}
	result := Serialize(input)

	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map, got %T", result)
	}

	if m["Data"] != nil {
		t.Errorf("expected Data=nil, got %v", m["Data"])
	}
}

func TestSerialize_Slice(t *testing.T) {
	input := withSlice{Items: []string{"a", "b", "c"}}
	result := Serialize(input)

	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map, got %T", result)
	}

	items, ok := m["Items"].([]interface{})
	if !ok {
		t.Fatalf("expected Items to be slice, got %T", m["Items"])
	}

	if len(items) != 3 {
		t.Errorf("expected 3 items, got %d", len(items))
	}
	if items[0] != "a" || items[1] != "b" || items[2] != "c" {
		t.Errorf("expected [a,b,c], got %v", items)
	}
}

func TestSerialize_NilSlice(t *testing.T) {
	input := withSlice{Items: nil}
	result := Serialize(input)

	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map, got %T", result)
	}

	if m["Items"] != nil {
		t.Errorf("expected Items=nil, got %v", m["Items"])
	}
}

func TestSerialize_DirectMap(t *testing.T) {
	input := map[string]interface{}{
		"key1": "value1",
		"key2": 42,
	}
	result := Serialize(input)

	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map, got %T", result)
	}

	if m["key1"] != "value1" {
		t.Errorf("expected key1=value1, got %v", m["key1"])
	}
	if m["key2"] != 42 {
		t.Errorf("expected key2=42, got %v", m["key2"])
	}
}

func TestSerialize_DirectSlice(t *testing.T) {
	input := []int{1, 2, 3}
	result := Serialize(input)

	s, ok := result.([]interface{})
	if !ok {
		t.Fatalf("expected slice, got %T", result)
	}

	if len(s) != 3 {
		t.Errorf("expected 3 items, got %d", len(s))
	}
}

func TestSerialize_PointerToStruct(t *testing.T) {
	input := &mixedStruct{Public: "ptr", private: "also-ptr", Count: 99, hidden: true}
	result := Serialize(input)

	m, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map, got %T", result)
	}

	if m["Public"] != "ptr" {
		t.Errorf("expected Public=ptr, got %v", m["Public"])
	}
	if m["private"] != "also-ptr" {
		t.Errorf("expected private=also-ptr, got %v", m["private"])
	}
}

// Test that circular maps don't cause infinite loops
func TestSerialize_CircularMap(t *testing.T) {
	m := make(map[string]interface{})
	m["self"] = m // circular

	result := Serialize(m)

	rm, ok := result.(map[string]interface{})
	if !ok {
		t.Fatalf("expected map, got %T", result)
	}

	if rm["self"] != "[circular]" {
		t.Errorf("expected self=[circular], got %v", rm["self"])
	}
}
