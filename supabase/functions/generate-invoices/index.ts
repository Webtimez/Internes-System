// Edge Function: generate-invoices
// Täglich per pg_cron. Erzeugt aus fälligen Abos (abos.naechster_lauf <= heute, aktiv) je eine Rechnung
// und setzt naechster_lauf entsprechend dem Intervall weiter.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
}
function nextDate(from: string, intervall: string): string {
  const d = new Date(from + "T00:00:00Z");
  if (intervall === "Wöchentlich") d.setUTCDate(d.getUTCDate() + 7);
  else if (intervall === "Vierteljährlich") d.setUTCMonth(d.getUTCMonth() + 3);
  else if (intervall === "Jährlich") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}
function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}

Deno.serve(async (_req) => {
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(url, key);
    const today = new Date().toISOString().slice(0, 10);
    const year = today.slice(0, 4);

    const { data: abos } = await sb.from("abos").select("*").eq("aktiv", true).lte("naechster_lauf", today);
    if (!abos || !abos.length) return json({ erstellt: 0 });

    const { data: rs } = await sb.from("rechnungen").select("nr").eq("typ", "Forderung").ilike("nr", `RE-${year}-%`);
    let maxN = 0;
    (rs || []).forEach((r: any) => { const mm = String(r.nr || "").match(/(\d+)\s*$/); if (mm) maxN = Math.max(maxN, +mm[1]); });

    let erstellt = 0;
    for (const a of abos) {
      maxN++;
      const nr = `RE-${year}-${String(maxN).padStart(3, "0")}`;
      const netto = Number(a.netto) || 0;
      const ust = Number(a.ust_satz) || 0;
      const betrag = Math.round(netto * (1 + ust / 100) * 100) / 100;
      const ins = await sb.from("rechnungen").insert({
        typ: "Forderung", kunde_id: a.kunde_id, partner: a.partner, nr,
        leistung: a.leistung, netto, ust_satz: ust, betrag,
        datum: today, leistungsdatum: today, faellig: addDays(today, a.zahlungsziel || 14),
        status: "Offen", beschreibung: "Automatisch aus Abo erzeugt"
      });
      if (!ins.error) {
        await sb.from("abos").update({ naechster_lauf: nextDate(a.naechster_lauf || today, a.intervall || "Monatlich") }).eq("id", a.id);
        erstellt++;
      } else { maxN--; }
    }
    return json({ erstellt });
  } catch (e) {
    return json({ error: String((e && (e as Error).message) || e) }, 500);
  }
});
