import SweetheartApp from './sweetheart-app';
import { getChatGPTUser } from './chatgpt-auth';
export type Query=Record<string,string|string[]|undefined>;
export async function renderApp(path:string,query:Query={}){const user=await getChatGPTUser();const params=new URLSearchParams();for(const [key,value] of Object.entries(query)){if(Array.isArray(value))value.forEach(v=>params.append(key,v));else if(value!==undefined)params.set(key,value);}return <SweetheartApp userId={user?.userId||null} initialPath={path} initialSearch={params.size?'?'+params:''}/>;}
