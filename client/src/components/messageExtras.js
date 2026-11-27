import { useEffect,useState } from "react";
const key=(id)=>`chatterbox:extras:${id}`;
export function useMessageExtras(chatId){const [extras,setExtras]=useState({});useEffect(()=>{try{setExtras(JSON.parse(localStorage.getItem(key(chatId)))||{})}catch{setExtras({})}},[chatId]);const update=(id,patch)=>setExtras(prev=>{const next={...prev,[id]:{...prev[id],...patch}};try{localStorage.setItem(key(chatId),JSON.stringify(next))}catch{}return next});return [extras,update]}
