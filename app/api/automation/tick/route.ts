import {apiError} from '../../../../lib/server';
import {authenticateCollector,tickFeeds} from '../../../../lib/discovery/feed-runner';
export async function POST(r:Request){try{await authenticateCollector(r);return Response.json(await tickFeeds(),{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
