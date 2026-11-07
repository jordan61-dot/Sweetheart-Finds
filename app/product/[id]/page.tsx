import {renderApp,type Query} from '../../render-app';
export const dynamic='force-dynamic';
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Query>}){return renderApp('/product/'+(await params).id,await searchParams);}
