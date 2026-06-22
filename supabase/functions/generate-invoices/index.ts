// Edge Function: generate-invoices
// Täglich per pg_cron. Erzeugt aus fälligen Abos (abos.naechster_lauf <= heute, aktiv) je eine Rechnung
// und setzt naechster_lauf entsprechend dem Intervall weiter.
// NEU: Ist beim Abo auto_email=true, wird zusätzlich ein PDF erzeugt und per SMTP an die
//      im CRM hinterlegte Kunden-E-Mail gesendet, in public.emails protokolliert und die
//      Rechnung auf Status 'Versendet' gesetzt.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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
function eur(v: number): string { return (Number(v) || 0).toFixed(2).replace(".", ",") + " €"; }
function dDE(iso: string): string {
  if (!iso) return "";
  const p = String(iso).slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : String(iso);
}
function fillTpl(t: string, r: any, k: any, s: any): string {
  const netto = Number(r.netto) || 0, satz = Number(r.ust_satz) || 0, ust = Math.round(netto * satz / 100 * 100) / 100;
  const brutto = Number(r.betrag) || (netto + ust);
  return String(t || "")
    .replace(/\{nr\}/g, r.nr || "")
    .replace(/\{betrag\}/g, eur(brutto))
    .replace(/\{faellig\}/g, dDE(r.faellig))
    .replace(/\{kunde\}/g, (k && k.name) || r.partner || "")
    .replace(/\{firma\}/g, (s && s.firmenname) || "Webtimez");
}

// Sauberes A4-Rechnungs-PDF (lokal getestet)
async function buildInvoicePdf(r: any, s: any, k: any): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width } = page.getSize();
  const M = 56;
  const dark = rgb(0.12, 0.12, 0.14), muted = rgb(0.45, 0.45, 0.5), line = rgb(0.85, 0.85, 0.88);
  // pdf-lib (WinAnsi) kann manche Sonderzeichen nicht – defensiv säubern.
  const clean = (t: any) => String(t == null ? "" : t).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-");
  const T = (t: any, x: number, yy: number, sz = 10, f = font, c = dark) => page.drawText(clean(t), { x, y: yy, size: sz, font: f, color: c });
  const R = (t: any, xr: number, yy: number, sz = 10, f = font, c = dark) => { const txt = clean(t); const w = f.widthOfTextAtSize(txt, sz); page.drawText(txt, { x: xr - w, y: yy, size: sz, font: f, color: c }); };

  let y = 800;
  T(s.firmenname || "", M, y, 16, bold); y -= 18;
  if (s.inhaber) { T(s.inhaber, M, y, 9, font, muted); y -= 12; }
  const kopf = [s.strasse, s.plzort].filter(Boolean).join(" · ");
  if (kopf) { T(kopf, M, y, 9, font, muted); y -= 12; }
  const kontakt = [s.telefon && ("Tel. " + s.telefon), s.email, s.web].filter(Boolean).join(" · ");
  if (kontakt) { T(kontakt, M, y, 9, font, muted); y -= 12; }

  let my = 800;
  R("Rechnung", width - M, my, 16, bold); my -= 22;
  const meta: [string, string][] = [["Rechnungs-Nr.", r.nr || ""], ["Rechnungsdatum", dDE(r.datum)], ["Leistungsdatum", dDE(r.leistungsdatum || r.datum)], ["Fällig bis", dDE(r.faellig)]];
  meta.forEach(([a, b]) => { R(a, width - M - 90, my, 9, font, muted); R(b, width - M, my, 9, bold); my -= 14; });

  y = 700;
  T("RECHNUNG AN", M, y, 8, bold, muted); y -= 16;
  T(k.name || r.partner || "", M, y, 11, bold); y -= 14;
  if (k.strasse) { T(k.strasse, M, y, 10); y -= 13; }
  const ko = [k.plz, k.ort].filter(Boolean).join(" ");
  if (ko) { T(ko, M, y, 10); y -= 13; }
  if (k.ustid) { T("USt-IdNr.: " + k.ustid, M, y, 9, font, muted); y -= 13; }

  y = 600;
  const cQty = 330, cNet = 400, cVat = 460, cAmt = width - M;
  page.drawRectangle({ x: M, y: y - 6, width: width - 2 * M, height: 22, color: rgb(0.96, 0.96, 0.98) });
  T("Beschreibung", M + 6, y, 9, bold, muted); R("Menge", cQty, y, 9, bold, muted); R("Netto", cNet, y, 9, bold, muted); R("USt", cVat, y, 9, bold, muted); R("Betrag", cAmt, y, 9, bold, muted);
  y -= 24;
  const netto = Number(r.netto) || 0, satz = Number(r.ust_satz) || 0, ust = Math.round(netto * satz / 100 * 100) / 100, brutto = Number(r.betrag) || (netto + ust);
  T(r.leistung || "Leistung", M + 6, y, 10); R("1", cQty, y, 10); R(eur(netto), cNet, y, 10); R(satz + " %", cVat, y, 10); R(eur(netto), cAmt, y, 10);
  y -= 14; page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 0.5, color: line }); y -= 20;

  const sumX = width - M;
  R("Nettobetrag", sumX - 90, y, 10, font, muted); R(eur(netto), sumX, y, 10); y -= 15;
  R("zzgl. USt " + satz + " %", sumX - 90, y, 10, font, muted); R(eur(ust), sumX, y, 10); y -= 8;
  page.drawLine({ start: { x: sumX - 150, y }, end: { x: sumX, y }, thickness: 0.5, color: line }); y -= 16;
  R("Gesamtbetrag", sumX - 90, y, 11, bold); R(eur(brutto), sumX, y, 11, bold); y -= 28;

  if (satz === 0) { T("Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.", M, y, 9, font, muted); y -= 18; }

  T("Bitte überweisen Sie den Betrag bis zum " + dDE(r.faellig) + " auf folgendes Konto:", M, y, 9, font, dark); y -= 14;
  const bank = [s.bank && ("Bank: " + s.bank), s.iban && ("IBAN: " + s.iban), s.bic && ("BIC: " + s.bic)].filter(Boolean).join("   ");
  if (bank) { T(bank, M, y, 9, font, muted); y -= 14; }
  if (r.nr) { T("Verwendungszweck: " + r.nr, M, y, 9, font, muted); y -= 14; }

  const fy = 70;
  page.drawLine({ start: { x: M, y: fy + 14 }, end: { x: width - M, y: fy + 14 }, thickness: 0.5, color: line });
  const foot = [s.firmenname, s.ustid && ("USt-IdNr. " + s.ustid), s.steuernr && ("Steuer-Nr. " + s.steuernr)].filter(Boolean).join("  ·  ");
  T(foot, M, fy, 8, font, muted);
  if (s.footer) { T(String(s.footer).slice(0, 120), M, fy - 12, 8, font, muted); }

  return await doc.save();
}
function toBase64(bytes: Uint8Array): string {
  let bin = ""; const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

Deno.serve(async (_req) => {
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(url, key);
    const today = new Date().toISOString().slice(0, 10);
    const year = today.slice(0, 4);

    const { data: abos } = await sb.from("abos").select("*").eq("aktiv", true).lte("naechster_lauf", today);
    if (!abos || !abos.length) return json({ erstellt: 0, gesendet: 0 });

    const { data: rs } = await sb.from("rechnungen").select("nr").eq("typ", "Forderung").ilike("nr", `RE-${year}-%`);
    let maxN = 0;
    (rs || []).forEach((r: any) => { const mm = String(r.nr || "").match(/(\d+)\s*$/); if (mm) maxN = Math.max(maxN, +mm[1]); });

    // Firmendaten einmal laden (für PDF + Vorlagen)
    const { data: setRow } = await sb.from("settings").select("data").eq("id", 1).maybeSingle();
    const s: any = (setRow && (setRow as any).data) || {};

    // SMTP nur vorbereiten, wenn überhaupt ein Auto-Versand ansteht
    const anyEmail = abos.some((a: any) => a.auto_email);
    const smtpPass = Deno.env.get("SMTP_PASS");
    let client: SMTPClient | null = null;
    if (anyEmail && smtpPass) {
      const host = Deno.env.get("SMTP_HOST") || "smtp.ionos.de";
      const port = Number(Deno.env.get("SMTP_PORT") || "587");
      const user = Deno.env.get("SMTP_USER") || "team@webtimez.com";
      client = new SMTPClient({ connection: { hostname: host, port, tls: port === 465, auth: { username: user, password: smtpPass } } });
    }
    const from = Deno.env.get("SMTP_FROM") || Deno.env.get("SMTP_USER") || "team@webtimez.com";

    let erstellt = 0, gesendet = 0;
    for (const a of abos) {
      maxN++;
      const nr = `RE-${year}-${String(maxN).padStart(3, "0")}`;
      const netto = Number(a.netto) || 0;
      const ust = Number(a.ust_satz) || 0;
      const betrag = Math.round(netto * (1 + ust / 100) * 100) / 100;
      const rechnung: any = {
        typ: "Forderung", kunde_id: a.kunde_id, partner: a.partner, nr,
        leistung: a.leistung, netto, ust_satz: ust, betrag,
        datum: today, leistungsdatum: today, faellig: addDays(today, a.zahlungsziel || 14),
        status: "Offen", beschreibung: "Automatisch aus Abo erzeugt"
      };
      const ins = await sb.from("rechnungen").insert(rechnung).select().single();
      if (ins.error) { maxN--; continue; }
      erstellt++;
      const row = ins.data as any;
      await sb.from("abos").update({ naechster_lauf: nextDate(a.naechster_lauf || today, a.intervall || "Monatlich") }).eq("id", a.id);

      // Auto-Versand
      if (a.auto_email && client) {
        try {
          const { data: k } = await sb.from("kunden").select("name,email,strasse,plz,ort,ustid").eq("id", a.kunde_id).maybeSingle();
          const empf = (k && (k as any).email) || "";
          if (!empf) {
            await sb.from("emails").insert({ betreff: `Rechnung ${nr}`, text: "Keine E-Mail beim Kunden hinterlegt.", empfaenger: a.partner || "", status: "fehler", gesendet_am: new Date().toISOString(), erstellt_von: a.erstellt_von, fehler: "Kunde hat keine E-Mail-Adresse." });
          } else {
            const betreff = fillTpl(a.email_betreff || "Rechnung {nr} – {firma}", row, k, s);
            const text = fillTpl(a.email_text || "Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie unsere Rechnung {nr} über {betrag}.\nWir bitten um Begleichung bis zum {faellig}.\n\nMit freundlichen Grüßen\n{firma}", row, k, s);
            const pdf = await buildInvoicePdf(row, s, k);
            const msg: Record<string, unknown> = {
              from, to: empf, subject: betreff, content: text, html: text.replace(/\n/g, "<br>"),
              attachments: [{ filename: `Rechnung-${nr}.pdf`, content: toBase64(pdf), encoding: "base64", contentType: "application/pdf" }],
            };
            if (s.email) (msg as any).replyTo = s.email;
            const cc = String(a.email_cc || "").split(/[,;\s]+/).map((x: string) => x.trim()).filter(Boolean);
            if (cc.length) (msg as any).cc = cc;
            await client.send(msg as any);
            gesendet++;
            await sb.from("rechnungen").update({ status: "Versendet" }).eq("id", row.id);
            await sb.from("emails").insert({ betreff, text, empfaenger: [empf, ...cc].join(", "), status: "gesendet", gesendet_am: new Date().toISOString(), erstellt_von: a.erstellt_von });
          }
        } catch (err) {
          await sb.from("emails").insert({ betreff: `Rechnung ${nr}`, text: "Automatischer Versand fehlgeschlagen.", empfaenger: a.partner || "", status: "fehler", gesendet_am: new Date().toISOString(), erstellt_von: a.erstellt_von, fehler: String((err && (err as Error).message) || err) });
        }
      }
    }
    if (client) { try { await client.close(); } catch (_) { /* ignore */ } }
    return json({ erstellt, gesendet });
  } catch (e) {
    return json({ error: String((e && (e as Error).message) || e) }, 500);
  }
});
