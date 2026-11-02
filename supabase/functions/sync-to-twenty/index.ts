// sync-to-twenty — Supabase Edge Function
//
// Called by a Database Webhook on INSERT into public.assessment_requests.
// Creates, in Twenty: a Company (matched by email domain or name), a Person,
// an Opportunity in stage NEW, and a Note holding the submission details.
// Then marks the Supabase row as synced so retries do not create duplicates.
//
// Secrets (Dashboard → Edge Functions → Secrets):
//   TWENTY_API_URL   e.g. https://crm.xgold.tech        (no trailing slash)
//   TWENTY_API_KEY   from Twenty → Settings → Developers → API
//   SYNC_SECRET      any long random string; the webhook sends it as x-sync-secret
// Provided automatically: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

type Row = {
  id: string; created_at: string; name: string; email: string; company: string;
  role: string | null; constraint_area: string; workflow: string; cost_today: string | null;
  has_owner: boolean; send_questions: boolean; source: string | null; status: string;
  synced_to_twenty_at?: string | null;
};

const TWENTY_URL = Deno.env.get("TWENTY_API_URL")?.replace(/\/$/, "") ?? "";
const TWENTY_KEY = Deno.env.get("TWENTY_API_KEY") ?? "";
const SYNC_SECRET = Deno.env.get("SYNC_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CONSTRAINT: Record<string, string> = {
  value: "We cannot establish ROI", pilot: "Our pilots have not scaled", risk: "We lack safe AI controls",
  people: "Employees need better workflows", cost: "Agent costs or reliability are unclear",
};
const WORKFLOW: Record<string, string> = {
  transfers: "Employee transfers or onboarding", support: "Customer support escalations",
  procurement: "Procurement exceptions", compliance: "Compliance document review", other: "Another workflow", unsure: "Not sure yet",
};
const FREE_MAIL = new Set(["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "proton.me", "protonmail.com", "live.com", "me.com", "aol.com"]);

async function twenty(path: string, init: RequestInit = {}) {
  const res = await fetch(`${TWENTY_URL}/rest/${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TWENTY_KEY}`, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* leave null */ }
  if (!res.ok) throw new Error(`Twenty ${init.method ?? "GET"} ${path} → ${res.status} ${text.slice(0, 300)}`);
  return json;
}
/** REST create responses look like { data: { createPerson: {...} } }. Return the first record with an id. */
function created(json: any) {
  const d = json?.data ?? json;
  if (d?.id) return d;
  for (const v of Object.values(d ?? {})) if ((v as any)?.id) return v as any;
  throw new Error("Unexpected Twenty response: " + JSON.stringify(json).slice(0, 200));
}
function list(json: any): any[] {
  const d = json?.data ?? json;
  if (Array.isArray(d)) return d;
  for (const v of Object.values(d ?? {})) if (Array.isArray(v)) return v;
  return [];
}
const split = (full: string) => {
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
};

async function findOrCreateCompany(row: Row) {
  const domain = row.email.split("@")[1]?.toLowerCase() ?? "";
  const corporate = domain && !FREE_MAIL.has(domain);
  if (corporate) {
    const byDomain = list(await twenty(`companies?limit=1&filter=${encodeURIComponent(`domainName.primaryLinkUrl[like]:"%${domain}%"`)}`));
    if (byDomain[0]) return byDomain[0];
  }
  const byName = list(await twenty(`companies?limit=1&filter=${encodeURIComponent(`name[ilike]:"${row.company.replace(/"/g, "")}"`)}`));
  if (byName[0]) return byName[0];
  return created(await twenty("companies", {
    method: "POST",
    body: JSON.stringify({
      name: row.company,
      domainName: corporate ? { primaryLinkUrl: `https://${domain}`, primaryLinkLabel: domain } : { primaryLinkUrl: "", primaryLinkLabel: "" },
    }),
  }));
}

async function findOrCreatePerson(row: Row, companyId: string) {
  const existing = list(await twenty(`people?limit=1&filter=${encodeURIComponent(`emails.primaryEmail[eq]:"${row.email.toLowerCase()}"`)}`));
  if (existing[0]) return existing[0];
  return created(await twenty("people", {
    method: "POST",
    body: JSON.stringify({
      name: split(row.name),
      emails: { primaryEmail: row.email.toLowerCase(), additionalEmails: [] },
      jobTitle: row.role ?? "",
      companyId,
    }),
  }));
}

function noteMarkdown(row: Row) {
  return [
    `**Assessment request** from the website, ${new Date(row.created_at).toISOString().slice(0, 16).replace("T", " ")} UTC`,
    "",
    `- **Constraint:** ${CONSTRAINT[row.constraint_area] ?? row.constraint_area}`,
    `- **Workflow:** ${WORKFLOW[row.workflow] ?? row.workflow}`,
    `- **Named owner already:** ${row.has_owner ? "yes" : "no"}`,
    `- **Wants the five questions first:** ${row.send_questions ? "yes" : "no"}`,
    row.cost_today ? `- **What it costs today:** ${row.cost_today}` : null,
    row.source ? `- **Source:** ${row.source}` : null,
    "",
    `Supabase row: ${row.id}`,
  ].filter((l) => l !== null).join("\n");
}

async function markSynced(row: Row, opportunityId: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/assessment_requests?id=eq.${row.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: "return=minimal" },
    body: JSON.stringify({ synced_to_twenty_at: new Date().toISOString(), twenty_opportunity_id: opportunityId }),
  });
  if (!res.ok) console.warn("markSynced failed", res.status, await res.text());
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  if (!SYNC_SECRET || req.headers.get("x-sync-secret") !== SYNC_SECRET) return new Response("forbidden", { status: 403 });
  if (!TWENTY_URL || !TWENTY_KEY) return new Response("Twenty not configured", { status: 500 });

  const payload = await req.json().catch(() => null);
  const row: Row | undefined = payload?.record;
  if (payload?.type !== "INSERT" || !row?.id) return new Response("ignored", { status: 200 });
  if (row.synced_to_twenty_at) return new Response("already synced", { status: 200 });

  try {
    const company = await findOrCreateCompany(row);
    const person = await findOrCreatePerson(row, company.id);
    const opportunity = created(await twenty("opportunities", {
      method: "POST",
      body: JSON.stringify({ name: `Assessment · ${row.company}`, stage: "NEW", companyId: company.id, pointOfContactId: person.id }),
    }));
    const note = created(await twenty("notes", {
      method: "POST",
      body: JSON.stringify({ title: "Website assessment request", bodyV2: { markdown: noteMarkdown(row), blocknote: null } }),
    }));
    await twenty("noteTargets", {
      method: "POST",
      body: JSON.stringify({ noteId: note.id, targetOpportunityId: opportunity.id }),
    });
    await markSynced(row, opportunity.id);
    return Response.json({ ok: true, companyId: company.id, personId: person.id, opportunityId: opportunity.id });
  } catch (err) {
    console.error(err);
    return new Response(String(err), { status: 502 });
  }
});
