import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {recordId,Twenty,synchronize} from './lead-sync.mjs';
import {validate} from '../directus/extensions/directus-extension-assessment/validation.js';

const payload={request_id:randomUUID(),name:'Test Person',email:'test@example.invalid',company:'Fixture Company',constraint:'value',workflow:'support'};
assert.equal(validate(payload).data.has_owner,false);
assert.equal(validate({...payload,owner:'yes'}).data.has_owner,true);
assert.equal(validate(payload).fingerprint,validate({...payload}).fingerprint);
assert.throws(()=>validate({...payload,status:'contacted'}),/Invalid form fields/);
assert.throws(()=>validate({...payload,email:'not an email'}),/Invalid email/);
assert.throws(()=>validate({...payload,constraint:'unrecognized'}),/Invalid form choice/);
assert.throws(()=>validate({...payload,cost:'x'.repeat(2001)}),/Invalid form fields/);
assert.equal(validate({...payload,website:'bot'}).honeypot,true);
assert.equal(recordId('opportunity',payload.request_id),recordId('opportunity',payload.request_id));
assert.notEqual(recordId('note',payload.request_id),recordId('opportunity',payload.request_id));

const row={...validate(payload).data,id:randomUUID(),created_at:new Date().toISOString()};
for(const uncertain of ['companies','people','opportunities','notes','noteTargets']){
 const records=new Map(),creates=new Map(),state={};let interrupted=false;
 const client=new Twenty('http://127.0.0.1:3020','fixture-token',async(url,options)=>{
  const resource=new URL(url).pathname.slice('/rest/'.length);
  assert.equal(options.redirect,'error');
  if(options.method==='GET')return{ok:records.has(resource),status:records.has(resource)?200:404,json:async()=>({data:{getRecord:records.get(resource)}})};
  const data=JSON.parse(options.body),key=resource+'/'+data.id;assert.ok(!records.has(key),'no duplicate create');
  records.set(key,data);creates.set(resource,(creates.get(resource)??0)+1);
  if(resource===uncertain&&!interrupted){interrupted=true;throw Error('fixture: response lost after committed create');}
  return{ok:true,status:201,json:async()=>({data:{createRecord:data}})};
 },0);
 const save=async patch=>Object.assign(state,patch);
 await assert.rejects(synchronize(row,state,client,save),/response lost/);
 await synchronize(row,state,client,save);
 await synchronize(row,state,client,save);
 for(const resource of ['companies','people','opportunities','notes','noteTargets'])assert.equal(creates.get(resource),1);
 assert.equal(records.get('notes/'+state.note_id).bodyV2.markdown.includes(row.id),true);
}
const unauthorized=new Twenty('http://127.0.0.1:3020','fixture',async()=>({ok:false,status:401}));
await assert.rejects(unauthorized.ensure('companies',randomUUID(),{}),/HTTP 401/);
console.log('Assessment/CRM tests passed: strict validation, private fields rejected, idempotency hash, deterministic IDs, durable progress, lost-response retries without duplicate records and authentication failure.');
