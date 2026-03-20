#!/usr/bin/env python3
"""
BRUTAL v0.3 — zero-sycophancy AI terminal wrapper.
Powered by Puter.js: free, unlimited Gemini access — NO API keys needed.

How it works:
  1. Python starts a tiny local HTTP server.
  2. That server serves an HTML page that loads puter.js.
  3. Python opens the page in your default browser (hidden tab).
  4. The browser page acts as the AI bridge:
       - Python POSTs a prompt → browser fetches puter.ai.chat() → streams back via SSE.
  5. Python reads the stream and prints it to your terminal.

Available models (no key required via puter.js):
  gemini-2.0-flash              (default, fast & free)
  gemini-2.0-flash-lite
  gemini-2.5-flash
  gemini-2.5-pro
  gemini-3-flash-preview
  gemini-3-pro-preview
  gemini-3.1-pro-preview
  gemini-3.1-flash-lite-preview

Usage:
  python brutalv0.3.py                          # interactive chat
  python brutalv0.3.py "your question"          # one-shot
  python brutalv0.3.py --model gemini-2.5-pro   # pick model
"""

import os
import sys
import json
import time
import queue
import signal
import argparse
import threading
import webbrowser
import http.server
import urllib.request
import urllib.parse
import readline           # arrow-key history in input()
from pathlib import Path

# ─── PERSONA / SYSTEM PROMPT ──────────────────────────────────────────────────
def load_system_prompt() -> str:
    persona_path = Path(__file__).parent / "ReadmeA.md"
    if not persona_path.exists():
        sys.exit(f"ERROR: Persona file not found at '{persona_path}'.")
    with open(persona_path) as f:
        return f.read()

SYSTEM_PROMPT = load_system_prompt()

# ─── TERMINAL COLORS ──────────────────────────────────────────────────────────
C = {
    "user":   "\033[1;36m",   # bold cyan
    "brutal": "\033[1;31m",   # bold red
    "meta":   "\033[0;90m",   # dark grey
    "reset":  "\033[0m",
}

def cprint(tag: str, text: str):
    print(f"{C.get(tag,'')}{text}{C['reset']}", flush=True)

# ─── AVAILABLE MODELS ─────────────────────────────────────────────────────────
DEFAULT_MODEL = "gemini-2.0-flash"

AVAILABLE_MODELS = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-3-flash-preview",
    "gemini-3-pro-preview",
    "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite-preview",
]

# ─── SHARED STATE ─────────────────────────────────────────────────────────────
# Queues for Python ↔ server thread communication
_prompt_queue: queue.Queue  = queue.Queue()   # Python → bridge: (messages, model)
_reply_queue:  queue.Queue  = queue.Queue()   # bridge → Python: text chunks / DONE / ERROR

# ─── HTML BRIDGE PAGE ─────────────────────────────────────────────────────────
BRIDGE_HTML = r"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>BRUTAL Bridge</title></head>
<body>
<script src="https://js.puter.com/v2/"></script>
<script>
// ── helpers ──────────────────────────────────────────────────────────────────
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

// ── SSE stream endpoint ───────────────────────────────────────────────────────
// The Python server opens GET /stream; we respond with SSE events.
// Meanwhile Python POSTs to /prompt; we pick that up and call puter.

let pendingResolve = null;

async function handleStream(req, res) {
    // Not used directly — we use long-poll via EventSource on same origin
}

// ── Main bridge loop (called once page loads) ─────────────────────────────────
async function bridgeLoop() {
    while (true) {
        // 1. Long-poll for a new prompt from Python
        let payload;
        try {
            const r = await fetch('/get_prompt', { method: 'GET' });
            if (!r.ok) { await sleep(500); continue; }
            payload = await r.json();
        } catch(e) {
            await sleep(500);
            continue;
        }

        const { messages, model } = payload;

        // 2. Call puter.ai.chat with streaming
        try {
            const response = await puter.ai.chat(messages, { model, stream: true });
            for await (const part of response) {
                if (part?.text) {
                    // Send chunk back to Python
                    await fetch('/chunk', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: part.text })
                    });
                }
            }
        } catch(e) {
            await fetch('/chunk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: String(e) })
            });
        }

        // 3. Signal done
        await fetch('/done', { method: 'POST' });
    }
}

window.addEventListener('load', bridgeLoop);
</script>
<p style="font-family:monospace;color:#555">BRUTAL bridge active — do not close this tab.</p>
</body>
</html>
"""

# ─── LOCAL HTTP SERVER ────────────────────────────────────────────────────────
class BridgeHandler(http.server.BaseHTTPRequestHandler):
    """
    Routes:
      GET  /          → serve bridge HTML
      GET  /get_prompt → long-poll: block until Python posts a prompt, return JSON
      POST /chunk     → browser sends a text chunk; we push to _reply_queue
      POST /done      → browser signals end of stream
    """
    # Shared state (set by BridgeServer)
    pending_prompt: dict | None = None
    prompt_event: threading.Event = threading.Event()

    def log_message(self, *args):
        pass  # silence default request logging

    def do_GET(self):
        if self.path == "/":
            self._send(200, "text/html", BRIDGE_HTML.encode())
        elif self.path == "/get_prompt":
            # Block up to 30 s waiting for Python to enqueue a prompt
            BridgeHandler.prompt_event.wait(timeout=30)
            if BridgeHandler.pending_prompt is not None:
                data = json.dumps(BridgeHandler.pending_prompt).encode()
                BridgeHandler.pending_prompt = None
                BridgeHandler.prompt_event.clear()
                self._send(200, "application/json", data)
            else:
                self._send(204, "application/json", b'{}')
        else:
            self._send(404, "text/plain", b"not found")

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body   = self.rfile.read(length)
        if self.path == "/chunk":
            obj = json.loads(body)
            _reply_queue.put(obj)
            self._send(200, "text/plain", b"ok")
        elif self.path == "/done":
            _reply_queue.put({"done": True})
            self._send(200, "text/plain", b"ok")
        else:
            self._send(404, "text/plain", b"not found")

    def _send(self, code: int, ctype: str, body: bytes):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)


def start_server() -> tuple[http.server.HTTPServer, int]:
    """Start the bridge server on a random available port. Returns (server, port)."""
    server = http.server.HTTPServer(("127.0.0.1", 0), BridgeHandler)
    port   = server.server_address[1]
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    return server, port

# ─── AI CALL (via browser bridge) ────────────────────────────────────────────
def get_response(messages: list, model: str) -> str:
    """
    Send messages to the browser bridge (which calls puter.ai.chat),
    collect streamed chunks, print them live, and return the full reply.
    """
    # Give the bridge the prompt
    BridgeHandler.pending_prompt = {"messages": messages, "model": model}
    BridgeHandler.prompt_event.set()

    full_reply = []
    cprint("brutal", "\nBRUTAL:")

    while True:
        try:
            obj = _reply_queue.get(timeout=60)
        except queue.Empty:
            raise TimeoutError("No response from bridge within 60 s.")

        if "error" in obj:
            raise RuntimeError(obj["error"])
        if obj.get("done"):
            break
        chunk = obj.get("text", "")
        print(C["brutal"] + chunk + C["reset"], end="", flush=True)
        full_reply.append(chunk)

    print()  # newline after streamed output
    return "".join(full_reply)

# ─── CHAT LOOP ────────────────────────────────────────────────────────────────
def reset_messages() -> list:
    return [{"role": "system", "content": SYSTEM_PROMPT}]

def chat_loop(model: str, port: int, one_shot: str | None = None):
    cprint("meta", f"\n[ BRUTAL v0.3 | model: {model} | bridge: http://127.0.0.1:{port} ]")
    cprint("meta",  "[ 'clear' = reset history | 'exit'/Ctrl-C = quit ]")
    cprint("meta",  "[ No API key needed — powered by puter.js ]\n")

    messages = reset_messages()

    def send(user_input: str):
        messages.append({"role": "user", "content": user_input})
        cprint("meta", "\n[thinking...]\n")
        try:
            reply = get_response(messages, model)
        except KeyboardInterrupt:
            print("\n[interrupted]")
            messages.pop()
            return
        except Exception as e:
            cprint("meta", f"\n[ERROR: {e}]")
            messages.pop()
            return
        messages.append({"role": "assistant", "content": reply})

    if one_shot:
        send(one_shot)
        return

    while True:
        try:
            user_input = input(f"{C['user']}YOU: {C['reset']}").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n[exiting]")
            break
        if not user_input:
            continue
        if user_input.lower() in ("exit", "quit", "q"):
            print("[exiting]")
            break
        if user_input.lower() == "clear":
            messages = reset_messages()
            cprint("meta", "[History cleared]")
            continue
        send(user_input)

# ─── ENTRY POINT ──────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        prog="brutal",
        description="BRUTAL v0.3 — zero-sycophancy AI. Powered by puter.js (no API keys).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Available models (all free via puter.js):\n  " + "\n  ".join(AVAILABLE_MODELS),
    )
    parser.add_argument("--model",  default=DEFAULT_MODEL, help=f"Gemini model to use (default: {DEFAULT_MODEL})")
    parser.add_argument("--list",   action="store_true",   help="list available free models and exit")
    parser.add_argument("prompt",   nargs="?",             help="one-shot prompt (skips interactive mode)")
    args = parser.parse_args()

    if args.list:
        print("\nAvailable models (free via puter.js):")
        for m in AVAILABLE_MODELS:
            print(f"  {m}")
        print()
        return

    # Start the local bridge server
    server, port = start_server()
    bridge_url = f"http://127.0.0.1:{port}/"

    cprint("meta", f"[Starting bridge server on port {port}]")
    cprint("meta", "[Opening browser tab for puter.js bridge — keep it open!]")
    webbrowser.open(bridge_url)

    # Give puter.js time to load (it needs to auth with Puter cloud)
    cprint("meta", "[Waiting 3 s for puter.js to initialise...]\n")
    time.sleep(3)

    try:
        chat_loop(args.model, port, one_shot=args.prompt)
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
