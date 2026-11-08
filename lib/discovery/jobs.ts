import {db,now} from '../server';
import {sourcePolicy} from './registry';
import {sourceAdapters} from './openlibrary';
import {discoveryQueries} from './intelligence';
import {runJob,advanceJob,recoverJob,reserveRequest,type JobDeps} from './job-engine';
const dependencies=():JobDeps=>({database:db(),clock:now,policy:sourcePolicy,request:(source,q,page)=>sourceAdapters[source].search(q,page)});
export async function queueDiscovery(source:string,category:string){if(source!=='openlibrary')throw Error('Source is not eligible for queued collection; review its policy and use external searches.');const q=discoveryQueries(category)[0],id=crypto.randomUUID();const created=await db().prepare('INSERT INTO discovery_jobs(id,source,category,status,query,page,attempts,created_at,updated_at,data) VALUES (?,?,?,?,?,1,0,?,?,?) ON CONFLICT DO NOTHING RETURNING id').bind(id,source,category,'queued',q,now(),now(),'{}').first();return created||await db().prepare("SELECT id FROM discovery_jobs WHERE source=? AND category=? AND status IN ('queued','running','retry','review') LIMIT 1").bind(source,category).first();}
export const runDiscovery=(id:string)=>runJob(dependencies(),id);
export const advanceDiscovery=(id:string)=>advanceJob(dependencies(),id);
export const recoverDiscovery=(id:string)=>recoverJob(dependencies(),id);
export const reserveDiscoveryRequest=(source:string)=>reserveRequest(dependencies(),source);
