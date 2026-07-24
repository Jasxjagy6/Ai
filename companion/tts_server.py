#!/usr/bin/env python3
"""
Aria TTS microservice.

A tiny stdlib-only HTTP server that keeps the Piper voice loaded in memory and
synthesizes speech on demand. Runs on the host (like Ollama); the web app —
which uses Docker host networking — reaches it at http://localhost:<port>.

  POST /tts   {"text": "...", "voice": "amy", "style": "casual"}  -> audio/wav
  GET  /health                                                    -> {"ok": true, "voices": [...]}

No external web framework needed (keeps the footprint small on a CPU-only box).
"""
import io
import json
import os
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from piper import PiperVoice, SynthesisConfig

VOICES_DIR = Path(os.environ.get("ARIA_VOICES_DIR", Path(__file__).resolve().parent / "voices"))
PORT = int(os.environ.get("ARIA_TTS_PORT", "11435"))
MAX_CHARS = 1200

# Map a friendly voice name -> onnx file. Add more voices by dropping
# <name>.onnx (+ .onnx.json) into the voices dir and listing it here.
VOICE_FILES = {
    "amy": "amy.onnx",       # default warm female (Aria)
}

# Per-"style" prosody. Youthful personas talk a touch faster & brighter;
# mature ones slower & calmer. Tunable without touching the web app.
STYLE_PRESETS = {
    "casual":   dict(length_scale=1.0,  noise_scale=0.667, noise_w_scale=0.8),
    "youthful": dict(length_scale=0.95, noise_scale=0.70,  noise_w_scale=0.85),
    "mature":   dict(length_scale=1.08, noise_scale=0.60,  noise_w_scale=0.75),
    "flirty":   dict(length_scale=1.05, noise_scale=0.72,  noise_w_scale=0.9),
}

_loaded: dict[str, PiperVoice] = {}


def get_voice(name: str) -> PiperVoice:
    name = name if name in VOICE_FILES else "amy"
    if name not in _loaded:
        model = VOICES_DIR / VOICE_FILES[name]
        _loaded[name] = PiperVoice.load(str(model))
    return _loaded[name]


def synth_wav(text: str, voice: str, style: str) -> bytes:
    v = get_voice(voice)
    preset = STYLE_PRESETS.get(style, STYLE_PRESETS["casual"])
    cfg = SynthesisConfig(volume=1.0, normalize_audio=True, **preset)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        v.synthesize_wav(text, wf, syn_config=cfg)
    return buf.getvalue()


class Handler(BaseHTTPRequestHandler):
    def _json(self, code: int, obj: dict):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.rstrip("/") == "/health":
            self._json(200, {"ok": True, "voices": list(VOICE_FILES)})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        if self.path.rstrip("/") != "/tts":
            self._json(404, {"error": "not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            self._json(400, {"error": "bad json"})
            return

        text = (payload.get("text") or "").strip()[:MAX_CHARS]
        if not text:
            self._json(400, {"error": "empty text"})
            return
        voice = str(payload.get("voice") or "amy")
        style = str(payload.get("style") or "casual")

        try:
            audio = synth_wav(text, voice, style)
        except Exception as e:  # keep the service alive on a bad input
            self._json(500, {"error": f"synth failed: {e}"})
            return

        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(audio)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(audio)

    def log_message(self, *args):  # quiet logs
        pass


def main():
    # warm the default voice so the first request is fast
    get_voice("amy")
    print(f"Aria TTS on :{PORT} — voices: {list(VOICE_FILES)}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
