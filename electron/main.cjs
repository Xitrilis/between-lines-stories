const { app, BrowserWindow, ipcMain, dialog, safeStorage } = require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const bundled=require('../channel.json');
let window, updater, updateState={status:'idle'}, publishBusy=false, allowClose=false;
if(process.env.BETWEEN_LINES_DATA)app.setPath('userData',process.env.BETWEEN_LINES_DATA);
const file=name=>path.join(app.getPath('userData'),name);
async function read(name,fallback){try{return JSON.parse(await fs.readFile(file(name),'utf8'))}catch(e){if(e.code==='ENOENT')return fallback;throw new Error('Не удалось прочитать сохранённые данные. Экспортируйте резервную копию перед изменениями.')}}
const writeQueues=new Map();
async function write(name,data){const serialized=JSON.stringify(data);const task=(writeQueues.get(name)||Promise.resolve()).catch(()=>{}).then(async()=>{await fs.mkdir(app.getPath('userData'),{recursive:true});const temp=file(`${name}.tmp`);await fs.writeFile(temp,serialized);await fs.rename(temp,file(name));});writeQueues.set(name,task);return task;}
async function channel(){return await read('channel.json',bundled)}
function guarded(name,handler){ipcMain.handle(name,async(event,...args)=>{if(event.sender!==window.webContents)throw new Error('Unknown sender');try{return {ok:true,value:await handler(...args)}}catch(e){return {ok:false,error:e.message||'Операция не выполнена.'}}})}
async function getToken(){try{return safeStorage.decryptString(await fs.readFile(file('github.secret')))}catch{return null}}
async function storeToken(token){if(!safeStorage.isEncryptionAvailable())throw new Error('Windows не предоставляет защищённое хранилище ключей.');await fs.mkdir(app.getPath('userData'),{recursive:true});await fs.writeFile(file('github.secret'),safeStorage.encryptString(token));}
async function getGeminiKey(){try{return safeStorage.decryptString(await fs.readFile(file('gemini.secret')))}catch{return process.env.GEMINI_API_KEY||null}}
async function storeGeminiKey(key){if(!safeStorage.isEncryptionAvailable())throw new Error('Windows не предоставляет защищённое хранилище ключей.');await fs.mkdir(app.getPath('userData'),{recursive:true});if(!key){await fs.rm(file('gemini.secret'),{force:true});return;}await fs.writeFile(file('gemini.secret'),safeStorage.encryptString(key));}
async function credentialToken(){return new Promise((resolve,reject)=>{
 const child=execFile('git',['credential','fill'],{env:{...process.env,GCM_INTERACTIVE:'Never',GIT_TERMINAL_PROMPT:'0'},windowsHide:true,timeout:10000},(error,stdout)=>{if(error)return reject(new Error('Войдите в GitHub через Git Credential Manager или добавьте ключ в настройках.'));const token=stdout.split(/\r?\n/).find(s=>s.startsWith('password='))?.slice(9);token?resolve(token):reject(new Error('GitHub не подключён.'))});child.stdin.end('protocol=https\nhost=github.com\n\n');
})}
function emitUpdate(status,more={}){updateState={status,...more};window?.webContents.send('update-state',updateState)}
async function setupUpdater(){
 const c=await channel();if(!app.isPackaged || !c.owner)return;
 const {NsisUpdater}=require('electron-updater');
 updater=new NsisUpdater({provider:'github',owner:c.owner,repo:c.repo,releaseType:'release'});
 updater.autoDownload=false;updater.autoInstallOnAppQuit=false;
 updater.on('checking-for-update',()=>emitUpdate('checking'));
 updater.on('update-available',info=>emitUpdate('available',{version:info.version}));
 updater.on('update-not-available',()=>emitUpdate('current'));
 updater.on('download-progress',p=>emitUpdate('downloading',{percent:Math.round(p.percent)}));
 updater.on('update-downloaded',()=>emitUpdate('ready'));
 updater.on('error',()=>emitUpdate('error',{message:'Не удалось проверить обновление. Попробуйте позже.'}));
 setTimeout(()=>updater.checkForUpdates().catch(()=>{}),15000).unref();
}
app.whenReady().then(async()=>{
 const {demo,validateLibrary,validateChapter}=await import('../shared/story.mjs');
 const {checkChannel,fetchLibrary,publishChapter,githubRequest}=await import('../shared/github.mjs');
 const {generateNewChapter,continueChapter}=await import('../shared/gemini.mjs');
 guarded('bootstrap',async()=>({library:await read('library.json',demo),workspace:await read('workspace.json',null),channel:await channel(),connected:!!await getToken(),hasGeminiKey:!!await getGeminiKey(),version:app.getVersion(),progress:await read('progress.json',{}),update:updateState}));
 guarded('set-gemini-key',async key=>{const trimmed=key?.trim();await storeGeminiKey(trimmed);return !!trimmed});
 guarded('ai-generate-chapter',async({prompt,count,apiKey})=>{const activeKey=apiKey?.trim()||await getGeminiKey();if(!activeKey)throw new Error('Укажите API-ключ Gemini.');if(apiKey?.trim()&&!await getGeminiKey()){await storeGeminiKey(apiKey.trim())}return await generateNewChapter({apiKey:activeKey,prompt,count})});
 guarded('ai-continue-chapter',async({chapter,prompt,count,apiKey})=>{const activeKey=apiKey?.trim()||await getGeminiKey();if(!activeKey)throw new Error('Укажите API-ключ Gemini.');if(apiKey?.trim()&&!await getGeminiKey()){await storeGeminiKey(apiKey.trim())}return await continueChapter({apiKey:activeKey,chapter,prompt,count})});
 guarded('save-workspace',async data=>{if(JSON.stringify(data).length>24_000_000)throw new Error('Слишком большой проект.');await write('workspace.json',data);return true});
 guarded('save-progress',async data=>{await write('progress.json',data);return true});
 guarded('refresh',async()=>{const library=await fetchLibrary(await channel());await write('library.json',library);return library});
 guarded('connect',async ({token,config})=>{checkChannel(config);const key=token?.trim()||await credentialToken();const user=await githubRequest('/user',{token:key});const repo=await githubRequest(`/repos/${config.owner}/${config.repo}`,{token:key});if(!repo.permissions?.push)throw new Error('У этого аккаунта нет права публиковать в выбранный репозиторий.');if(repo.private)throw new Error('Для чтения без входа нужен публичный репозиторий.');await storeToken(key);await write('channel.json',config);await setupUpdater();return {login:user.login}});
 guarded('set-channel',async c=>{checkChannel(c);await write('channel.json',c);await setupUpdater();return true});
 guarded('disconnect',async()=>{await fs.rm(file('github.secret'),{force:true});return true});
 guarded('close-ready',async data=>{await write('workspace.json',data);allowClose=true;window.close();return true});
 guarded('publish',async chapter=>{if(publishBusy)throw new Error('Публикация уже выполняется.');validateChapter(chapter);const token=await getToken();if(!token)throw new Error('Сначала подключите GitHub в настройках.');publishBusy=true;try{const library=await publishChapter(await channel(),chapter,token);await write('library.json',library);return library}finally{publishBusy=false}});
 guarded('export',async data=>{const chosen=await dialog.showSaveDialog(window,{title:'Сохранить историю',defaultPath:'Между строк.json',filters:[{name:'История',extensions:['json']}]});if(chosen.canceled)return false;await fs.writeFile(chosen.filePath,JSON.stringify(data,null,2));return true});
 guarded('import',async()=>{const chosen=await dialog.showOpenDialog(window,{title:'Открыть историю',filters:[{name:'История',extensions:['json']}],properties:['openFile']});if(chosen.canceled)return null;const stat=await fs.stat(chosen.filePaths[0]);if(stat.size>24_000_000)throw new Error('Файл слишком большой.');return validateLibrary(JSON.parse(await fs.readFile(chosen.filePaths[0],'utf8')))});
 guarded('check-update',async()=>{if(!updater)throw new Error('Обновления доступны в установленном приложении после подключения канала GitHub.');await updater.checkForUpdates();return updateState});
 guarded('download-update',async()=>{if(!updater || updateState.status!=='available')throw new Error('Сначала проверьте обновления.');await updater.downloadUpdate();return true});
 guarded('install-update',async()=>{if(updateState.status!=='ready')throw new Error('Обновление ещё не загружено.');allowClose=true;updater.quitAndInstall(false,true)});
 window=new BrowserWindow({width:1380,height:920,minWidth:820,minHeight:620,title:'Между строк',backgroundColor:'#F0F3F8',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 window.webContents.on('will-navigate',event=>event.preventDefault());
 window.on('close',event=>{if(!allowClose&&!process.env.BETWEEN_LINES_DATA){event.preventDefault();window.webContents.send('before-close')}});
 await window.loadFile(path.join(__dirname,'../dist/index.html'));
 await setupUpdater();
});
app.on('window-all-closed',()=>app.quit());
