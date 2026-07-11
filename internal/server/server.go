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
		case isSoundfontPath(clean):
			// SoundFont files inline the audio samples as base64 and only
			// change on app upgrades; cache them like audio assets.
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
		strings.HasSuffix(p, ".flac") ||
		strings.HasSuffix(p, ".mid") ||
		strings.HasSuffix(p, ".midi")
}

// isSoundfontPath matches the inline-base64 MusyngKite SoundFont files we
// ship under static/soundfonts/. They look like static JS to the file
// server, but semantically they are audio sample bundles and should be
// cached like the audio assets above.
func isSoundfontPath(p string) bool {
	return strings.HasPrefix(p, "/soundfonts/") && strings.HasSuffix(p, ".js")
}

func isAssetPath(p string) bool {
	return strings.HasSuffix(p, ".js") ||
		strings.HasSuffix(p, ".css") ||
		strings.HasSuffix(p, ".html")
}
