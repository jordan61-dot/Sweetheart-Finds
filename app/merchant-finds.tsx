'use client';
import {useEffect,useState} from 'react';
import {MerchantSaveControls} from './merchant-saves';
import {useMerchantClock} from './use-merchant-clock';
import {merchantObservationIsFresh} from '../lib/merchant-freshness';
import type {Operation,Personal} from '../lib/domain';

type Offer = {
  id:string; title:string; url:string; price:number|null; availability:string; observedAt:string;
  sourceProductId:string; variantId:string; image:{url:string; checkedAt:string; permission:string}|null;
};
type FeedPage = {
  items:Offer[]; page:number; pages:number; total:number;
  state:{suspended?:boolean; lastSuccess?:string; error?:string};
};
type Props = {
  category?:string; query?:string; personal:Personal; ready:boolean;
  act:(op:Omit<Operation,'id'>)=>void;
};
const mdl = new Intl.NumberFormat('en-US',{style:'currency',currency:'MDL'});

function stockLabel(stock:string) {
  if (stock==='stale') return 'Stock needs a fresh retailer check';
  if (stock==='in_stock') return 'Retailer reported in stock';
  if (stock==='out_of_stock') return 'Retailer reported sold out';
  return stock;
}

export default function MerchantFinds({category='',query='',personal,ready,act}:Props) {
  const [page,setPage]=useState(1);
  const key=new URLSearchParams({category,q:query,page:String(page)}).toString();
  const [result,setResult]=useState<{key:string; data?:FeedPage; error?:string}>();
  const data=result?.key===key ? result.data : undefined;
  const error=result?.key===key ? result.error : undefined;
  const clock=useMerchantClock(data?.items);
  useEffect(()=>setPage(1),[category,query]);
  useEffect(()=>{
    const controller=new AbortController();
    let timer:ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const response=await fetch('/api/merchant-feed?'+key,{signal:controller.signal,cache:'no-store'});
        const body=await response.json() as FeedPage & {error?:string};
        if (!response.ok) throw Error(body.error || 'Collection unavailable');
        if (!controller.signal.aborted) setResult({key,data:body});
      } catch (failure) {
        if (!controller.signal.aborted) setResult({key,error:failure instanceof Error?failure.message:'Collection unavailable'});
      } finally {
        if (!controller.signal.aborted) timer=setTimeout(refresh,60000);
      }
    }
    void refresh();
    return ()=>{controller.abort();clearTimeout(timer);};
  },[key]);
  return <section className="external-section" aria-label="Automatically collected merchandise">
    <div className="section-heading"><div>
      <span className="eyebrow">THE CABINET KEEPS GROWING</span><h2>Automatically discovered finds</h2>
      <p>Wildmart’s official product feed, collected on a recurring schedule. Save offers to your favorites or gift lists.</p>
    </div></div>
    {error ? <p role="alert">{error}</p> : !data ? <p>Opening the latest collection…</p> :
      data.state.suspended ? <p role="status">Wildmart collection is paused.</p> : <>
        <p className="small muted">{data.total} matching offers · Collected {data.state.lastSuccess?new Date(data.state.lastSuccess).toLocaleString():'awaiting the first successful run'} · Moldova retailer; US delivery is unconfirmed. Prices are MDL. Stock and final cost must be checked at the retailer.</p>
        {data.state.error && <p role="status">The last refresh failed. Previous results are retained with their original timestamps.</p>}
        <div className="merchant-grid">{data.items.map(offer=>{
          const fresh=merchantObservationIsFresh(offer.observedAt,clock);
          return <article className="merchant-card" key={offer.id}>
            {offer.image ? <a href={offer.url} target="_blank" rel="noreferrer">
              <img src={offer.image.url} alt={offer.title} loading="lazy" referrerPolicy="no-referrer" onError={event=>{event.currentTarget.style.display='none';}}/>
            </a> : <div className="merchant-placeholder">Photograph awaiting verification</div>}
            <div className="merchant-copy">
              <h3>{offer.title}</h3>
              <p>{fresh && offer.price!==null ? mdl.format(offer.price) : 'Check current price at Wildmart'}</p>
              <p>{stockLabel(fresh ? offer.availability : 'stale')}</p>
              <small>Source observation: {new Date(offer.observedAt).toLocaleString()}</small>
              <a className="text-link" href={offer.url} target="_blank" rel="noreferrer">Check item, variants &amp; delivery at Wildmart ↗</a>
              <MerchantSaveControls id={offer.id} title={offer.title} personal={personal} ready={ready} act={act}/>
              {offer.image && <details><summary>Photograph provenance</summary>
                <p>Merchant-supplied image for {offer.sourceProductId}, variant {offer.variantId}. Automatically checked {new Date(offer.image.checkedAt).toLocaleString()}. Remote reference; no local image copy.</p>
                <a href={offer.image.permission} target="_blank" rel="noreferrer">Merchant feed documentation</a>
              </details>}
            </div>
          </article>;
        })}</div>
        {!data.items.length && <p>No current feed matches for this collection yet. Existing catalog records and retailer searches remain available.</p>}
        {data.pages>1 && <div className="form-actions">
          <button className="secondary" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous finds</button>
          <span>Page {page} of {data.pages}</span>
          <button className="secondary" disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)}>More automatic finds</button>
        </div>}
      </>}
  </section>;
}
