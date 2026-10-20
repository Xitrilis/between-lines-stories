export const uid = () => globalThis.crypto.randomUUID();
export const isLocked = (chapter, now = Date.now()) => !!chapter.unlockAt && Date.parse(chapter.unlockAt) > now;
export function pagesOf(chapter) {
  const pages = []; let page = [];
  for (const message of chapter.messages) {
    if (message.breakBefore && page.length) { pages.push(page); page = []; }
    if (page.length >= chapter.pageSize) { pages.push(page); page = []; }
    page.push(message);
  }
  if (page.length) pages.push(page);
  return pages.length ? pages : [[]];
}
export function textColor(hex) {
  const rgb = hex.slice(1).match(/.{2}/g)?.map(x=>parseInt(x,16)) || [0,0,0];
  const luminance = rgb.map(x=>x/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
  return luminance > 0.179 ? '#142031' : '#ffffff';
}
export function validateChapter(c) {
  const fail = m => {throw new Error(m)};
  if (!c || typeof c !== 'object') fail('Не удалось прочитать главу.');
  for (const key of ['id','title']) if (typeof c[key] !== 'string' || !c[key].trim() || c[key].length>200) fail('Укажите название главы (до 200 символов).');
  if (typeof c.description !== 'string' || c.description.length>2000) fail('Описание слишком длинное.');
  if (!Number.isInteger(c.pageSize) || c.pageSize<1 || c.pageSize>12) fail('На странице может быть от 1 до 12 сообщений.');
  if (!['header','messages','both'].includes(c.avatarMode)) fail('Некорректное расположение аватарок.');
  if (c.unlockAt && !Number.isFinite(Date.parse(c.unlockAt))) fail('Укажите корректную дату открытия.');
  if (!c.people || Object.keys(c.people).length !== 2) fail('Нужны два участника переписки.');
  for (const side of ['left','right']) {
    const p=c.people[side];
    if (!p || typeof p.name!=='string' || !p.name.trim() || p.name.length>80) fail('Укажите имена обоих участников.');
    if (!/^#[0-9a-f]{6}$/i.test(p.color)) fail('Неверный цвет сообщения.');
    if (typeof p.avatar!=='string' || (p.avatar && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(p.avatar))) fail('Используйте PNG, JPEG или WebP для аватарки.');
    if (p.avatar.length>3_000_000) fail('Аватарка слишком большая.');
  }
  if (!Array.isArray(c.messages) || !c.messages.length || c.messages.length>2000) fail('Добавьте от 1 до 2000 сообщений.');
  const ids = new Set();
  for (const m of c.messages) {
    if (!m || typeof m.id!=='string' || ids.has(m.id) || !['left','right'].includes(m.side) || typeof m.text!=='string' || !m.text.trim() || m.text.length>5000) fail('У каждого сообщения должен быть текст (до 5000 символов).');
    ids.add(m.id);
  }
  return c;
}
export function validateLibrary(library) {
  if (!library || library.schema!==1 || !Array.isArray(library.chapters) || library.chapters.length>300) throw new Error('Неизвестный формат библиотеки.');
  const ids=new Set();
  for(const c of library.chapters) {validateChapter(c);if(ids.has(c.id))throw new Error('Повторяющаяся глава.');ids.add(c.id)}
  return library;
}
export function mergeChapter(library, chapter) {
  validateChapter(chapter);
  const copy = structuredClone(library);
  const index = copy.chapters.findIndex(c=>c.id===chapter.id);
  if(index>=0) copy.chapters[index]=structuredClone(chapter); else copy.chapters.push(structuredClone(chapter));
  copy.updatedAt=new Date().toISOString();
  return validateLibrary(copy);
}
export function newChapter() {
  return {id:uid(),title:'Новая глава',description:'',pageSize:7,avatarMode:'header',unlockAt:'',people:{left:{name:'Он',avatar:'',color:'#E9EBEF'},right:{name:'Она',avatar:'',color:'#006DDB'}},messages:[{id:uid(),side:'left',text:'',breakBefore:false}]};
}
export const demo = {schema:1,updatedAt:'',chapters:[{
  id:'first-message',title:'Когда город засыпает',description:'Одно сообщение может изменить весь вечер.',pageSize:7,avatarMode:'header',unlockAt:'',
  people:{left:{name:'Саша',avatar:'',color:'#E9EBEF'},right:{name:'Аня',avatar:'',color:'#006DDB'}},
  messages:[
    ['left','Ты ещё не спишь?'],['right','Смотря кто спрашивает.'],['left','Человек, который полчаса выбирал, что тебе написать.'],['right','И выбрал «ты не спишь»?'],['left','У меня был план получше.'],['right','Расскажешь?'],['left','Посмотри в окно.'],
    ['right','Ты серьёзно сейчас стоишь под дождём?'],['left','Вообще-то я стою под зонтом.'],['right','С двумя стаканами кофе?'],['left','Один — повод. Второй — для тебя.'],['right','Дай мне пять минут.'],['left','Я бы и дольше подождал.'],['right','Я знаю. Поэтому спускаюсь.']
  ].map(([side,text],i)=>({id:`demo-${i}`,side,text,breakBefore:false}))
}]};
