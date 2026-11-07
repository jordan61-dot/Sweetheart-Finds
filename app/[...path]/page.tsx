import {renderApp,type Query} from '../render-app';
export const dynamic='force-dynamic';
export default async function Page({params,searchParams}:{params:Promise<{path:string[]}>;searchParams:Promise<Query>}){return renderApp('/'+(await params).path.join('/'),await searchParams);}
