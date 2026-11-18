'use client';

import {useEffect,useState} from 'react';
import {useMerchantClock} from './use-merchant-clock';
import {merchantObservationIsFresh} from '../lib/merchant-freshness';
import type {Operation,Personal} from '../lib/domain';

type SaveProps={
  personal:Personal;
  ready:boolean;
  act:(operation:Omit<Operation,'id'>)=>void;
};

export function MerchantSaveControls({id,title,personal,ready,act}:SaveProps&{id:string;title:string}){
  const saved=personal.favorites.includes(id);
  const bookmark={title:title.slice(0,400)};
  return <div className="form-actions">
    <button type="button" className="secondary" disabled={!ready} aria-label={(saved?'Remove favorite: ':'Save favorite: ')+title}
      aria-pressed={saved} onClick={()=>act({kind:'favorite',productId:id,enabled:!saved,value:bookmark})}>
      {saved?'Favorited':'Favorite'}
    </button>
    <select aria-label={'Gift list for '+title} disabled={!ready||!personal.wishlists.length} value=""
      onChange={e=>{const listId=e.target.value;if(listId)act({kind:'wishlist-item',listId,productId:id,enabled:true,value:bookmark});}}>
      <option value="">{personal.wishlists.length?'Add to gift list':'Create a gift list first'}</option>
      {personal.wishlists.map(list=><option key={list.id} value={list.id} disabled={list.products.includes(id)}>
        {list.name}{list.products.includes(id)?' (saved)':''}
      </option>)}
    </select>
  </div>;
}

type LiveOffer={id:string;url:string;availability:string;observedAt:string};
type OfferLookup={items:LiveOffer[];unconfirmedIds?:string[]};

export function SavedMerchantOffers({ids,personal,ready,act,favorites,activeList}:SaveProps&{ids:string[];favorites:boolean;activeList:string}){
  const [page,setPage]=useState(1);
  const pages=Math.ceil(ids.length/24);
  const currentPage=Math.min(page,pages||1);
  const pageIds=ids.slice((currentPage-1)*24,currentPage*24);
  const key=pageIds.join(',');
  const [lookup,setLookup]=useState<OfferLookup & {key:string;failed?:boolean}>();
  const clock=useMerchantClock(lookup?.items);
  useEffect(()=>{
    if(!key)return;
    const controller=new AbortController();
    const refresh=async()=>{
      try{
        const response=await fetch('/api/merchant-feed?'+new URLSearchParams({ids:key}),{signal:controller.signal,cache:'no-store'});
        if(!response.ok)throw Error('Unable to refresh offers');
        const data=await response.json() as OfferLookup;
        if(!controller.signal.aborted)setLookup({key,items:data.items,unconfirmedIds:data.unconfirmedIds});
      }catch{
        if(!controller.signal.aborted)setLookup({key,items:[],failed:true});
      }
    };
    void refresh();
    const timer=setInterval(refresh,60000);
    return ()=>{controller.abort();clearInterval(timer);};
  },[key]);
  if(!ids.length)return null;
  return <section className="external-section" aria-label="Saved retailer offers">
    <h2>Saved retailer offers</h2>
    <div className="merchant-grid">
      {pageIds.map(id=>{
        const offer=lookup?.key===key?lookup.items.find(item=>item.id===id):undefined;
        const title=personal.merchantBookmarks?.[id]?.title||'Saved Wildmart offer';
        const availability=offer && merchantObservationIsFresh(offer.observedAt,clock) ? offer.availability : 'stale';
        const state=offer?(availability==='in_stock'?'Retailer reported in stock':availability==='out_of_stock'?'Retailer reported sold out':'Check stock at Wildmart'):
          lookup?.key!==key?'Checking current offer…':lookup.failed?'Could not check the retailer feed.':lookup.unconfirmedIds?.includes(id)?'The retailer feed cannot currently confirm this offer.':'Offer was absent from the last verified retailer feed.';
        return <article className="merchant-card" key={id}><div className="merchant-copy">
          <h3>{title}</h3><p>{state}</p>
          {offer&&<a className="text-link" href={offer.url} target="_blank" rel="noreferrer">Visit Wildmart ↗</a>}
          <button className="secondary" disabled={!ready} onClick={()=>{
            if(favorites)act({kind:'favorite',productId:id,enabled:false});
            else for(const list of personal.wishlists){
              if((!activeList||list.id===activeList)&&list.products.includes(id))act({kind:'wishlist-item',listId:list.id,productId:id,enabled:false});
            }
          }}>{favorites?'Remove favorite':activeList?'Remove from list':'Remove from all gift lists'}</button>
        </div></article>;
      })}
    </div>
    {pages>1&&<div className="form-actions">
      <button className="secondary" disabled={currentPage<=1} onClick={()=>setPage(currentPage-1)}>Previous offers</button>
      <span>Page {currentPage} of {pages}</span>
      <button className="secondary" disabled={currentPage>=pages} onClick={()=>setPage(currentPage+1)}>More offers</button>
    </div>}
  </section>;
}
