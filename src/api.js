import {demo,validateLibrary} from '../shared/story.mjs';
import {fetchLibrary} from '../shared/github.mjs';
import bundled from '../channel.json';
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const put=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const desktopOnly=async()=>{throw new Error('Эта функция доступна в Windows-приложении.')};
export const api=window.desktop||{
 bootstrap:async()=>({library:read('library',demo),workspace:read('workspace',null),progress:read('progress',{}),channel:read('channel',bundled),connected:false,hasGeminiKey:!!read('gemini_key',''),version:'1.0.0',update:{status:'idle'}}),
 saveWorkspace:async data=>put('workspace',data),saveProgress:async data=>put('progress',data),
 refresh:async()=>{const library=await fetchLibrary(read('channel',bundled));put('library',library);return library},
 setChannel:async data=>put('channel',data),connect:desktopOnly,disconnect:async()=>{},publish:desktopOnly,
 setGeminiKey:async key=>put('gemini_key',key?.trim()||''),
 aiGenerateChapter:async({prompt,count,apiKey})=>{
  const {generateNewChapter}=await import('../shared/gemini.mjs');
  return generateNewChapter({apiKey:apiKey||read('gemini_key',''),prompt,count});
 },
 aiContinueChapter:async({chapter,prompt,count,apiKey})=>{
  const {continueChapter}=await import('../shared/gemini.mjs');
  return continueChapter({apiKey:apiKey||read('gemini_key',''),chapter,prompt,count});
 },
 export:async data=>{const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='Между строк.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true},
 import:async()=>new Promise((resolve,reject)=>{const input=document.createElement('input');input.type='file';input.accept='.json';input.oncancel=()=>resolve(null);input.onchange=async()=>{try{resolve(validateLibrary(JSON.parse(await input.files[0].text())))}catch(e){reject(e)}};input.click()}),
 checkUpdate:desktopOnly,downloadUpdate:desktopOnly,installUpdate:desktopOnly,onUpdate:()=>()=>{}
};
