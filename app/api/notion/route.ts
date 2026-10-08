import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {createNotionClient,notionAccess,NotionFailure} from '@/lib/notion-notes';
import {storeSchema} from '@/lib/store-schema';
export const dynamic='force-dynamic';
const itemSchema=storeSchema.shape.items.element;
function configuration(){const settings=env as unknown as Record<string,string|undefined>;return {token:settings.NOTION_API_KEY||'',parentId:settings.NOTION_PARENT_PAGE_ID||'',owner:settings.NOTION_OWNER_EMAIL};}
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){try{const config=configuration();notionAccess(request,config.owner,import.meta.env.DEV);return reply({configured:Boolean(config.token&&config.parentId),missing:[...(!config.token?['NOTION_API_KEY']:[]),...(!config.parentId?['NOTION_PARENT_PAGE_ID']:[])]})}catch(e){return failure(e)}}
export async function POST(request:Request){try{const config=configuration();notionAccess(request,config.owner,import.meta.env.DEV);if(!config.token||!config.parentId)throw new NotionFailure('Notion är inte inställt ännu. Följ guiden under Anteckningar.',503);if(Number(request.headers.get('Content-Length')||0)>1000000)throw new NotionFailure('Begäran är för stor.',413);const body=await request.text();if(body.length>1000000)throw new NotionFailure('Begäran är för stor.',413);const input=z.discriminatedUnion('action',[z.object({action:z.literal('sync'),known:z.array(itemSchema).max(500).default([])}),z.object({action:z.literal('save'),item:itemSchema})]).parse(JSON.parse(body));const client=createNotionClient(config);return reply(input.action==='sync'?await client.list(input.known):{note:await client.save(input.item)})}catch(e){return failure(e)}}
function failure(error:unknown){if(error instanceof NotionFailure)return reply({error:error.message},error.status);if(error instanceof z.ZodError||error instanceof SyntaxError)return reply({error:'Begäran innehåller ogiltiga anteckningsdata.'},400);return reply({error:'Notion-kopplingen kunde inte slutföra begäran.'},500)}
