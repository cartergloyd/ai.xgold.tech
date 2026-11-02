import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {recordId,Twenty,synchronize,websiteActivity,entrySource,personPatch,activityNote,syncWebActivity,websiteActivitySync,UMAMI_WEBSITE_ID} from './lead-sync.mjs';
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

/* ---- Website activity ---- */
const site=UMAMI_WEBSITE_ID,stats='https://crm.xgold.tech/stats/';
const activity={sessions:['5a3c6c1e-0000-4000-8000-000000000001'],latestSession:'5a3c6c1e-0000-4000-8000-000000000001',
 firstSeen:'2026-11-01T10:00:00.000Z',lastSeen:'2026-11-02T09:00:00.000Z',visits:3,pageviews:7,
 entry:{url_path:'/solutions.html',referrer_domain:'google.com',utm_source:null,utm_medium:null,utm_campaign:null},
 pages:[{at:'2026-11-01T10:00:00.000Z',path:'/how-we-work.html#process',title:'How we work [x](javascript:alert(1)) <img src=x> `code`'}]};
assert.equal(entrySource(activity.entry),'google.com → /solutions.html');
assert.equal(entrySource({url_path:'/',utm_source:'linkedin',utm_medium:'social',utm_campaign:'fall'}),'linkedin / social / fall → /');
assert.equal(entrySource({url_path:''}),'Direct → /');
const patch=personPatch(activity,stats,site);
assert.deepEqual(Object.keys(patch),['websiteFirstSeen','websiteLastSeen','websiteVisits','websitePageviews','websiteEntrySource','websiteActivity']);
assert.equal(patch.websiteActivity.primaryLinkUrl,`https://crm.xgold.tech/stats/websites/${site}/sessions/${activity.latestSession}`);
const markdown=activityNote(activity,patch.websiteActivity.primaryLinkUrl);
assert.ok(!/[[\]<>`]/.test(markdown.replace(patch.websiteActivity.primaryLinkUrl,'')),'visitor-supplied titles cannot form links, HTML or code');
assert.ok(markdown.includes('/how-we-work.html#process')&&markdown.includes('3 visits · 7 pageviews'));

// websiteActivity matches sessions by request_id only (an identify with a guessed email cannot attach visits)
const calls=[];
const fakeUmami=sessions=>async(sql,params)=>{calls.push({sql,params});
 if(sql.includes('FROM session_data'))return sessions.map(session_id=>({session_id}));
 if(sql.includes('min(created_at)'))return[{first_seen:new Date(activity.firstSeen),last_seen:new Date(activity.lastSeen),visits:3,pageviews:'7'}];
 if(sql.includes('referrer_domain'))return[activity.entry];
 if(sql.includes('DESC LIMIT 1'))return[{session_id:sessions[0]}];
 return[{created_at:new Date('2026-11-01T10:05:00Z'),url_path:'/book.html',page_title:'Start an assessment'},{created_at:new Date('2026-11-01T10:00:00Z'),url_path:'/',page_title:'Home'}];
};
assert.equal(await websiteActivity(fakeUmami([]),site,{requestKeys:[payload.request_id],requestedAt:new Date()}),null);
const found=await websiteActivity(fakeUmami(activity.sessions),site,{requestKeys:[payload.request_id],requestedAt:new Date('2026-11-01T10:06:00Z')});
assert.ok(calls[0].sql.includes("data_key='request_id'")&&!calls[0].sql.includes('email'));
assert.deepEqual(calls[0].params,[site,[payload.request_id]]);
assert.equal(found.pageviews,7);assert.equal(found.lastSeen,activity.lastSeen);
assert.deepEqual(found.pages.map(p=>p.path),['/','/book.html'],'pages listed oldest first');

// syncWebActivity: patch once per change, one note with person + opportunity targets, retries without duplicates
const people=new Map(),made=new Map();let patches=0,dropOnce='noteTargets';
const crm=new Twenty('http://127.0.0.1:3020','fixture-token',async(url,options)=>{
 const resource=new URL(url).pathname.slice('/rest/'.length);
 if(options.method==='GET'){const hit=people.get(resource)??made.get(resource);return{ok:!!hit,status:hit?200:404,json:async()=>({data:{record:hit}})};}
 const data=JSON.parse(options.body);
 if(options.method==='PATCH'){patches++;const merged={...people.get(resource),...data};people.set(resource,merged);return{ok:true,status:200,json:async()=>({data:{updatePerson:merged}})};}
 const key=resource+'/'+data.id;assert.ok(!made.has(key),'no duplicate create');made.set(key,data);
 if(resource===dropOnce){dropOnce=null;throw Error('fixture: response lost after committed create');}
 return{ok:true,status:201,json:async()=>({data:{createRecord:data}})};
},0);
const personId=recordId('person',row.email),webState={person_id:personId,opportunity_id:recordId('opportunity',row.id)};
people.set('people/'+personId,{id:personId});
const webSave=async patch=>Object.assign(webState,patch);
const at=new Date('2026-11-02T10:00:00Z');
const options={websiteId:site,publicUrl:stats,now:at};
await assert.rejects(syncWebActivity(row,webState,crm,async()=>activity,webSave,options),/response lost/);
const first=await syncWebActivity(row,webState,crm,async()=>activity,webSave,options);
assert.equal(first.next.getTime(),at.getTime()+30*60e3,'active people refresh every 30 minutes');
assert.equal(people.get('people/'+personId).websiteVisits,3);
assert.equal([...made.keys()].filter(k=>k.startsWith('notes/')).length,1);
assert.deepEqual([...made.values()].filter(v=>v.noteId===webState.web_note_id).map(v=>v.targetPersonId??v.targetOpportunityId).sort(),[webState.opportunity_id,personId].sort());
const patchesBefore=patches;
await syncWebActivity(row,webState,crm,async()=>activity,webSave,options);
assert.equal(patches,patchesBefore,'unchanged activity sends no PATCH');
await syncWebActivity(row,webState,crm,async()=>({...activity,visits:4}),webSave,options);
assert.equal(patches,patchesBefore+1);assert.equal(people.get('people/'+personId).websiteVisits,4);
const quiet=await syncWebActivity(row,webState,crm,async()=>({...activity,lastSeen:'2026-10-01T00:00:00.000Z'}),webSave,options);
assert.equal(quiet.next.getTime(),at.getTime()+24*3600e3,'quiet people refresh daily');
const fresh={...row,created_at:new Date(at.getTime()-10*60e3).toISOString()};
assert.equal((await syncWebActivity(fresh,{},crm,async()=>null,webSave,options)).next.getTime(),at.getTime()+2*60e3,'identify not landed yet: retry soon');
const stale={...row,created_at:new Date(at.getTime()-2*3600e3).toISOString()};
assert.equal((await syncWebActivity(stale,{},crm,async()=>null,webSave,options)).next,null,'no sessions after an hour: stop');
const failing=new Twenty('http://127.0.0.1:3020','fixture',async()=>({ok:false,status:400}),0);
await assert.rejects(syncWebActivity(row,{person_id:personId},failing,async()=>activity,webSave,options),/HTTP 400/,'missing People fields surface as a CRM error');

// Off unless configured and migrated
const quietLog=console.log;console.log=()=>{};
assert.equal(await websiteActivitySync({query:async()=>({rows:[]})},{},{}),null);
assert.equal(await websiteActivitySync({query:async()=>({rows:[{},{}]})},{},{UMAMI_DATABASE_URL:'postgres://x'}),null);
console.log=quietLog;

console.log('Assessment/CRM tests passed: strict validation, private fields rejected, idempotency hash, deterministic IDs, durable progress, lost-response retries without duplicate records and authentication failure.');
console.log('Website activity tests passed: request_id-only session matching, sanitized notes, field mapping, change-only PATCH, note targets without duplicates, refresh schedule and off-by-default setup.');
