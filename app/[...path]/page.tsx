import {notFound} from 'next/navigation';
import {renderApp,type Query} from '../render-app';
export const dynamic='force-dynamic';
export default async function Page({params,searchParams}:{params:Promise<{path:string[]}>;searchParams:Promise<Query>}){const path='/'+(await params).path.join('/');if(!['/browse','/collections','/favorites','/wishlists','/profile','/admin'].includes(path))notFound();return renderApp(path,await searchParams);}
