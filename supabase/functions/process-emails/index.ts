// Edge Function: process-emails
// Wird alle 15 Min per pg_cron aufgerufen. Versendet geplante E-Mails (status 'geplant', senden_am erreicht)
// und wiederkehrende E-Mails (status 'wiederkehrend', naechster_lauf erreicht) über IONOS-SMTP.
// Benötigtes Secret: SMTP_PASS. Nutzt SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
}
function nextRun(from: string, rep: string): string {
  const d = new Date(from + "T00:00:00Z");
  if (rep === "Täglich") d.setUTCDate(d.getUTCDate() + 1);
  else if (rep === "Wöchentlich") d.setUTCDate(d.getUTCDate() + 7);
  else if (rep === "Monatlich") d.setUTCMonth(d.getUTCMonth() + 1);
  else if (rep === "Jährlich") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (_req) => {
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const pass = Deno.env.get("SMTP_PASS");
    if (!pass) return json({ error: "SMTP_PASS Secret fehlt." }, 500);
    const sb = createClient(url, key);
    const host = Deno.env.get("SMTP_HOST") || "smtp.ionos.de";
    const port = Number(Deno.env.get("SMTP_PORT") || "587");
    const user = Deno.env.get("SMTP_USER") || "team@webtimez.com";
    const from = Deno.env.get("SMTP_FROM") || user;

    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);

    const { data: geplant } = await sb.from("emails").select("*").eq("status", "geplant").lte("senden_am", nowIso);
    const { data: wieder } = await sb.from("emails").select("*").eq("status", "wiederkehrend").lte("naechster_lauf", today);
    const jobs = [...(geplant || []), ...(wieder || [])];
    if (!jobs.length) return json({ sent: 0 });

    const client = new SMTPClient({ connection: { hostname: host, port, tls: port === 465, auth: { username: user, password: pass } } });
    let sent = 0;
    for (const e of jobs) {
      const recipients = String(e.empfaenger || "").split(/[,;\s]+/).map((x: string) => x.trim()).filter(Boolean);
      let ok = 0; let lastErr = "";
      for (const to of recipients) {
        try {
          await client.send({ from, to, subject: e.betreff || "", content: e.text || " ", html: (e.text || " ").replace(/\n/g, "<br>") });
          ok++;
        } catch (err) { lastErr = String((err && (err as Error).message) || err); }
      }
      if (e.status === "geplant") {
        await sb.from("emails").update({ status: ok > 0 ? "gesendet" : "fehler", gesendet_am: nowIso, fehler: ok > 0 ? null : lastErr }).eq("id", e.id);
      } else {
        await sb.from("emails").insert({ betreff: e.betreff, text: e.text, empfaenger: e.empfaenger, status: ok > 0 ? "gesendet" : "fehler", gesendet_am: nowIso, erstellt_von: e.erstellt_von, fehler: ok > 0 ? null : lastErr });
        await sb.from("emails").update({ naechster_lauf: nextRun(e.naechster_lauf || today, e.wiederholung || "") }).eq("id", e.id);
      }
      if (ok > 0) sent++;
    }
    await client.close();
    return json({ sent, verarbeitet: jobs.length });
  } catch (e) {
    return json({ error: String((e && (e as Error).message) || e) }, 500);
  }
});
