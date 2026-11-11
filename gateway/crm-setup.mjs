// One-time CRM setup, safe to repeat: creates the "AI key" record type in Twenty and links it to Company.
//   set -a; . /home/gold/server-platform/gateway/gateway.env; set +a; node gateway/crm-setup.mjs
import fs from 'node:fs/promises';

const base = (process.env.TWENTY_BASE_URL ?? 'http://127.0.0.1:3020').replace(/\/$/, '');
const token = (await fs.readFile(process.env.TWENTY_API_KEY_FILE, 'utf8')).trim();

async function meta(method, path, body) {
  const res = await fetch(`${base}/rest/metadata/${path}`, {
    method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: body && JSON.stringify(body), signal: AbortSignal.timeout(30e3),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${text.slice(0, 300)}`); // Twenty's own message, never our token
  return JSON.parse(text);
}
const objects = async () => Object.values((await meta('GET', 'objects')).data);

let step = '';
try {
  let list = await objects();
  let aiKey = list.find(o => o.nameSingular === 'aiKey');
  if (!aiKey) {
    await meta('POST', 'objects', { nameSingular: 'aiKey', namePlural: 'aiKeys', labelSingular: 'AI key', labelPlural: 'AI keys', description: 'API keys xGold issued to a customer', icon: 'IconKey' });
    list = await objects(); aiKey = list.find(o => o.nameSingular === 'aiKey');
    console.log('Created the AI key record type');
  }
  const have = new Set(aiKey.fields.map(f => f.name));
  if (!have.has('name')) console.log('Warning: the AI key record has no Name field. Add one in Twenty (Settings > Data model > AI keys); staff type the key label there.');
  const add = async field => {
    if (have.has(field.name)) return;
    step = field.label;
    await meta('POST', 'fields', { objectMetadataId: aiKey.id, ...field });
    console.log('Added field:', field.label);
  };
  await add({ type: 'SELECT', name: 'status', label: 'Status', icon: 'IconCircleDot', defaultValue: "'PENDING'",
    options: [{ value: 'PENDING', label: 'Pending', color: 'gray', position: 0 }, { value: 'ACTIVE', label: 'Active', color: 'green', position: 1 }, { value: 'REVOKED', label: 'Revoked', color: 'red', position: 2 }] });
  await add({ type: 'TEXT', name: 'keyPrefix', label: 'Key starts with', icon: 'IconHash', description: 'Filled in by the gateway' });
  await add({ type: 'TEXT', name: 'apiKey', label: 'API key', icon: 'IconKey', description: 'Filled in by the gateway. Give this to the customer.' });
  const company = list.find(o => o.nameSingular === 'company');
  await add({ type: 'RELATION', name: 'company', label: 'Company', icon: 'IconBuildingSkyscraper',
    relationCreationPayload: { type: 'MANY_TO_ONE', targetObjectMetadataId: company.id, targetFieldLabel: 'AI keys', targetFieldIcon: 'IconKey' } });

  const probe = await fetch(`${base}/rest/aiKeys?limit=1`, { headers: { authorization: 'Bearer ' + token } });
  console.log(probe.ok ? 'Ready. In Twenty, open a Company and add a record under AI keys.' : `The AI key record type exists but the API says HTTP ${probe.status}. Check Twenty.`);
} catch (e) {
  console.error('CRM setup stopped:', e.message);
  if (step === 'Company') console.error('If only the Company link failed, add it by hand: Settings > Data model > AI keys > Add field > Relation to Company (many AI keys to one Company), named "company".');
  process.exitCode = 1;
}
