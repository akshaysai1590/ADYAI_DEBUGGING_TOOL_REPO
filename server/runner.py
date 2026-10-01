#!/usr/bin/env python3
"""
Adhyant Debugging Tool — AWS Code Execution Runner
Runs on port 2358. Executes code in isolated Docker containers.
Supports: Python, JavaScript, C, C++, Java

DEPLOYMENT:
  1. SSH into AWS EC2 instance
  2. Copy this file to ~/runner.py
  3. Run: nohup python3 ~/runner.py > ~/runner.log 2>&1 &

REQUIRED DOCKER IMAGES (pre-pull these):
  docker pull python:3-slim
  docker pull node:18-slim
  docker pull gcc:latest
  docker pull eclipse-temurin:17
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json, subprocess, tempfile, os

AUTH = "AdhyantSuperSecretToken123!"

class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST,GET,OPTIONS')
        self.end_headers()

    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(b'[{"id":71,"name":"Python"},{"id":93,"name":"JavaScript"},{"id":50,"name":"C"},{"id":54,"name":"C++"},{"id":62,"name":"Java"}]')

    def do_POST(self):
        token = self.headers.get('X-Auth-Token', '')
        if token != AUTH:
            self.send_response(401)
            self.end_headers()
            return

        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        code = body.get('source_code', '')
        lang_id = int(body.get('language_id', 71))

        lang_map = {
            71: ('python:3-slim',     ['python3', '/code/code.py'],                                          '.py'),
            93: ('node:18-slim',      ['node', '/code/code.js'],                                             '.js'),
            50: ('gcc:latest',        ['sh', '-c', 'gcc /code/code.c -o /tmp/out && /tmp/out'],              '.c'),
            54: ('gcc:latest',        ['sh', '-c', 'g++ /code/code.cpp -o /tmp/out && /tmp/out'],            '.cpp'),
            62: ('eclipse-temurin:17',['sh', '-c', 'javac /code/Main.java -d /tmp && java -cp /tmp Main'],   '.java'),
        }

        image, docker_cmd, ext = lang_map.get(lang_id, lang_map[71])

        with tempfile.TemporaryDirectory() as tmp:
            fname = 'Main.java' if lang_id == 62 else 'code' + ext
            path = os.path.join(tmp, fname)
            with open(path, 'w') as f:
                f.write(code)

            try:
                r = subprocess.run(
                    ['docker', 'run', '--rm', '--network=none', '--memory=256m', '--cpus=1',
                     '-v', f'{tmp}:/code:ro', image] + docker_cmd,
                    capture_output=True, text=True, timeout=15
                )
                resp = {
                    "stdout": r.stdout,
                    "stderr": r.stderr,
                    "compile_output": None,
                    "status": {
                        "id": 3 if r.returncode == 0 else 11,
                        "description": "Accepted" if r.returncode == 0 else "Error"
                    }
                }
            except subprocess.TimeoutExpired:
                resp = {"stdout": "", "stderr": "Time Limit Exceeded", "compile_output": None, "status": {"id": 5, "description": "TLE"}}
            except Exception as e:
                resp = {"stdout": "", "stderr": str(e), "compile_output": None, "status": {"id": 13, "description": "Internal Error"}}

        self.send_response(201)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(resp).encode())

if __name__ == '__main__':
    print("ADHYANT RUNNER ACTIVE ON PORT 2358")
    HTTPServer(('0.0.0.0', 2358), Handler).serve_forever()
