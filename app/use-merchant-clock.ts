'use client';
import {useEffect,useReducer} from 'react';
import {merchantObservationLifetime} from '../lib/merchant-freshness';

// Expire visible prices even when the next network request is delayed or the tab was asleep.
export function useMerchantClock(offers?: {observedAt:string}[]) {
  const [,refresh] = useReducer((n:number) => n+1,0);
  const clock = Date.now();
  let next = Infinity;
  for (const offer of offers || []) {
    const expiry = Date.parse(offer.observedAt) + merchantObservationLifetime;
    if (expiry > clock && expiry < next) next = expiry;
  }
  useEffect(() => {
    if (!Number.isFinite(next)) return;
    const timer = window.setTimeout(refresh,Math.max(0,next-Date.now()));
    document.addEventListener('visibilitychange',refresh);
    window.addEventListener('pageshow',refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange',refresh);
      window.removeEventListener('pageshow',refresh);
    };
  },[next]);
  return clock;
}
