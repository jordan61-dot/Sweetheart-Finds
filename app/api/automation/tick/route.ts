import {acpState,publishACP,acpFailure,acpRefreshPlan,refreshACP} from '../../../../lib/discovery/acp';
import {body} from '../../../../lib/server';
import {apiError} from '../../../../lib/server';
import {authenticateWorkflow,maintenanceTick} from '../../../../lib/discovery/maintenance';
export async function POST(r:Request){try{const identity=await authenticateWorkflow(r);const input=await body(r);const result=input.action==='acp-refresh-plan'?await acpRefreshPlan():input.action==='refresh-acp'?await refreshACP(input,identity):input.action==='acp-state'?await acpState():input.action==='publish-acp'?await publishACP(input,identity):input.action==='acp-failure'?await acpFailure(String(input.message),input.expectedLastSuccess):await maintenanceTick(identity);return Response.json(result,{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}}
