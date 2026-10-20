const {contextBridge,ipcRenderer}=require('electron');
const call=async(name,...args)=>{const result=await ipcRenderer.invoke(name,...args);if(!result.ok)throw new Error(result.error);return result.value};
contextBridge.exposeInMainWorld('desktop',{
 bootstrap:()=>call('bootstrap'),saveWorkspace:data=>call('save-workspace',data),saveProgress:data=>call('save-progress',data),refresh:()=>call('refresh'),connect:data=>call('connect',data),setChannel:data=>call('set-channel',data),disconnect:()=>call('disconnect'),publish:data=>call('publish',data),export:data=>call('export',data),import:()=>call('import'),checkUpdate:()=>call('check-update'),downloadUpdate:()=>call('download-update'),installUpdate:()=>call('install-update'),
 onUpdate:callback=>{const handler=(_event,state)=>callback(state);ipcRenderer.on('update-state',handler);return ()=>ipcRenderer.removeListener('update-state',handler)},
 onClosing:callback=>{const handler=()=>callback();ipcRenderer.on('before-close',handler);return ()=>ipcRenderer.removeListener('before-close',handler)},closeReady:data=>call('close-ready',data)
});
