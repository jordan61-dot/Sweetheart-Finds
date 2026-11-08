// API amounts are integer minor units, never exchange-rate conversions.
const zero = new Set('BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX UYI VND VUV XAF XOF XPF'.split(' '));
const three = new Set('BHD IQD JOD KWD LYD OMR TND'.split(' '));
const currencies = new Set(Intl.supportedValuesOf('currency'));
export function minorUnitPrice(amount:unknown,currency:unknown):number|null {
 if(typeof currency!=='string'||!currencies.has(currency))return null;
 if(typeof amount!=='number'&&typeof amount!=='string')return null;
 if(typeof amount==='string'&&!/^\d+$/.test(amount))return null;
 const n=Number(amount);if(!Number.isSafeInteger(n)||n<0)return null;
 return n/10**(zero.has(currency)?0:three.has(currency)?3:['CLF','UYW'].includes(currency)?4:2);
}
