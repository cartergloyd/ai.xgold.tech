import { createHash } from 'node:crypto';
import { validate } from './validation.js';

export default {
  id:'assessment',
  handler(router,{database,logger,env}) {
    const origins=new Set(['https://www.xgold.tech','https://xgold.tech','https://ai.xgold.tech']);
    const windows=new Map();
    router.post('/requests',async(req,res)=>{
      res.set('Cache-Control','no-store');
      const origin=req.get('origin');
      if(origin&&!origins.has(origin)) return res.status(403).json({error:'Origin not allowed'});
      let form;try{form=validate(req.body);}catch{return res.status(400).json({error:'Check the form fields and try again.'});}
      if(form.honeypot)return res.status(202).json({ok:true});
      // Cloudflare overwrites this header at the edge. Local access remains loopback-only.
      const ip=req.get('cf-connecting-ip')||req.ip||'unknown';
      const key=createHash('sha256').update(String(env.SECRET)+ip).digest('hex');
      const now=Date.now();for(const [k,v]of windows)if(v.until<=now)windows.delete(k);
      let window=windows.get(key);
      if(!window&&windows.size<10000){window={until:now+60000,count:0};windows.set(key,window);}
      if(!window||++window.count>5){res.set('Retry-After','60');return res.status(429).json({error:'Please wait a minute before trying again.'});}
      try{
        const result=await database.transaction(async trx=>{
          const inserted=await trx('assessment_requests').insert({...form.data,request_key:form.request_key,fingerprint:form.fingerprint}).onConflict('request_key').ignore().returning('id');
          if(!inserted.length){const prior=await trx('assessment_requests').select('fingerprint').where({request_key:form.request_key}).first();return prior?.fingerprint===form.fingerprint;}
          await trx('assessment_crm_sync').insert({request_id:inserted[0].id});
          return true;
        });
        if(!result)return res.status(409).json({error:'This request identifier was already used. Reload the form for a new request.'});
        // Acknowledge durable local storage; CRM synchronization happens privately afterwards.
        return res.status(202).json({ok:true});
      }catch{
        logger.error('Assessment intake failed; no success acknowledged.');
        return res.status(503).json({error:'Could not save your request. Please try again shortly.'});
      }
    });
  }
};
