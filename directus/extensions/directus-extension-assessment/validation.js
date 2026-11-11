import { createHash } from 'node:crypto';

const fields = new Set(['name','email','company','role','constraint','workflow','cost','owner','send_questions','source','website','request_id']);
const choices = {
  constraint: ['value','pilot','risk','people','cost'],
  workflow: ['transfers','support','procurement','compliance','other','unsure'],
  owner: ['yes','no',''], send_questions: ['yes','no','']
};
export function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k=>!fields.has(k))) throw new Error('Invalid form fields');
  const text = (key, max, required=false) => {
    const v=body[key] ?? '';
    if(typeof v!=='string' || v.length>max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v) || (required&&!v.trim())) throw new Error('Invalid form fields');
    return v.trim();
  };
  const request_key=text('request_id',36,true);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request_key)) throw new Error('Invalid request identifier');
  const email=text('email',200,true).toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email');
  for(const [key,allowed] of Object.entries(choices)) if(!allowed.includes(text(key,50))) throw new Error('Invalid form choice');
  const data={name:text('name',200,true),email,company:text('company',200,true),role:text('role',200)||null,
    constraint_area:text('constraint',50),workflow:text('workflow',50),cost_today:text('cost',2000)||null,
    has_owner:body.owner==='yes',send_questions:body.send_questions==='yes',source:text('source',500)||null};
  return { request_key, fingerprint:createHash('sha256').update(JSON.stringify(data)).digest('hex'),data,honeypot:!!text('website',500) };
}
