import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';

export function recordId(kind, value) {
  const b=createHash('sha256').update('xgold-assessment:'+kind+':'+value).digest().subarray(0,16);
  b[6]=(b[6]&15)|80;b[8]=(b[8]&63)|128;
  const h=b.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
function record(result) {
  const data=result?.data??result;
  if(data?.id)return data;
  for(const value of Object.values(data??{}))if(value?.id)return value;
  throw new Error('CRM returned an unexpected record response');
}
export class Twenty {
  constructor(base,key,fetchImpl=fetch,minGapMs=800) {this.base=base.replace(/\/$/,'');this.key=key;this.fetch=fetchImpl;this.minGapMs=minGapMs;this.nextAt=0;}
  async request(method,path,data) {
    if(this.nextAt>Date.now())await new Promise(r=>setTimeout(r,this.nextAt-Date.now()));
    this.nextAt=Date.now()+this.minGapMs;
    const response=await this.fetch(this.base+'/rest/'+path,{method,redirect:'error',signal:AbortSignal.timeout(20000),
      headers:{Authorization:'Bearer '+this.key,'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
    if(method==='GET'&&response.status===404)return null;
    if(!response.ok)throw new Error('CRM request failed (HTTP '+response.status+')');
    if(response.status===204)return null;
    return response.json();
  }
  async ensure(collection,id,data) {
    const found=await this.request('GET',collection+'/'+id);
    if(found){const item=record(found);if(item.id!==id)throw new Error('CRM record identifier mismatch');return item.id;}
    const item=record(await this.request('POST',collection,{id,...data}));
    if(item.id!==id)throw new Error('CRM did not preserve the supplied id; sync stopped to prevent duplicates');
    return item.id;
  }
}
export async function synchronize(row,state,client,save) {
  const domain=row.email.split('@')[1].toLowerCase();
  const free=new Set(['gmail.com','outlook.com','hotmail.com','yahoo.com','icloud.com','proton.me','protonmail.com','live.com','me.com','aol.com']);
  const corporate=!free.has(domain);
  const company=state.company_id??recordId('company',row.company.trim().toLowerCase()+'|'+(corporate?domain:''));
  if(!state.company_id){await client.ensure('companies',company,{name:row.company,domainName:{primaryLinkUrl:corporate?'https://'+domain:'',primaryLinkLabel:corporate?domain:''}});await save({company_id:company});}
  const person=state.person_id??recordId('person',row.email.toLowerCase());
  if(!state.person_id){const names=row.name.trim().split(/\s+/);await client.ensure('people',person,{name:{firstName:names.shift(),lastName:names.join(' ')},emails:{primaryEmail:row.email.toLowerCase(),additionalEmails:[]},jobTitle:row.role??'',companyId:company});await save({person_id:person});}
  const opportunity=state.opportunity_id??recordId('opportunity',row.id);
  if(!state.opportunity_id){await client.ensure('opportunities',opportunity,{name:'Assessment · '+row.company,stage:'NEW',companyId:company,pointOfContactId:person});await save({opportunity_id:opportunity});}
  const note=state.note_id??recordId('note',row.id);
  if(!state.note_id){
    const body=['Website assessment request','',`Constraint: ${row.constraint_area}`,`Workflow: ${row.workflow}`,`Named owner: ${row.has_owner?'yes':'no'}`,`Send questions first: ${row.send_questions?'yes':'no'}`,row.cost_today?'Current cost: '+row.cost_today:'',row.source?'Source: '+row.source:'','Request: '+row.id].filter(Boolean).join('\n');
    await client.ensure('notes',note,{title:'Website assessment request',bodyV2:{markdown:body,blocknote:null}});await save({note_id:note});
  }
  await client.ensure('noteTargets',recordId('note-target',row.id),{noteId:note,targetOpportunityId:opportunity});
  return {company_id:company,person_id:person,opportunity_id:opportunity,note_id:note};
}

async function main() {
  const {createRequire}=await import('node:module');
  const require=createRequire(process.env.HOMELAB_PACKAGE??'/home/gold/server-platform/homelab-dashboard-src/package.json');
  const pg=require('pg');
  const database=new pg.Client({connectionString:process.env.AI_DATABASE_URL,connectionTimeoutMillis:5000});
  await database.connect();
  const lock=await database.query('SELECT pg_try_advisory_lock(175185,1) AS locked');
  if(!lock.rows[0].locked)throw new Error('A lead-sync worker is already running');
  database.on('error',()=>{console.error('Lead-sync database connection lost');process.exit(1);});
  let waiting=false;
  for(;;){
    let key;
    try{
      const path=process.env.TWENTY_API_KEY_FILE;const mode=(await fs.stat(path)).mode&0o777;
      if(mode!==0o600)throw new Error('API key file must be mode 600');
      key=(await fs.readFile(path,'utf8')).trim();if(key.length<32||/[^\x21-\x7e]/.test(key))throw new Error('Invalid API key file');
    }catch{if(!waiting)console.log('Lead sync waiting for a private CRM API key file');waiting=true;await new Promise(r=>setTimeout(r,10000));continue;}
    waiting=false;
    const pending=await database.query('SELECT request_id FROM assessment_crm_sync WHERE synced_at IS NULL AND next_attempt_at<=now() ORDER BY created_at LIMIT 1');
    if(!pending.rowCount){await new Promise(r=>setTimeout(r,10000));continue;}
    const id=pending.rows[0].request_id;
    const row=(await database.query('SELECT * FROM assessment_requests WHERE id=$1',[id])).rows[0];
    const state=(await database.query('SELECT * FROM assessment_crm_sync WHERE request_id=$1',[id])).rows[0];
    const save=async patch=>{for(const [column,value]of Object.entries(patch)){if(!['company_id','person_id','opportunity_id','note_id'].includes(column))throw new Error('Invalid state column');await database.query(`UPDATE assessment_crm_sync SET ${column}=$1 WHERE request_id=$2`,[value,id]);}};
    try{
      const base=process.env.TWENTY_BASE_URL??'http://127.0.0.1:3020';const url=new URL(base);
      if(url.protocol!=='https:'&&url.hostname!=='127.0.0.1')throw new Error('CRM must use HTTPS or the private loopback endpoint');
      await synchronize(row,state,new Twenty(base,key),save);
      await database.query('UPDATE assessment_crm_sync SET synced_at=now(),last_error=NULL WHERE request_id=$1',[id]);
      console.log('Assessment request synchronized to CRM');
    }catch(error){
      // Never log request bodies, contact details, credentials or upstream bodies.
      const message=/^CRM (request failed \(HTTP \d+\)|did not preserve|returned|record identifier)/.test(error.message)?error.message:'CRM synchronization failed; queued for retry';
      await database.query("UPDATE assessment_crm_sync SET attempts=attempts+1,last_error=$2,next_attempt_at=now()+make_interval(secs=>LEAST(3600,30*power(2,LEAST(attempts,7)))::int) WHERE request_id=$1",[id,message]);
      console.error(message);
    }
  }
}
if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1])main().catch(()=>{console.error('Lead-sync worker stopped; check private configuration and service health');process.exitCode=1;});
