import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Secret pepper for PIN hashing. Set ADHYANT_PIN_PEPPER in Supabase secrets.
// Empty pepper falls back to a weak (but still deterministic) hash.
const PEPPER = Deno.env.get("ADHYANT_PIN_PEPPER") ?? "";

async function pinHash(teamId: string, pin: string): Promise<string> {
  const data = new TextEncoder().encode(`${PEPPER}:${teamId}:${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateSessionToken(): string {
  const rand = crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(rand)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sess_${Date.now()}_${hex}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (obj: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { team_id, pin, display_name } = await req.json();
    if (!team_id || !pin) return json({ success: false, error: "Team ID and PIN required" }, 400);

    const cleanTeamId = String(team_id).trim().toUpperCase();
    const cleanPin = String(pin).trim();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("*")
      .ilike("team_id", cleanTeamId)
      .maybeSingle();

    if (!team) return json({ success: false, error: "Team ID not found" }, 404);
    if (team.status === "disqualified") return json({ success: false, error: "This team has been disqualified" }, 403);

    // Verify PIN: hashed (pepper) first, then legacy plaintext for un-migrated rows.
    const expectedHash = await pinHash(cleanTeamId, cleanPin);
    const legacyMatch = team.pin_hash === cleanPin;
    const hashMatch = team.pin_hash === expectedHash;
    if (!hashMatch && !legacyMatch) return json({ success: false, error: "Incorrect PIN" }, 401);

    // Concurrent-session guard.
    if (team.session_token && team.last_seen_at) {
      const secondsAgo = (Date.now() - new Date(team.last_seen_at).getTime()) / 1000;
      if (secondsAgo < 45) {
        return json({ success: false, error: "Another device is currently using this team" }, 409);
      }
    }

    const sessionToken = generateSessionToken();
    const finalName = String(display_name || "").trim() || team.display_name || cleanTeamId;

    const update: Record<string, unknown> = {
      session_token: sessionToken,
      session_created_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      current_page: "lobby",
    };
    if (String(display_name || "").trim() && String(display_name).trim() !== team.display_name) {
      update.display_name = finalName;
    }
    // Upgrade legacy plaintext PIN to a hash on first successful login.
    if (legacyMatch && !hashMatch) update.pin_hash = expectedHash;

    await supabaseAdmin.from("teams").update(update).eq("id", team.id);

    return json({
      success: true,
      teamDbId: team.id,
      teamId: team.team_id,
      displayName: finalName,
      sessionToken,
      selectedLanguage: team.selected_language ?? null,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return json({ success: false, error: msg }, 500);
  }
});
