#!/usr/bin/env python3
"""
Adhyant Debugging Tool — AWS Code Execution Runner (HARDENED)
Runs on port 2358. Executes code in isolated Docker containers.

Supports: Python, JavaScript, C, C++, Java

Changes from the original single-threaded version:
  - ThreadingHTTPServer: requests are handled concurrently instead of serially.
  - A BoundedSemaphore caps how many Docker containers run at once, so 30 teams
    submitting simultaneously cannot OOM the box.
  - Per-IP rate limiting (token bucket) stops hammering / DoS.
  - Strict language whitelist: an unknown language_id is rejected with 400
    (the old code silently ran it as Python).
  - Source size and output size caps.
  - Extra Docker hardening: --pids-limit and --security-opt no-new-privileges.

DEPLOYMENT (on the EC2 instance):
  1. scp this file to the instance:  scp runner.py ubuntu@18.205.20.2:~/runner.py
  2. Pre-pull images (do once):
       docker pull python:3-slim
       docker pull node:18-slim
       docker pull gcc:latest
       docker pull eclipse-temurin:17
  3. Kill the old runner and start this one:
       pkill -f runner.py
       ADHYANT_JUDGE_TOKEN='<new-token>' nohup python3 ~/runner.py > ~/runner.log 2>&1 &

Config via env vars (all optional, sensible defaults shown):
  ADHYANT_JUDGE_TOKEN      auth token (CHANGE THIS - the old one is in git)
  ADHYANT_MAX_CONCURRENT   max parallel Docker runs (default 4)
  ADHYANT_RATE_PER_MINUTE  max requests per IP per minute (default 30)
"""

import json
import os
import subprocess
import tempfile
import threading
import time
from collections import defaultdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

AUTH_TOKEN = os.environ.get("ADHYANT_JUDGE_TOKEN", "AdhyantSuperSecretToken123!")

MAX_CONCURRENT_RUNS = int(os.environ.get("ADHYANT_MAX_CONCURRENT", "4"))
RATE_LIMIT_PER_MIN = int(os.environ.get("ADHYANT_RATE_PER_MINUTE", "30"))
MAX_SOURCE_BYTES = 64 * 1024          # 64 KB of source code
MAX_OUTPUT_BYTES = 64 * 1024          # 64 KB of stdout/stderr
RUN_TIMEOUT_SECONDS = 15
RUN_MEMORY = "256m"
RUN_CPUS = "1.0"
RUN_PIDS_LIMIT = 128

# language_id -> (docker image, command, file extension)
LANGUAGES = {
    71: ("python:3-slim",      ["python3", "/code/code.py"],                                            ".py"),
    93: ("node:18-slim",       ["node", "/code/code.js"],                                               ".js"),
    50: ("gcc:latest",         ["sh", "-c", "gcc /code/code.c -o /tmp/out && /tmp/out"],                ".c"),
    54: ("gcc:latest",         ["sh", "-c", "g++ /code/code.cpp -o /tmp/out && /tmp/out"],              ".cpp"),
    62: ("eclipse-temurin:17", ["sh", "-c", "javac /code/Main.java -d /tmp && java -cp /tmp Main"],     ".java"),
}

# ── Per-IP token bucket rate limiter ─────────────────────────────────────────
_buckets = defaultdict(lambda: {"tokens": float(RATE_LIMIT_PER_MIN), "ts": time.time()})
_buckets_lock = threading.Lock()


def allow_request(ip: str) -> bool:
    with _buckets_lock:
        b = _buckets[ip]
        now = time.time()
        elapsed = now - b["ts"]
        b["tokens"] = min(float(RATE_LIMIT_PER_MIN), b["tokens"] + elapsed * (RATE_LIMIT_PER_MIN / 60.0))
        b["ts"] = now
        if b["tokens"] < 1.0:
            return False
        b["tokens"] -= 1.0
        return True


# ── Concurrency cap ──────────────────────────────────────────────────────────
_run_slots = threading.BoundedSemaphore(MAX_CONCURRENT_RUNS)


def run_code(language_id: int, source: str) -> dict:
    image, cmd, ext = LANGUAGES[language_id]
    fname = "Main.java" if language_id == 62 else "code" + ext

    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, fname)
        with open(path, "w") as f:
            f.write(source)

        docker_cmd = [
            "docker", "run", "--rm",
            "--network=none",
            "--memory=" + RUN_MEMORY,
            "--cpus=" + RUN_CPUS,
            "--pids-limit=" + str(RUN_PIDS_LIMIT),
            "--security-opt", "no-new-privileges",
            "-v", tmp + ":/code:ro",
            image,
        ] + cmd

        try:
            r = subprocess.run(docker_cmd, capture_output=True, timeout=RUN_TIMEOUT_SECONDS)
            stdout = r.stdout.decode("utf-8", "replace")[:MAX_OUTPUT_BYTES]
            stderr = r.stderr.decode("utf-8", "replace")[:MAX_OUTPUT_BYTES]
            return {
                "stdout": stdout,
                "stderr": stderr,
                "compile_output": None,
                "status": {
                    "id": 3 if r.returncode == 0 else 11,
                    "description": "Accepted" if r.returncode == 0 else "Runtime Error",
                },
            }
        except subprocess.TimeoutExpired:
            return {"stdout": "", "stderr": "Time Limit Exceeded", "compile_output": None,
                    "status": {"id": 5, "description": "Time Limit Exceeded"}}
        except Exception as e:  # noqa: BLE001 - surface any runner failure to the caller
            return {"stdout": "", "stderr": str(e), "compile_output": None,
                    "status": {"id": 13, "description": "Internal Error"}}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, obj) -> None:
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "POST,GET,OPTIONS")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except BrokenPipeError:
            pass

    def do_OPTIONS(self):
        self._send(200, {})

    def do_GET(self):
        langs = [
            {"id": 71, "name": "Python"},
            {"id": 93, "name": "JavaScript"},
            {"id": 50, "name": "C"},
            {"id": 54, "name": "C++"},
            {"id": 62, "name": "Java"},
        ]
        self._send(200, langs)

    def do_POST(self):
        if self.headers.get("X-Auth-Token", "") != AUTH_TOKEN:
            self._send(401, {"error": "unauthorized"})
            return

        ip = self.client_address[0]
        if not allow_request(ip):
            self._send(429, {"error": "rate limit exceeded"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send(400, {"error": "bad Content-Length"})
            return
        if length > MAX_SOURCE_BYTES + 4096:
            self._send(413, {"error": "payload too large"})
            return

        try:
            body = json.loads(self.rfile.read(length))
        except Exception:
            self._send(400, {"error": "invalid JSON"})
            return

        source = body.get("source_code", "")
        if not isinstance(source, str):
            self._send(400, {"error": "source_code must be a string"})
            return
        if len(source.encode("utf-8")) > MAX_SOURCE_BYTES:
            self._send(413, {"error": "source code too large"})
            return

        try:
            lang_id = int(body.get("language_id", 0))
        except (TypeError, ValueError):
            lang_id = 0
        if lang_id not in LANGUAGES:
            self._send(400, {"error": "unsupported language_id"})
            return

        # Block until a Docker slot frees up (bounded wait, then 503).
        if not _run_slots.acquire(timeout=RUN_TIMEOUT_SECONDS + 5):
            self._send(503, {"error": "server busy, try again"})
            return
        try:
            resp = run_code(lang_id, source)
        finally:
            _run_slots.release()

        self._send(201, resp)

    def log_message(self, format, *args):  # noqa: A002 - must match base signature
        # Silence the default per-request logging.
        pass


if __name__ == "__main__":
    print("ADHYANT RUNNER ACTIVE ON PORT 2358 (threaded, hardened)")
    ThreadingHTTPServer(("0.0.0.0", 2358), Handler).serve_forever()
