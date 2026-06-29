package server

import (
	"net/http"
	"path/filepath"
	"strings"
)

// FileServer returns a handler that serves static files from root and sets
// sensible cache headers. HTML/JS/CSS are served with no-cache so edits show
// up on reload; audio is cached for a day.
func FileServer(root string) http.Handler {
	fs := http.FileServer(http.Dir(root))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		clean := filepath.Clean(r.URL.Path)
		if strings.HasPrefix(clean, "..") {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		switch {
		case isAudioPath(clean):
			w.Header().Set("Cache-Control", "public, max-age=86400")
		case isAssetPath(clean):
			// JS/CSS change often; force revalidation.
			w.Header().Set("Cache-Control", "no-cache")
		default:
			w.Header().Set("Cache-Control", "no-cache")
		}
		fs.ServeHTTP(w, r)
	})
}

func isAudioPath(p string) bool {
	return strings.HasSuffix(p, ".mp3") ||
		strings.HasSuffix(p, ".ogg") ||
		strings.HasSuffix(p, ".wav") ||
		strings.HasSuffix(p, ".flac")
}

func isAssetPath(p string) bool {
	return strings.HasSuffix(p, ".js") ||
		strings.HasSuffix(p, ".css") ||
		strings.HasSuffix(p, ".html")
}
