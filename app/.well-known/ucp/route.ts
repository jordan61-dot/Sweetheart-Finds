import profile from '../../../public/ucp-agent.json';
export function GET(){return Response.json(profile,{headers:{'Cache-Control':'public,max-age=300'}});}
