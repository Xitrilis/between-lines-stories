import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {githubRequest,publishChapter} from '../shared/github.mjs';
import {demo} from '../shared/story.mjs';
const gh=process.argv[2]||'gh';
let token;
const run=(command,args)=>execFileSync(command,args,{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,GH_TOKEN:token,GITHUB_TOKEN:token}}).trim();
try{token=execFileSync(gh,['auth','token'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim()}catch{throw new Error('Сначала войдите в GitHub CLI: gh auth login')}
const account=await githubRequest('/user',{token});
const channel=JSON.parse(await fs.readFile('channel.json','utf8'));
if(account.login.toLowerCase()!==channel.owner.toLowerCase())throw new Error(`Канал принадлежит ${channel.owner}, а вход выполнен как ${account.login}. Сначала выполните scripts/channel.mjs для нужного аккаунта и пересоберите установщик.`);
try{await githubRequest(`/repos/${channel.owner}/${channel.repo}`,{token})}catch(error){if(error.status!==404)throw error;await githubRequest('/user/repos',{token,method:'POST',body:{name:channel.repo,description:'Между строк — Windows reader and editor for chat stories',private:false,auto_init:false}});console.log('Public repository created')}
try{run(gh,['auth','setup-git','--hostname','github.com','--force'])}catch{}
const expected=`https://github.com/${channel.owner}/${channel.repo}.git`;
let remote;try{remote=run('git',['remote','get-url','origin'])}catch{run('git',['remote','add','origin',expected]);remote=expected}
if(remote!==expected)throw new Error('origin указывает на другой репозиторий. Публикация остановлена.');
run('git',['push','-u','origin','main']);
let hasLibrary=true;try{await githubRequest(`/repos/${channel.owner}/${channel.repo}/contents/library.json`,{token})}catch(error){if(error.status===404)hasLibrary=false;else throw error}
if(!hasLibrary){await publishChapter(channel,demo.chapters[0],token);console.log('Demo chapter published through the same API as the editor')}
run('git',['pull','--ff-only']);
const pkg=JSON.parse(await fs.readFile('package.json','utf8'));
const assets=[`BetweenLines-Setup-${pkg.version}.exe`,`BetweenLines-Setup-${pkg.version}.exe.blockmap`,'latest.yml'].map(name=>path.join('release',name));
for(const asset of assets)await fs.access(asset);
let existingRelease;try{existingRelease=await githubRequest(`/repos/${channel.owner}/${channel.repo}/releases/tags/v${pkg.version}`,{token})}catch(e){if(e.status!==404)throw e}
if(existingRelease)throw new Error('Эта версия уже опубликована. Увеличьте номер версии перед новым выпуском.');
run(gh,['release','create',`v${pkg.version}`,...assets,'--repo',`${channel.owner}/${channel.repo}`,'--title',`Между строк ${pkg.version}`,'--notes-file','RELEASE.md','--target','main']);
console.log(`Published https://github.com/${channel.owner}/${channel.repo}/releases/tag/v${pkg.version}`);
