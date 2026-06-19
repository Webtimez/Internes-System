// Edge Function: daily-reminders
// Wird täglich per pg_cron aufgerufen (und per "Jetzt prüfen & senden" mit {force:true}).
// Liest die E-Mail-Einstellungen aus settings.data.mail (Automatik an/aus, ab-Tagen, Intervall, Vorlagen).
// Benötigtes Secret: SMTP_PASS. Nutzt SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (automatisch vorhanden).
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
}
function fmtEUR(v: number) { return (Number(v) || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" }); }
function fillTpl(t: string, vars: Record<string, string>) {
  return (t || "").replace(/\{(nr|betrag|faellig|tage|kunde|firma)\}/g, (_m, k) => vars[k] ?? "");
}

Deno.serve(async (req) => {
  try {
    let force = false;
    try { const b = await req.json(); force = !!(b && b.force); } catch (_e) { /* leerer Body (Cron) */ }

    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const pass = Deno.env.get("SMTP_PASS");
    if (!pass) return json({ error: "SMTP_PASS Secret fehlt." }, 500);
    const sb = createClient(url, key);

    const { data: setrow } = await sb.from("settings").select("data").eq("id", 1).maybeSingle();
    const sdata: any = (setrow && (setrow as any).data) || {};
    const m: any = sdata.mail || {};
    const auto = m.autoMahnung !== false;
    if (!auto && !force) return json({ sent: 0, skipped: true, reason: "Automatik deaktiviert" });
    const abTagen = m.abTagen != null ? Number(m.abTagen) : 1;
    const intervall = m.intervallTage != null ? Math.max(1, Number(m.intervallTage)) : 7;
    const firma = sdata.firmenname || "Webtimez";
    const betreffTpl = m.mBetreff || "Zahlungserinnerung – Rechnung {nr}";
    const textTpl = m.mText || "Sehr geehrte Damen und Herren,\n\nunsere Rechnung {nr} über {betrag} war am {faellig} fällig und ist nach unseren Unterlagen noch offen ({tage} Tage überfällig).\n\nWir bitten um zeitnahe Begleichung. Sollte sich Ihre Zahlung überschnitten haben, betrachten Sie diese Erinnerung als gegenstandslos.\n\nMit freundlichen Grüßen\n{firma}";

    const today = new Date().toISOString().slice(0, 10);
    const cutoff = new Date(Date.now() - intervall * 86400000).toISOString().slice(0, 10);

    const { data: rs } = await sb.from("rechnungen")
      .select("id,nr,partner,betrag,faellig,status,typ,kunde_id,letzte_mahnung")
      .eq("typ", "Forderung");
    const due = (rs || []).filter((r: any) => {
      if (!r.faellig || ["Bezahlt", "Storniert"].includes(r.status)) return false;
      const days = Math.floor((Date.parse(today) - Date.parse(r.faellig)) / 86400000);
      return days >= abTagen;
    });
    const toRemind = due.filter((r: any) => !r.letzte_mahnung || r.letzte_mahnung < cutoff);
    if (!toRemind.length) return json({ sent: 0, geprueft: due.length });

    const { data: kunden } = await sb.from("kunden").select("id,name,email");
    const kmap: Record<string, any> = {};
    (kunden || []).forEach((k: any) => { kmap[k.id] = k; });

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
      const vars = { nr: r.nr || "", betrag: fmtEUR(r.betrag), faellig: r.faellig || "", tage: String(days), kunde: k.name || "", firma };
      try {
        await client.send({ from, to: k.email, subject: fillTpl(betreffTpl, vars), content: fillTpl(textTpl, vars) });
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
