import { validateLibrary, mergeChapter } from './story.mjs';
export function checkChannel(channel) {
  if(!channel || !/^[A-Za-z0-9-]{1,39}$/.test(channel.owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(channel.repo) || !/^[A-Za-z0-9_./-]+$/.test(channel.branch) || channel.branch.includes('..')) throw new Error('Укажите владельца, репозиторий и ветку GitHub.');
  return channel;
}
export async function githubRequest(path, {token, method='GET', body, raw=false, fetcher=fetch}={}) {
  const response=await fetcher(`https://api.github.com${path}`,{method,headers:{Accept:raw?'application/vnd.github.raw+json':'application/vnd.github+json','User-Agent':'BetweenLines','X-GitHub-Api-Version':'2022-11-28',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  if(!response.ok){const e=new Error(response.status===401?'Войдите в GitHub заново.':response.status===403?'GitHub запретил действие. Проверьте доступ к репозиторию или лимит запросов.':response.status===409?'Глава была изменена. Обновите библиотеку и повторите публикацию.':`GitHub вернул ошибку ${response.status}.`);e.status=response.status;throw e;}
  if(response.status===204)return null;
  return response.json();
}
export async function fetchLibrary(channel,fetcher=fetch) {
  checkChannel(channel);
  const url=`https://raw.githubusercontent.com/${channel.owner}/${channel.repo}/${channel.branch}/library.json?t=${Date.now()}`;
  const response=await fetcher(url,{signal:AbortSignal.timeout(20000),cache:'no-store'});
  if(!response.ok)throw new Error(response.status===404?'В библиотеке пока нет опубликованных глав.':`Не удалось загрузить истории (${response.status}).`);
  const text=await response.text();
  if(text.length>24_000_000)throw new Error('Библиотека слишком большая.');
  return validateLibrary(JSON.parse(text));
}
export async function publishChapter(channel,chapter,token,fetcher=fetch) {
  checkChannel(channel);
  const path=`/repos/${channel.owner}/${channel.repo}/contents/library.json`;
  let existing={schema:1,chapters:[]},sha;
  try {
    const meta=await githubRequest(`${path}?ref=${encodeURIComponent(channel.branch)}`,{token,fetcher});sha=meta.sha;
    existing=meta.content?JSON.parse(Buffer.from(meta.content,'base64').toString('utf8')):await githubRequest(`${path}?ref=${encodeURIComponent(channel.branch)}`,{token,raw:true,fetcher});
    validateLibrary(existing);
  } catch(e) {if(e.status!==404)throw e;}
  const merged=mergeChapter(existing,chapter);
  const bytes=Buffer.from(JSON.stringify(merged,null,2));
  if(bytes.length>18_000_000)throw new Error('Библиотека превысила 18 МБ. Уменьшите размер аватарок.');
  await githubRequest(path,{token,method:'PUT',fetcher,body:{message:`Publish chapter: ${chapter.title}`,content:bytes.toString('base64'),branch:channel.branch,...(sha?{sha}:{})}});
  return merged;
}
