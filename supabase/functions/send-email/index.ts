// Edge Function: send-email
// Versendet E-Mails über IONOS-SMTP (team@webtimez.com).
// Benötigtes Secret: SMTP_PASS (Postfach-Passwort). Optional: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_FROM.
// verify_jwt = true -> nur eingeloggte Nutzer dürfen senden.
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const pass = Deno.env.get("SMTP_PASS");
    if (!pass) return json({ error: "SMTP_PASS Secret fehlt. Bitte in Supabase unter Edge Functions > Secrets setzen." }, 500);
    const host = Deno.env.get("SMTP_HOST") || "smtp.ionos.de";
    const port = Number(Deno.env.get("SMTP_PORT") || "587");
    const user = Deno.env.get("SMTP_USER") || "team@webtimez.com";
    const from = Deno.env.get("SMTP_FROM") || user;

    const body = await req.json();
    const { to, subject, html, text, replyTo, attachments } = body || {};
    if (!to || !subject) return json({ error: "to und subject sind erforderlich." }, 400);

    const client = new SMTPClient({
      connection: { hostname: host, port, tls: port === 465, auth: { username: user, password: pass } },
    });
    const msg: Record<string, unknown> = { from, to, subject, content: text || " " };
    if (html) msg.html = html;
    if (replyTo) msg.replyTo = replyTo;
    if (Array.isArray(attachments) && attachments.length) {
      msg.attachments = attachments.map((a: any) => ({
        filename: a.filename || "anhang",
        content: a.content,
        encoding: "base64",
        contentType: a.contentType || "application/octet-stream",
      }));
    }
    await client.send(msg as any);
    await client.close();
    return json({ ok: true });
  } catch (e) {
    return json({ error: String((e && (e as Error).message) || e) }, 500);
  }
});
