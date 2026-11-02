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
  async update(collection,id,data) {
    const item=record(await this.request('PATCH',collection+'/'+id,data));
    if(item.id!==id)throw new Error('CRM record identifier mismatch');
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

/* ---- Website activity: Umami visits onto the Twenty Person (crm/VISITOR-TRACKING.md) ----
   Sessions are matched by the request_id that book.js passes to umami.identify. Only the
   submitting browser knew that id, so a forged identify with someone's email cannot attach
   a stranger's visits to their record. */
export const UMAMI_WEBSITE_ID='5d539dd6-0f8a-4aba-bcf9-4c824209c159';
const MINUTE=60e3,HOUR=60*MINUTE,DAY=24*HOUR;
const iso=value=>new Date(value).toISOString();
const plain=(value,max)=>String(value??'').replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/[[\]<>`\\]/g,'').replace(/\s+/g,' ').trim().slice(0,max);

export async function websiteActivity(query,websiteId,{requestKeys,requestedAt}) {
  const sessions=(await query(`SELECT DISTINCT session_id FROM session_data
    WHERE website_id=$1 AND data_key='request_id' AND string_value=ANY($2::text[])`,[websiteId,requestKeys])).map(r=>r.session_id);
  if(!sessions.length)return null;
  const scope='FROM website_event WHERE website_id=$1 AND session_id=ANY($2::uuid[])';
  const [totals]=await query(`SELECT min(created_at) AS first_seen,max(created_at) AS last_seen,
    count(DISTINCT visit_id)::int AS visits,(count(*) FILTER (WHERE event_type=1))::int AS pageviews ${scope}`,[websiteId,sessions]);
  if(!totals?.last_seen)return null;
  const [entry]=await query(`SELECT url_path,referrer_domain,utm_source,utm_medium,utm_campaign ${scope} AND event_type=1 ORDER BY created_at LIMIT 1`,[websiteId,sessions]);
  const [latest]=await query(`SELECT session_id ${scope} ORDER BY created_at DESC LIMIT 1`,[websiteId,sessions]);
  const pages=(await query(`SELECT created_at,url_path,page_title ${scope} AND event_type=1 AND created_at<=$3 ORDER BY created_at DESC LIMIT 50`,[websiteId,sessions,iso(requestedAt)])).reverse();
  return {sessions,latestSession:latest.session_id,firstSeen:iso(totals.first_seen),lastSeen:iso(totals.last_seen),
    visits:Number(totals.visits),pageviews:Number(totals.pageviews),entry:entry??null,
    pages:pages.map(p=>({at:iso(p.created_at),path:p.url_path,title:p.page_title}))};
}
export function entrySource(entry) {
  if(!entry)return '';
  const from=[entry.utm_source,entry.utm_medium,entry.utm_campaign].filter(Boolean).join(' / ')||entry.referrer_domain||'Direct';
  return plain(from+' → '+(entry.url_path||'/'),250);
}
export function sessionUrl(publicUrl,websiteId,sessionId) {
  return publicUrl.replace(/\/$/,'')+'/websites/'+websiteId+'/sessions/'+sessionId;
}
/* Field API names follow Twenty's camelCase of the labels in VISITOR-TRACKING.md */
export function personPatch(activity,publicUrl,websiteId) {
  return {websiteFirstSeen:activity.firstSeen,websiteLastSeen:activity.lastSeen,websiteVisits:activity.visits,
    websitePageviews:activity.pageviews,websiteEntrySource:entrySource(activity.entry),
    websiteActivity:{primaryLinkUrl:sessionUrl(publicUrl,websiteId,activity.latestSession),primaryLinkLabel:'Umami session'}};
}
export function activityNote(activity,link) {
  const when=value=>value.slice(0,16).replace('T',' ')+' UTC';
  const lines=['Website activity before this request','',
    `First seen ${when(activity.firstSeen)} · ${activity.visits} visit${activity.visits===1?'':'s'} · ${activity.pageviews} pageview${activity.pageviews===1?'':'s'} so far`,
    'Entry: '+(entrySource(activity.entry)||'unknown'),''];
  for(const page of activity.pages)lines.push(`- ${when(page.at)} · ${plain(page.path,200)}${page.title?' · '+plain(page.title,120):''}`);
  if(!activity.pages.length)lines.push('- No pageviews recorded before the request.');
  lines.push('','Full history: '+link);
  return lines.join('\n');
}
/* One refresh for the newest request of a person. Returns when to look again (null = done). */
export async function syncWebActivity(row,state,client,lookup,save,{websiteId=UMAMI_WEBSITE_ID,publicUrl,now=new Date()}) {
  const activity=await lookup();
  if(!activity){
    // umami.identify lands a moment after the request is stored; nothing new appears after that
    return {found:false,next:now-new Date(row.created_at)<HOUR?new Date(now.getTime()+2*MINUTE):null};
  }
  const patch=personPatch(activity,publicUrl,websiteId);
  const fingerprint=createHash('sha256').update(JSON.stringify(patch)).digest('hex');
  if(fingerprint!==state.web_fingerprint){await client.update('people',state.person_id,patch);await save({web_fingerprint:fingerprint});}
  if(!state.web_note_id){
    const note=recordId('web-note',row.id);
    await client.ensure('notes',note,{title:'Website activity before request',bodyV2:{markdown:activityNote(activity,patch.websiteActivity.primaryLinkUrl),blocknote:null}});
    await client.ensure('noteTargets',recordId('web-note-person',row.id),{noteId:note,targetPersonId:state.person_id});
    if(state.opportunity_id)await client.ensure('noteTargets',recordId('web-note-opportunity',row.id),{noteId:note,targetOpportunityId:state.opportunity_id});
    await save({web_note_id:note});
  }
  const idle=now-new Date(activity.lastSeen);
  return {found:true,next:new Date(now.getTime()+(idle<7*DAY?30*MINUTE:DAY))};
}

const WEB_COLUMNS=['web_next_check_at','web_fingerprint','web_note_id','web_last_error'];
const WEB_DUE=`SELECT s.request_id,s.person_id,s.opportunity_id,s.web_fingerprint,s.web_note_id,r.id,r.created_at,
  (SELECT array_agg(o.request_key::text) FROM assessment_requests o WHERE o.email=r.email) AS request_keys
  FROM assessment_crm_sync s JOIN assessment_requests r ON r.id=s.request_id
  WHERE s.synced_at IS NOT NULL AND s.person_id IS NOT NULL AND s.web_next_check_at<=now()
    AND NOT EXISTS (SELECT 1 FROM assessment_requests n WHERE n.email=r.email AND n.created_at>r.created_at)
  ORDER BY s.web_next_check_at LIMIT 5`;
const safeMessage=error=>/^CRM (request failed \(HTTP \d+\)|did not preserve|returned|record identifier)/.test(error?.message??'')?error.message:null;
function crmBase() {
  const base=process.env.TWENTY_BASE_URL??'http://127.0.0.1:3020';const url=new URL(base);
  if(url.protocol!=='https:'&&url.hostname!=='127.0.0.1')throw new Error('CRM must use HTTPS or the private loopback endpoint');
  return base;
}
/* Returns a step function, or null when website activity is not configured */
export async function websiteActivitySync(database,pg,env=process.env) {
  if(!env.UMAMI_DATABASE_URL){console.log('Website activity sync off: UMAMI_DATABASE_URL is not set');return null;}
  const present=(await database.query("SELECT column_name FROM information_schema.columns WHERE table_name='assessment_crm_sync' AND column_name=ANY($1)",[WEB_COLUMNS])).rows.length;
  if(present!==WEB_COLUMNS.length){console.log('Website activity sync off: apply directus/assessment-schema.sql to add the web_* columns');return null;}
  const websiteId=env.UMAMI_WEBSITE_ID||UMAMI_WEBSITE_ID,publicUrl=env.UMAMI_PUBLIC_URL||'https://crm.xgold.tech/stats';
  let umami=null,pausedUntil=0;
  const query=async(sql,params)=>{
    if(!umami){
      const c=new pg.Client({connectionString:env.UMAMI_DATABASE_URL,connectionTimeoutMillis:5000,statement_timeout:15000,application_name:'xgold-lead-sync'});
      c.on('error',()=>{if(umami===c)umami=null;});
      await c.connect();umami=c;
    }
    try{return (await umami.query(sql,params)).rows;}
    catch(error){const c=umami;umami=null;c?.end().catch(()=>{});throw error;}
  };
  console.log('Website activity sync on');
  return async function step(key) {
    if(Date.now()<pausedUntil)return;
    try{
      const due=(await database.query(WEB_DUE)).rows;
      const client=due.length?new Twenty(crmBase(),key):null; // one client keeps the API pacing across rows
      for(const row of due){
        const save=async patch=>{for(const [column,value]of Object.entries(patch)){if(!['web_fingerprint','web_note_id'].includes(column))throw new Error('Invalid state column');await database.query(`UPDATE assessment_crm_sync SET ${column}=$1 WHERE request_id=$2`,[value,row.request_id]);}};
        try{
          const lookup=()=>websiteActivity(query,websiteId,{requestKeys:row.request_keys,requestedAt:row.created_at});
          const result=await syncWebActivity(row,row,client,lookup,save,{websiteId,publicUrl});
          await database.query('UPDATE assessment_crm_sync SET web_next_check_at=$2,web_last_error=NULL WHERE request_id=$1',[row.request_id,result.next]);
          if(result.found)console.log('Website activity synchronized to CRM');
        }catch(error){
          // Same rule as leads: no contact details, URLs, credentials or upstream bodies in logs.
          const message=safeMessage(error)??'Website activity lookup failed; will retry';
          await database.query("UPDATE assessment_crm_sync SET web_last_error=$2,web_next_check_at=now()+interval '1 hour' WHERE request_id=$1",[row.request_id,message]);
          console.error('Website activity sync: '+message);
          pausedUntil=Date.now()+5*MINUTE;break;
        }
      }
    }catch{console.error('Website activity sync: state query failed; will retry');pausedUntil=Date.now()+5*MINUTE;}
  };
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
  const webStep=await websiteActivitySync(database,pg);
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
    // Leads first; website activity only runs when no lead is waiting and never blocks one.
    if(!pending.rowCount){if(webStep)await webStep(key);await new Promise(r=>setTimeout(r,10000));continue;}
    const id=pending.rows[0].request_id;
    const row=(await database.query('SELECT * FROM assessment_requests WHERE id=$1',[id])).rows[0];
    const state=(await database.query('SELECT * FROM assessment_crm_sync WHERE request_id=$1',[id])).rows[0];
    const save=async patch=>{for(const [column,value]of Object.entries(patch)){if(!['company_id','person_id','opportunity_id','note_id'].includes(column))throw new Error('Invalid state column');await database.query(`UPDATE assessment_crm_sync SET ${column}=$1 WHERE request_id=$2`,[value,id]);}};
    try{
      await synchronize(row,state,new Twenty(crmBase(),key),save);
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
