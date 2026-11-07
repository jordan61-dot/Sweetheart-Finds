import {renderApp,type Query} from './render-app';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Query>}){return renderApp('/',await searchParams);}
