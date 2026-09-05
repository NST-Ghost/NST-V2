.PHONY: all build test clean cross-compile

BINARY_NAME=nst
VERSION ?= $(shell cat VERSION 2>/dev/null || echo "2.0.0")
LDFLAGS=-s -w -X 'main.version=$(VERSION)'

all: test build

build:
	CGO_ENABLED=0 go build -ldflags="$(LDFLAGS)" -o bin/$(BINARY_NAME) ./cmd/nst

desktop:
	cd frontend && npm run build
	go build -tags gtk3 -ldflags="$(LDFLAGS)" -o bin/$(BINARY_NAME)-desktop ./cmd/nst-desktop

test:
	CGO_ENABLED=0 go test -v ./pkg/...

cross-compile:
	mkdir -p dist
	# Linux amd64
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o dist/$(BINARY_NAME)-linux-amd64 ./cmd/nst
	# Linux arm64
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags="$(LDFLAGS)" -o dist/$(BINARY_NAME)-linux-arm64 ./cmd/nst
	# Windows amd64
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o dist/$(BINARY_NAME)-windows-amd64.exe ./cmd/nst
	# macOS Apple Silicon (arm64)
	CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -ldflags="$(LDFLAGS)" -o dist/$(BINARY_NAME)-darwin-arm64 ./cmd/nst
	# macOS Intel (amd64)
	CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o dist/$(BINARY_NAME)-darwin-amd64 ./cmd/nst

clean:
	rm -rf bin dist workspace.nst
