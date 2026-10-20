import {_electron as electron} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
const profile=await fs.mkdtemp(path.resolve('test-results/layout-'));await fs.writeFile(path.join(profile,'channel.json'),JSON.stringify({owner:'',repo:'x',branch:'main'}));
const app=await electron.launch({args:['.'],env:{...process.env,BETWEEN_LINES_DATA:profile}});
try{const p=await app.firstWindow();await p.emulateMedia({reducedMotion:'reduce'});await p.getByRole('button',{name:'Редактор',exact:true}).click();console.log(await p.locator('.brand').evaluate(el=>({rect:el.getBoundingClientRect().toJSON(),style:getComputedStyle(el).visibility,opacity:getComputedStyle(el).opacity,bodyScrollHeight:document.body.scrollHeight,viewport:innerHeight})));await p.screenshot({path:path.resolve('test-results/editor-clean.png')});}finally{await app.close()}
