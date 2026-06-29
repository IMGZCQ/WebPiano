package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/imgzcq/webpiano/internal/server"
)

func main() {
	addr := flag.String("addr", ":9177", "HTTP listen address")
	root := flag.String("root", "static", "Static files root directory")
	sockPath := flag.String("sock", "/target/fnpiano.sock", "Unix socket path (empty to disable)")
	prefix := flag.String("prefix", "/app/fnpiano", "Path prefix for unix socket gateway (empty to disable prefix rewriting)")
	flag.Parse()

	absRoot, err := filepath.Abs(*root)
	if err != nil {
		log.Fatalf("resolve root: %v", err)
	}
	if info, err := os.Stat(absRoot); err != nil || !info.IsDir() {
		log.Fatalf("static root not found: %s", absRoot)
	}

	mux := http.NewServeMux()
	mux.Handle("/", server.FileServer(absRoot))

	handler := withLogging(mux)

	tcpSrv := &http.Server{
		Addr:              *addr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		log.Printf("对飞牛弹琴 listening on http://localhost%s (root=%s)", *addr, absRoot)
		if err := tcpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server: %v", err)
		}
	}()

	var sockSrv *http.Server
	if *sockPath != "" {
		_ = os.Remove(*sockPath)
		listener, err := net.Listen("unix", *sockPath)
		if err != nil {
			log.Printf("Failed to create unix socket listener at %s: %v", *sockPath, err)
		} else {
			_ = os.Chmod(*sockPath, 0777)
			sockHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if *prefix != "" {
					if r.URL.Path == *prefix {
						http.Redirect(w, r, *prefix+"/", http.StatusPermanentRedirect)
						return
					} else if strings.HasPrefix(r.URL.Path, *prefix+"/") {
						r.URL.Path = strings.TrimPrefix(r.URL.Path, *prefix)
					}
				}
				handler.ServeHTTP(w, r)
			})
			sockSrv = &http.Server{
				Handler:           sockHandler,
				ReadHeaderTimeout: 10 * time.Second,
				ReadTimeout:       30 * time.Second,
				WriteTimeout:      30 * time.Second,
			}
			go func() {
				log.Printf("对飞牛弹琴 listening on unix socket %s (gateway prefix: %s)", *sockPath, *prefix)
				if err := sockSrv.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
					log.Printf("unix socket server: %v", err)
				}
			}()
		}
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	log.Println("shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := tcpSrv.Shutdown(ctx); err != nil {
		log.Printf("graceful shutdown error (tcp): %v", err)
	}
	if sockSrv != nil {
		if err := sockSrv.Shutdown(ctx); err != nil {
			log.Printf("graceful shutdown error (sock): %v", err)
		}
	}
}

func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(ww, r)
		log.Printf("%-3d %-6s %s (%s)", ww.status, r.Method, r.URL.Path, time.Since(start))
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}
