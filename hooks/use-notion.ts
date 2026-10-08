'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Item} from '@/lib/personal-data';
async function request<T>(body?:unknown):Promise<T>{const response=await fetch('/api/notion',{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store'});const result=await response.json() as T&{error?:string};if(!response.ok)throw Error(result.error||'Notion kunde inte svara.');return result}
export function useNotion(){
 const [configured,setConfigured]=useState(false),[connected,setConnected]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notes,setNotes]=useState<Item[]>([]),[parentTitle,setParentTitle]=useState(''),[lastSync,setLastSync]=useState('');const cache=useRef<Item[]>([]),flight=useRef(false),generation=useRef(0);
 const check=useCallback(async()=>{try{const status=await request<{configured:boolean}>();setConfigured(status.configured);setError('')}catch(e){setError(e instanceof Error?e.message:'Notion är inte tillgängligt.')}},[]);
 useEffect(()=>{void check()},[check]);
 const refresh=useCallback(async()=>{if(flight.current)return;flight.current=true;const version=generation.current;setBusy(true);setError('');try{const result=await request<{parentTitle:string;notes:Item[]}>({action:'sync',known:cache.current});if(version!==generation.current)return;cache.current=result.notes;setNotes(result.notes);setParentTitle(result.parentTitle);setLastSync(new Date().toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'}));setConnected(true)}catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'Anteckningarna kunde inte hämtas.')}finally{flight.current=false;setBusy(false)}},[]);
 useEffect(()=>{if(!connected)return;const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh()},120000);const focus=()=>{void refresh()};window.addEventListener('focus',focus);return()=>{clearInterval(timer);window.removeEventListener('focus',focus)}},[connected,refresh]);
 function disconnect(){generation.current++;setConnected(false);setNotes([]);cache.current=[];setParentTitle('');setLastSync('');setError('')}
 async function saveNote(item:Item){if(!configured||!connected)throw Error('Anslut Notion innan du sparar där.');const version=generation.current;const result=await request<{note:Item}>({action:'save',item});const note={...result.note,area:item.area,tags:item.tags,pinned:item.pinned};if(version===generation.current){cache.current=[note,...cache.current.filter(n=>n.notion?.pageId!==note.notion?.pageId)];setNotes(cache.current)}return note}
 return {configured,connected,busy,error,notes,parentTitle,lastSync,check,refresh,disconnect,saveNote};
}
export type NotionConnection=ReturnType<typeof useNotion>;
