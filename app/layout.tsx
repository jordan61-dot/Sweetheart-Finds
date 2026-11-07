import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Sweetheart Finds — little things, big heart',description:'A thoughtful treasure cabinet for collectibles, nostalgic favorites, and gifts. Explore 14 interests, save a little wishlist, and find something that feels like her.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
