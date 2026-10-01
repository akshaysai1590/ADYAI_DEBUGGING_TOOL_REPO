// Centralized edge-function client. All privileged operations go through
// Supabase edge functions (service role) instead of the public anon key.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function fnUrl(name: string): string {
  return `${SUPABASE_URL}/functions/v1/${name}`;
}

// POST a JSON body to an edge function. Throws an Error if `success` is false,
// otherwise returns the parsed body. HTTP status is deliberately NOT used as a
// failure signal, because evaluate returns HTTP 400 for "ran but failed" while
// carrying a usable `is_correct:false` payload in the body.
async function callEdge(name: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(fnUrl(name), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ success: false, error: `HTTP ${res.status}` }));
  if (data.success === false) {
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }
  return data;
}

// The admin password lives in Supabase secrets (ADHYANT_ADMIN_SECRET). It is
// held in memory only (never persisted) and injected into every admin() call.
let adminSecret: string | null = null;
export function setAdminSecret(secret: string | null) {
  adminSecret = secret;
}

export const api = {
  join: (payload: { team_id: string; pin: string; display_name?: string }) =>
    callEdge("join", payload),

  evaluate: (payload: Record<string, unknown>) => callEdge("evaluate", payload),

  participant: (payload: Record<string, unknown>) => callEdge("participant", payload),

  admin: (payload: Record<string, unknown>) => callEdge("admin", { ...payload, admin_secret: adminSecret }),

  scoreboard: async (roundId?: string) => {
    const url = roundId
      ? `${fnUrl("scoreboard")}?round_id=${encodeURIComponent(roundId)}`
      : fnUrl("scoreboard");
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${ANON_KEY}` },
    });
    const data = await res.json().catch(() => ({ success: false, error: `HTTP ${res.status}` }));
    if (data.success === false) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  },
};
