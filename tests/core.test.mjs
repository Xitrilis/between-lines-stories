import test from 'node:test';
import assert from 'node:assert/strict';
import {demo,pagesOf,isLocked,validateChapter,validateLibrary,mergeChapter,textColor} from '../shared/story.mjs';
import {publishChapter,checkChannel,fetchLibrary} from '../shared/github.mjs';
import {generateNewChapter,continueChapter} from '../shared/gemini.mjs';
const chapter=()=>structuredClone(demo.chapters[0]);
test('Pages preserve every message, seven by default and manual cliffhanger boundaries',()=>{
 const c=chapter();assert.deepEqual(pagesOf(c).map(p=>p.length),[7,7]);
 c.messages[4].breakBefore=true;const pages=pagesOf(c);assert.deepEqual(pages.map(p=>p.length),[4,7,3]);assert.deepEqual(pages.flat(),c.messages);
 c.pageSize=3;assert.ok(pagesOf(c).every(p=>p.length<=3));assert.equal(pagesOf(c).flat().length,14);
});
test('Release respects absolute time and opens exactly at the boundary',()=>{
 const c={...chapter(),unlockAt:'2030-01-01T12:00:00.000Z'},time=Date.parse(c.unlockAt);
 assert.equal(isLocked(c,time-1),true);assert.equal(isLocked(c,time),false);assert.equal(isLocked(c,time+1),false);assert.equal(isLocked(chapter()),false);
});
test('Validation accepts real stories and rejects unsafe media, invalid colors and missing messages',()=>{
 assert.equal(validateChapter(chapter()).messages.length,14);validateLibrary(demo);
 for(const mutate of [c=>c.people.left.avatar='https://tracker.invalid/x',c=>c.people.right.avatar='data:image/svg+xml;base64,abcd',c=>c.people.left.color='red',c=>c.messages[0].text='',c=>c.messages.push(c.messages[0]),c=>c.pageSize=0,c=>c.unlockAt='bad']){const c=chapter();mutate(c);assert.throws(()=>validateChapter(c))}
 assert.throws(()=>validateLibrary({schema:1,chapters:[chapter(),chapter()]}));
 assert.throws(()=>checkChannel({owner:'x/y',repo:'a',branch:'main'}));
 assert.equal(textColor('#FFFFFF'),'#142031');assert.equal(textColor('#000000'),'#ffffff');
});
test('Publishing updates only the chosen chapter and preserves others',async()=>{
 const original=structuredClone(demo),other={...chapter(),id:'second',title:'Вторая'};original.chapters.push(other);
 const updated=chapter();updated.messages[0].text='Изменённая реплика';let body;
 const fetcher=async(url,options)=>{if(options.method==='PUT'){body=JSON.parse(options.body);return new Response('{}',{status:200})}return new Response(JSON.stringify({sha:'known-sha',content:Buffer.from(JSON.stringify(original)).toString('base64')}),{status:200})};
 const result=await publishChapter({owner:'author',repo:'stories',branch:'main'},updated,'test-only',fetcher);
 assert.equal(body.sha,'known-sha');assert.equal(body.branch,'main');assert.equal(result.chapters.length,2);assert.deepEqual(result.chapters[1],other);assert.equal(result.chapters[0].messages[0].text,'Изменённая реплика');assert.deepEqual(JSON.parse(Buffer.from(body.content,'base64')),result);
 assert.equal(original.chapters[0].messages[0].text,'Ты ещё не спишь?');
});
test('Publication supports new libraries, rejects conflicts and never treats access errors as an empty library',async()=>{
 let puts=0;const config={owner:'author',repo:'stories',branch:'main'};
 await publishChapter(config,chapter(),'token',async(_url,opt)=>{if(opt.method==='PUT'){puts++;return new Response('{}')}return new Response('{}',{status:404})});assert.equal(puts,1);
 for(const status of [401,403,409]){await assert.rejects(()=>publishChapter(config,chapter(),'token',async()=>new Response('{}',{status})));}
});
test('Reader fetches and validates remote content, rejecting malformed files',async()=>{
 const config={owner:'author',repo:'stories',branch:'main'};
 const value=await fetchLibrary(config,async()=>new Response(JSON.stringify(demo)));assert.equal(value.chapters[0].id,demo.chapters[0].id);
 await assert.rejects(()=>fetchLibrary(config,async()=>new Response('{"schema":999}')));
});
test('AI co-author generates valid chapters and continues dialogue',async()=>{
 const fakeNew={title:'Встреча в метро',description:'Один зонт на двоих.',leftPerson:{name:'Максим',color:'#E9EBEF'},rightPerson:{name:'Лера',color:'#006DDB'},messages:[{side:'left',text:'Кажется, это твой зонт?'},{side:'right',text:'Смотря в какую сторону ты едешь.'}]};
 const mockFetcher=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(fakeNew)}]}}]}),{status:200,headers:{'Content-Type':'application/json'}});
 const generated=await generateNewChapter({apiKey:'test-key',prompt:'про зонт',count:2,fetcher:mockFetcher});
 assert.equal(generated.title,'Встреча в метро');assert.equal(generated.people.left.name,'Максим');assert.equal(generated.people.right.name,'Лера');assert.equal(generated.messages.length,2);validateChapter(generated);
 const fakeContinue={messages:[{side:'left',text:'Я еду до кольцевой.'},{side:'right',text:'Тогда зонт точно мой.'}]};
 const mockContinue=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(fakeContinue)}]}}]}),{status:200,headers:{'Content-Type':'application/json'}});
 const added=await continueChapter({apiKey:'test-key',chapter:generated,prompt:'продолжение',fetcher:mockContinue});
 assert.equal(added.length,2);assert.equal(added[0].text,'Я еду до кольцевой.');
});
