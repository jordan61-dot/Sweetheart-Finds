import { auth, body, apiError, getPersonal, mutatePersonal } from '../../../lib/server';
import { opSchema } from '../../../lib/domain';
import { z } from 'zod';
export async function GET(r:Request){try{const u=await auth(r);return Response.json(await getPersonal(u.userId),{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
export async function POST(r:Request){try{const u=await auth(r);const {operations}=z.object({operations:z.array(opSchema).min(1).max(100)}).parse(await body(r));return Response.json(await mutatePersonal(u.userId,operations));}catch(e){return apiError(e);}}
