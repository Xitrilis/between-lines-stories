import { uid, validateChapter } from './story.mjs';

export const GEMINI_MODEL = 'gemini-3.8-flash';

export const NEW_CHAPTER_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'Краткое название главы, до 50 символов' },
    description: { type: 'STRING', description: 'Интригующее описание в одно предложение, до 150 символов' },
    leftPerson: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Имя первого участника (слева)' },
        color: { type: 'STRING', description: 'HEX цвет фона сообщений (например #E9EBEF или #E2E8F0)' }
      },
      required: ['name', 'color']
    },
    rightPerson: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Имя второго участника (справа)' },
        color: { type: 'STRING', description: 'HEX цвет фона сообщений (например #006DDB, #7429A8, #059669)' }
      },
      required: ['name', 'color']
    },
    messages: {
      type: 'ARRAY',
      description: 'Список реплик в порядке переписки',
      items: {
        type: 'OBJECT',
        properties: {
          side: { type: 'STRING', enum: ['left', 'right'], description: 'Отправитель: left или right' },
          text: { type: 'STRING', description: 'Текст сообщения' }
        },
        required: ['side', 'text']
      }
    }
  },
  required: ['title', 'description', 'leftPerson', 'rightPerson', 'messages']
};

export const CONTINUE_MESSAGES_SCHEMA = {
  type: 'OBJECT',
  properties: {
    messages: {
      type: 'ARRAY',
      description: 'Продолжение переписки',
      items: {
        type: 'OBJECT',
        properties: {
          side: { type: 'STRING', enum: ['left', 'right'], description: 'Отправитель: left или right' },
          text: { type: 'STRING', description: 'Текст реплики' }
        },
        required: ['side', 'text']
      }
    }
  },
  required: ['messages']
};

export async function requestGemini({ apiKey, contents, systemInstruction, schema, fetcher = fetch }) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Укажите API-ключ Gemini.');
  }
  const cleanKey = apiKey.trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${cleanKey}`;
  
  const body = {
    contents,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      temperature: 0.8
    }
  };
  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  let response;
  try {
    response = await fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000)
    });
  } catch (err) {
    throw new Error(`Ошибка подключения к Gemini: ${err.message || 'Таймаут соединения'}`);
  }

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.error?.message || '';
    } catch {}

    if (response.status === 400 || response.status === 403) {
      if (errorDetail.toLowerCase().includes('api_key') || errorDetail.toLowerCase().includes('key not valid') || errorDetail.toLowerCase().includes('invalid api key')) {
        throw new Error('Недействительный API-ключ Gemini. Проверьте ключ в Google AI Studio.');
      }
      throw new Error(`Ошибка запроса Gemini (${response.status}): ${errorDetail || 'Неверные параметры'}`);
    }
    if (response.status === 429) {
      throw new Error('Превышен лимит запросов Gemini API. Попробуйте через минуту.');
    }
    throw new Error(`Сервер Gemini вернул ошибку ${response.status}${errorDetail ? ': ' + errorDetail : ''}`);
  }

  const result = await response.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Gemini не вернул текст ответа.');
  }

  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error('Не удалось разобрать ответ от Gemini.');
  }
}

export async function generateNewChapter({ apiKey, prompt, count = 10, fetcher = fetch }) {
  const systemInstruction = 
    `Ты — мастер диалогов и писатель современных интерактивных историй в формате мессенджера (iMessage / Telegram) на русском языке.\n` +
    `Создай живой, эмоциональный, кинематографичный диалог двух людей по описанию автора.\n` +
    `Персонажи должны звучать как реальные люди: с естественными интонациями, реакциями, юмором, паузами или интригой.\n` +
    `Сгенерируй примерно ${count} сообщений (чередуя left и right естественным образом).`;

  const userPrompt = `Тема / сюжет истории: ${prompt?.trim() || 'Случайная встреча двух незнакомцев, переросшая в откровенный разговор'}`;

  const parsed = await requestGemini({
    apiKey,
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    systemInstruction,
    schema: NEW_CHAPTER_SCHEMA,
    fetcher
  });

  const chapter = {
    id: uid(),
    title: (parsed.title || 'Новая история').slice(0, 180),
    description: (parsed.description || '').slice(0, 500),
    pageSize: 7,
    avatarMode: 'header',
    unlockAt: '',
    people: {
      left: {
        name: (parsed.leftPerson?.name || 'Он').slice(0, 70),
        avatar: '',
        color: /^#[0-9a-f]{6}$/i.test(parsed.leftPerson?.color) ? parsed.leftPerson.color : '#E9EBEF'
      },
      right: {
        name: (parsed.rightPerson?.name || 'Она').slice(0, 70),
        avatar: '',
        color: /^#[0-9a-f]{6}$/i.test(parsed.rightPerson?.color) ? parsed.rightPerson.color : '#006DDB'
      }
    },
    messages: (parsed.messages && parsed.messages.length ? parsed.messages : [
      { side: 'left', text: 'Привет!' },
      { side: 'right', text: 'Привет, ты о чем?' }
    ]).map(m => ({
      id: uid(),
      side: m.side === 'right' ? 'right' : 'left',
      text: (m.text || '').trim().slice(0, 4000) || '…',
      breakBefore: false
    }))
  };

  return validateChapter(chapter);
}

export async function continueChapter({ apiKey, chapter, prompt = '', count = 8, fetcher = fetch }) {
  const leftName = chapter.people.left.name;
  const rightName = chapter.people.right.name;

  const recentMessages = chapter.messages.slice(-14).map(m => {
    const sender = m.side === 'left' ? leftName : rightName;
    return `${sender}: "${m.text}"`;
  }).join('\n');

  const systemInstruction = 
    `Ты продолжаешь историю в формате мессенджера на русском языке.\n` +
    `Собеседники:\n` +
    `- Слева (left): ${leftName}\n` +
    `- Справа (right): ${rightName}\n` +
    `Контекст главы: "${chapter.title}" — ${chapter.description || 'без описания'}.\n` +
    `Напиши продолжение диалога (примерно ${count} реплик), сохраняя стилистику, характеры персонажей и логику разговора.`;

  let userPrompt = `Последние сообщения в диалоге:\n${recentMessages || '(диалог только начался)'}\n\n`;
  if (prompt && prompt.trim()) {
    userPrompt += `Указание автора для продолжения сюжета: ${prompt.trim()}\n`;
  } else {
    userPrompt += `Продолжи естественное развитие диалога дальше.\n`;
  }

  const parsed = await requestGemini({
    apiKey,
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    systemInstruction,
    schema: CONTINUE_MESSAGES_SCHEMA,
    fetcher
  });

  if (!parsed.messages || !parsed.messages.length) {
    throw new Error('Gemini не вернул новых сообщений.');
  }

  return parsed.messages.map(m => ({
    id: uid(),
    side: m.side === 'right' ? 'right' : 'left',
    text: (m.text || '').trim().slice(0, 4000) || '…',
    breakBefore: false
  }));
}
