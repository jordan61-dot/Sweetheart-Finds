const tables=['products','listings','observations','product_categories','personal','config','ingestion','discovery_jobs','source_health','match_reviews'] as const;
export async function databaseBackup(database:D1Database,projectId:string){
 // D1 batch runs transactionally: one coherent snapshot, including personal records.
 const results=await database.batch(tables.map(t=>database.prepare('SELECT * FROM '+t)));
 if(results.some(r=>!r.success))throw Error('Backup snapshot failed; no partial export produced');
 return JSON.stringify({format:'sweetheart-d1-backup',version:2,projectId,createdAt:new Date().toISOString(),tables:Object.fromEntries(tables.map((t,i)=>[t,results[i].results]))});
}
