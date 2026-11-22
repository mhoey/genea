package main

import (
	"os/exec"
	"strings"
	"testing"
)

func TestGeneaNoParametersListsOptions(t *testing.T) {
	cmd := exec.Command("go", "run", ".")
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("expected running without parameters to succeed, got error: %v, output: %s", err, string(out))
	}

	output := string(out)
	expectedStrings := []string{
		"Genea — Local-First Genealogy Archive",
		"Usage: genea [options]",
		"Available options:",
		"-data",
		"-export-web",
		"-summary",
		"-updateperson",
		"-validate",
	}

	for _, expected := range expectedStrings {
		if !strings.Contains(output, expected) {
			t.Errorf("expected output to contain %q, but got:\n%s", expected, output)
		}
	}
}
