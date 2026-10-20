import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {_electron as electron} from 'playwright';
const require=createRequire(import.meta.url),asar=require('@electron/asar');
const pkg=JSON.parse(await fs.readFile('package.json','utf8'));
const release=path.resolve('release'),installer=path.join(release,`BetweenLines-Setup-${pkg.version}.exe`);
assert.ok((await fs.stat(installer)).size>30_000_000,'Installer must contain the Electron runtime');
const head=await fs.readFile(installer);assert.equal(head.subarray(0,2).toString(),'MZ');
const metadata=await fs.readFile(path.join(release,'latest.yml'),'utf8');assert.ok(metadata.includes(pkg.version));assert.ok(metadata.includes('sha512:'));assert.ok(metadata.includes(path.basename(installer)));
const archive=path.join(release,'win-unpacked','resources','app.asar');const files=asar.listPackage(archive);
assert.ok(files.some(f=>f.endsWith('preload.cjs')));assert.ok(files.some(f=>f.endsWith('channel.json')));
for(const file of files.filter(f=>/\.(js|cjs|mjs|json|html|yml|css)$/.test(f)&&!f.includes('node_modules'))){const content=asar.extractFile(archive,file.replace(/^[\\/]+/,'')).toString();assert.ok(!/(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/.test(content),`Credential in ${file}`)}
assert.ok(!files.some(f=>/github\.secret|workspace\.json|profile-/.test(f)));
const channel=JSON.parse(asar.extractFile(archive,'channel.json'));assert.ok(channel.owner && channel.repo);
const testProfile=await fs.mkdtemp(path.resolve('test-results/packaged-'));await fs.writeFile(path.join(testProfile,'channel.json'),JSON.stringify({owner:'',repo:'test',branch:'main'}));
const app=await electron.launch({executablePath:path.join(release,'win-unpacked','Между строк.exe'),args:[],env:{...process.env,BETWEEN_LINES_DATA:testProfile},timeout:60000});
try{const page=await app.firstWindow();page.setDefaultTimeout(10000);await page.getByRole('heading',{name:'Истории, которые хочется дочитать.'}).waitFor();await page.getByRole('button',{name:'Редактор',exact:true}).click();assert.equal(await page.getByRole('textbox',{name:'Название главы'}).inputValue(),'Когда город засыпает');}finally{await app.close()}
console.log('PACKAGE VERIFIED: Windows installer, update checksum metadata, bundled channel, no embedded credentials');
