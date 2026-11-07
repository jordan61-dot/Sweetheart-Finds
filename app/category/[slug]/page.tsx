import {renderApp,type Query} from '../../render-app';
export const dynamic='force-dynamic';
export default async function Page({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<Query>}){return renderApp('/category/'+(await params).slug,await searchParams);}
