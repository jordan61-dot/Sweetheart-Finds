import {apiError} from '../../../../lib/server';
import {authenticateWorkflow,maintenanceTick} from '../../../../lib/discovery/maintenance';
export async function POST(r:Request){try{const identity=await authenticateWorkflow(r);return Response.json(await maintenanceTick(identity),{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
