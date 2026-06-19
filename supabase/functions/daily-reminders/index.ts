// Edge Function: daily-reminders
// Wird täglich per pg_cron aufgerufen, sendet Zahlungserinnerungen für überfällige Forderungen
// (max. 1 Erinnerung je 7 Tage, gesteuert über rechnungen.letzte_mahnung).
// Benötigtes Secret: SMTP_PASS. Nutzt SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (automatisch vorhanden).
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (_req) => {
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const pass = Deno.env.get("SMTP_PASS");
    if (!pass) return json({ error: "SMTP_PASS Secret fehlt." }, 500);
    const sb = createClient(url, key);

    const today = new Date().toISOString().slice(0, 10);
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    const { data: rs } = await sb.from("rechnungen")
      .select("id,nr,partner,betrag,faellig,status,typ,kunde_id,letzte_mahnung")
      .eq("typ", "Forderung");
    const due = (rs || []).filter((r: any) =>
      r.faellig && r.faellig < today && !["Bezahlt", "Storniert"].includes(r.status));
    const toRemind = due.filter((r: any) => !r.letzte_mahnung || r.letzte_mahnung < cutoff);
    if (!toRemind.length) return json({ sent: 0, geprueft: due.length });

    const { data: kunden } = await sb.from("kunden").select("id,name,email");
    const kmap: Record<string, any> = {};
    (kunden || []).forEach((k: any) => { kmap[k.id] = k; });
    const { data: setrow } = await sb.from("settings").select("data").eq("id", 1).maybeSingle();
    const firma = (setrow && (setrow as any).data && (setrow as any).data.firmenname) || "Webtimez";

    const host = Deno.env.get("SMTP_HOST") || "smtp.ionos.de";
    const port = Number(Deno.env.get("SMTP_PORT") || "587");
    const user = Deno.env.get("SMTP_USER") || "team@webtimez.com";
    const from = Deno.env.get("SMTP_FROM") || user;
    const client = new SMTPClient({ connection: { hostname: host, port, tls: port === 465, auth: { username: user, password: pass } } });

    let sent = 0;
    for (const r of toRemind) {
      const k = kmap[r.kunde_id];
      if (!k || !k.email) continue;
      const days = Math.floor((Date.parse(today) - Date.parse(r.faellig)) / 86400000);
      const betrag = (Number(r.betrag) || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
      const subject = `Zahlungserinnerung – Rechnung ${r.nr || ""}`;
      const text = `Sehr geehrte Damen und Herren,\n\nunsere Rechnung ${r.nr || ""} über ${betrag} war am ${r.faellig} fällig und ist nach unseren Unterlagen noch offen (seit ${days} Tagen).\n\nWir bitten Sie, den offenen Betrag zeitnah zu begleichen. Sollte sich Ihre Zahlung mit dieser E-Mail überschnitten haben, betrachten Sie diese Erinnerung bitte als gegenstandslos.\n\nMit freundlichen Grüßen\n${firma}`;
      try {
        await client.send({ from, to: k.email, subject, content: text });
        await sb.from("rechnungen").update({ letzte_mahnung: today }).eq("id", r.id);
        sent++;
      } catch (_e) { /* einzelne Fehler überspringen */ }
    }
    await client.close();
    return json({ sent, geprueft: due.length });
  } catch (e) {
    return json({ error: String((e && (e as Error).message) || e) }, 500);
  }
});
