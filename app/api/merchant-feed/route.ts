import {db,apiError,now} from '../../../lib/server';
import {acpState} from '../../../lib/discovery/acp';
import {merchantObservationIsFresh} from '../../../lib/merchant-freshness';

const noStore = {headers:{'Cache-Control':'no-store'}};

async function savedOffers(ids:string[], cutoff:string, lastSuccess?:string) {
  const rows = ids.length ? await db().prepare(
    'SELECT id,data,updated_at FROM merchant_feed_items WHERE id IN ('+ids.map(()=>'?').join(',')+')'
  ).bind(...ids).all<{id:string;data:string;updated_at:string}>() : {results:[]};
  const items = [];
  const unconfirmed = new Set<string>();
  for (const row of rows.results) {
    if (row.updated_at <= cutoff) {
      unconfirmed.add(row.id);
      continue;
    }
    const item=JSON.parse(row.data);
    items.push({id:item.id,url:item.url,observedAt:item.observedAt,
      availability:merchantObservationIsFresh(item.observedAt) ? item.availability : 'stale'});
  }
  if (!(Date.parse(lastSuccess || '') > Date.parse(cutoff))) {
    const current = new Set(items.map(item=>item.id));
    for (const id of ids) if (!current.has(id)) unconfirmed.add(id);
  }
  return Response.json({items,unconfirmedIds:[...unconfirmed]},noStore);
}

export async function GET(request:Request) {
  try {
    const state=await acpState();
    const params=new URL(request.url).searchParams;
    const page=Math.max(1,Math.min(100,Math.trunc(Number(params.get('page')))||1));
    const cutoff=new Date(Date.now()-86400000).toISOString();
    const ids=params.get('ids');
    if (ids !== null) {
      const valid=[...new Set(ids.slice(0,4000).split(',').filter(id=>/^wildmart-wm-\d{1,20}$/.test(id)))].slice(0,60);
      if (state.enabled === false) return Response.json({items:[],unconfirmedIds:valid,total:0,page,pages:0,state:{suspended:true}},noStore);
      return await savedOffers(valid,cutoff,state.lastSuccess);
    }
    if (state.enabled === false) return Response.json({items:[],total:0,page,pages:0,state:{suspended:true}},noStore);
    const where=['updated_at>?'], args:(string|number)[]=[cutoff];
    const category=params.get('category');
    if (category) {
      where.push('EXISTS (SELECT 1 FROM json_each(categories) WHERE value=?)');
      args.push(category);
    }
    const tokens=(params.get('q') || '').trim().slice(0,120).match(/[\p{L}\p{N}]+/gu) || [];
    if (tokens.length) {
      where.push('id IN (SELECT item_id FROM merchant_feed_search WHERE merchant_feed_search MATCH ?)');
      args.push(tokens.slice(0,10).map(t=>'"'+t+'"*').join(' AND '));
    }
    const sql=where.join(' AND ');
    const count=await db().prepare('SELECT COUNT(*) total FROM merchant_feed_items WHERE '+sql).bind(...args).first<{total:number}>();
    const rows=await db().prepare('SELECT data,first_seen FROM merchant_feed_items WHERE '+sql+' ORDER BY first_seen DESC,id LIMIT 24 OFFSET ?')
      .bind(...args,(page-1)*24).all<{data:string;first_seen:string}>();
    const items=rows.results.map(row=>{
      const item=JSON.parse(row.data), fresh=merchantObservationIsFresh(item.observedAt);
      return {...item,price:fresh?item.price:null,availability:fresh?item.availability:'stale',
        image:item.image?.status==='verified'?item.image:null,firstSeen:row.first_seen};
    });
    const total=count?.total || 0;
    return Response.json({items,total,page,pages:Math.ceil(total/24),
      state:{updatedAt:state.updatedAt,lastSuccess:state.lastSuccess,nextAt:state.nextAt,error:state.error || null},at:now()},noStore);
  } catch (error) { return apiError(error); }
}
