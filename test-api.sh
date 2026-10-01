curl -s -X POST https://ztiifyaoxyeefxokqben.supabase.co/functions/v1/evaluate \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0aWlmeWFveHllZWZ4b2txYmVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzMwMjEsImV4cCI6MjEwNjM0OTAyMX0.ngeYVon4Gmq06ToDpFIjei5bh1j2YzT51fZCvQKKROY" \
  -H "Content-Type: application/json" \
  -d '{
    "question_id": "44444444-4444-4444-4444-444444444444",
    "team_id": "33333333-3333-3333-3333-333333333333",
    "code": "def greet(name):\n    return \"Hello, \" + name\n\nprint(greet(\"World\"))",
    "language": "python",
    "action": "run"
  }'
