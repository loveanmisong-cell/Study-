import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { getAndroidProjectFiles } from './src/data/androidProjectFiles';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '2mb' }));

function getGeminiClient(apiVersion?: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withGeminiRetry<T>(
  preferFast: boolean,
  fn: (modelName: string, thinkingLevel: ThinkingLevel) => Promise<T>
): Promise<T> {
  const primaryModel = preferFast ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';
  const primaryThinking = preferFast ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW;
  const fallbackModel = preferFast ? 'gemini-4-hydrogen' : 'gemini-3.1-flash-lite';
  const fallbackThinking = preferFast ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL;

  try {
    return await fn(primaryModel, primaryThinking);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('503') || msg.includes('UNAVAILABLE')) {
      await new Promise((resolve) => setTimeout(resolve, 450));
      return await fn(primaryModel, primaryThinking);
    }
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      return await fn(fallbackModel, fallbackThinking);
    }
    throw err;
  }
}

const commandResponseSchema = {
  type: Type.OBJECT,
  properties: {
    replyText: {
      type: Type.STRING,
      description:
        'Natural, fast, warm female voice assistant reply in the configured language (Hindi, English, or Hinglish). Keep it crisp and conversational.',
    },
    actionType: {
      type: Type.STRING,
      description:
        'One of: none, open_app, dial_call, type_text, draft_whatsapp, send_whatsapp, read_whatsapp, auto_reply_whatsapp, toggle_auto_reply, click_ui_element, set_reminder, navigate_back, navigate_home, navigate_recents, scroll_down, scroll_up, toggle_setting, confirm_pending, cancel_pending',
    },
    appName: {
      type: Type.STRING,
      description:
        'ANY mobile app name requested by user (e.g. youtube, whatsapp, instagram, spotify, maps, telegram, gmail, paytm, amazon, flipkart, chrome, phone, notes, settings, camera, calculator, calendar, zomato).',
    },
    phoneNumber: {
      type: Type.STRING,
      description:
        'Extracted phone digits only (convert Hindi or English number words like nau aath saat or double nine into digits, or match from device contacts).',
    },
    contactName: {
      type: Type.STRING,
      description:
        'Any contact or person name spoken by the user for calling or WhatsApp messaging (create/open dynamically even if not in contacts list).',
    },
    textContent: {
      type: Type.STRING,
      description:
        'Text to type, search query for any app, UI button/element label to click, reminder title, or exact WhatsApp message / smart auto-reply body.',
    },
    reminderTime: {
      type: Type.STRING,
      description: 'Time or schedule label if actionType is set_reminder.',
    },
    settingKey: {
      type: Type.STRING,
      description: 'If actionType is toggle_setting: wifi, bluetooth, flashlight, or dnd.',
    },
    settingValue: {
      type: Type.BOOLEAN,
      description: 'Desired boolean state if actionType is toggle_setting.',
    },
    autoReplyState: {
      type: Type.BOOLEAN,
      description: 'Desired boolean state if actionType is toggle_auto_reply.',
    },
    needsConfirmation: {
      type: Type.BOOLEAN,
      description:
        'True only when requireConfirmation is enabled AND action is dial_call or disabling wifi.',
    },
    confirmationSummary: {
      type: Type.STRING,
      description: 'Short clear description of the pending action requiring user permission.',
    },
    detectedLanguage: {
      type: Type.STRING,
      description: 'Detected user language: hi, en, or hinglish.',
    },
  },
  required: ['replyText', 'actionType', 'needsConfirmation', 'detectedLanguage'],
};

const autoReplySchema = {
  type: Type.OBJECT,
  properties: {
    replyMessage: {
      type: Type.STRING,
      description:
        'Natural, smart, concise WhatsApp reply message written on behalf of the phone owner in matching language/tone (Hindi/Hinglish/English).',
    },
    novaAnnouncement: {
      type: Type.STRING,
      description:
        'Short female voice announcement telling the user what message arrived and what reply NOVA automatically sent.',
    },
  },
  required: ['replyMessage', 'novaAnnouncement'],
};

async function synthesizeFemaleSpeech(text: string, voiceMode?: string) {
  const ai = getGeminiClient('v1beta');
  const voiceName = voiceMode === 'english_female' ? 'Zephyr' : 'Kore';
  const style =
    voiceMode === 'hindi_female'
      ? 'Warm, crisp, natural Hindi-speaking female AI assistant'
      : voiceMode === 'english_female'
        ? 'Clear, friendly, confident female executive AI assistant'
        : 'Warm, fast, natural bilingual Hindi and English female AI assistant';

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash-lite-tts',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text,
            speechMetadata: { style },
          },
        ],
      },
    ],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
}

app.post('/api/nova/command', async (req, res) => {
  try {
    const { transcript, history = [], config, deviceState } = req.body ?? {};
    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'Transcript text is required.' });
    }

    const ai = getGeminiClient();

    const voiceStyleGuide =
      config?.voiceMode === 'hindi_female'
        ? 'Reply in natural, warm, concise Hindi female voice ("kar rahi hoon", "bhej diya", "bataiye").'
        : config?.voiceMode === 'english_female'
          ? 'Reply in crisp, warm, concise English female assistant style.'
          : 'Reply in natural, fast Hinglish like an intelligent Indian female AI manager ("kar rahi hoon", "message bhej diya", "reply bhej diya").';

    const confirmationPolicy = config?.requireConfirmation
      ? `Permission confirmation is ENABLED. Ask permission (needsConfirmation=true) ONLY for "dial_call" or turning OFF "wifi". For "send_whatsapp", "auto_reply_whatsapp", opening any app, clicking UI buttons, typing, reminders, or navigation, execute immediately (needsConfirmation=false).`
      : `Permission confirmation is DISABLED. Execute all actions immediately with needsConfirmation=false.`;

    const pendingContext = deviceState?.pendingAction
      ? `PENDING ACTION AWAITING PERMISSION: ${JSON.stringify(
          deviceState.pendingAction
        )}. If user says yes/haan/ok/kar do/bhej do/lagao/confirm, set actionType="confirm_pending" and needsConfirmation=false. If user says no/nahi/cancel/ruko/mat karo, set actionType="cancel_pending" and needsConfirmation=false.`
      : 'No pending confirmation right now.';

    const contactsList = JSON.stringify(deviceState?.contacts ?? []);
    const recentMessages = JSON.stringify(deviceState?.whatsappMessages ?? {});

    const systemInstruction = `You are NOVA AI Manager — a fast, friendly female Android Voice Assistant.
${voiceStyleGuide}

Rules:
- Reply naturally & concisely (1-2 short sentences) to ANY question, greeting, joke, advice, or command.
- ALL APPS: Open any app requested (YouTube, WhatsApp, Instagram, Spotify, Maps, Telegram, Gmail, Paytm, Amazon, Flipkart, Zomato, Chrome, Phone, Notes, Settings, Camera, etc.) with actionType="open_app", appName="<Name>", textContent="<search/query if any>".
- TYPING IN ANY MOBILE APP: Whenever user says "type <text>", "likho <text>", or "<app> mein type/likho <text>", set actionType="type_text", textContent="<text to type>", and set appName="<App>" if user named an app (otherwise leave appName empty to type directly into whichever app is currently open!).
- UI CLICK: "click/tap/dabao <element>" -> actionType="click_ui_element", textContent="<element>".
- WHATSAPP: Open ANY person's chat by name (even new names) in contactName.
  * "open chat / padho" -> read_whatsapp
  * "draft karo / likho" -> draft_whatsapp
  * "bhejo / send karo / bol do" -> send_whatsapp
  * "khud se reply de do / smart reply" -> auto_reply_whatsapp (craft reply in textContent from messages: ${recentMessages})
  * "auto-reply on/off" -> toggle_auto_reply (autoReplyState=true/false)
- CALLING ANYONE BY NAME OR NUMBER: When user says "<name> ko call karo/lagao", "call <name>", or "<name> ko phone milao", ALWAYS set actionType="dial_call" and put the spoken person's name in contactName (even if not listed in ${contactsList}) plus phoneNumber if matched in ${contactsList} or spoken digits (convert Hindi/English number words to digits).
- REMINDERS: "reminder/alarm ..." -> set_reminder (textContent, reminderTime).
- NAV & SETTINGS: back->navigate_back, home->navigate_home, recents->navigate_recents, scroll up/down->scroll_up/scroll_down, wifi/bluetooth/flashlight/dnd->toggle_setting.
- ${confirmationPolicy}
- ${pendingContext}

State: screen=${deviceState?.currentScreen ?? 'home'}, app=${deviceState?.activeAppName ?? 'Home'}, contact=${deviceState?.activeContact ?? 'Ankit'}, autoReply=${Boolean(deviceState?.autoReplyEnabled)}, draft="${deviceState?.whatsappDraft ?? ''}", settings=${JSON.stringify(deviceState?.settings ?? {})}.`;

    const formattedHistory =
      config?.brainMode === 'memory' && Array.isArray(history)
        ? history.slice(-10).map((msg: { role: string; text: string }) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }],
          }))
        : [];

    const contents = [
      ...formattedHistory,
      {
        role: 'user',
        parts: [{ text: transcript }],
      },
    ];

    const preferFast = config?.fastProcessing !== false;
    const response = await withGeminiRetry(preferFast, (modelName, thinkingLevel) =>
      ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: commandResponseSchema,
          thinkingConfig: { thinkingLevel },
        },
      })
    );

    const rawText = response.text?.trim() ?? '{}';
    const parsed = JSON.parse(rawText);

    if (config?.includeAudio && parsed.replyText) {
      try {
        const audioBase64 = await synthesizeFemaleSpeech(parsed.replyText, config.voiceMode);
        if (audioBase64) {
          parsed.audioBase64 = audioBase64;
          parsed.audioMimeType = 'audio/wav';
        }
      } catch (ttsErr) {
        console.warn('Inline TTS fallback:', ttsErr);
      }
    }

    return res.json(parsed);
  } catch (err: unknown) {
    console.error('NOVA /api/nova/command error:', err);
    const message = err instanceof Error ? err.message : 'Failed to process voice command.';
    const status = message.includes('API_KEY') ? 500 : 502;
    return res.status(status).json({ error: message });
  }
});

app.post('/api/nova/whatsapp-autoreply', async (req, res) => {
  try {
    const { senderName, incomingMessage, history = [], voiceMode = 'hinglish_female' } = req.body ?? {};
    if (!senderName || !incomingMessage) {
      return res.status(400).json({ error: 'senderName and incomingMessage are required.' });
    }

    const ai = getGeminiClient();

    const response = await withGeminiRetry(true, (modelName, thinkingLevel) =>
      ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Sender: ${senderName}\nIncoming WhatsApp Message: "${incomingMessage}"\nRecent chat history: ${JSON.stringify(
                  history.slice(-5)
                )}\nPreferred language mode: ${voiceMode}`,
              },
            ],
          },
        ],
        config: {
          systemInstruction:
            'You are NOVA, acting as the user\'s smart personal WhatsApp AI manager. Generate a polite, helpful, natural reply to the incoming WhatsApp message on behalf of the user (in matching Hindi/Hinglish/English), plus a brief spoken announcement for the user confirming the reply was sent.',
          responseMimeType: 'application/json',
          responseSchema: autoReplySchema,
          thinkingConfig: { thinkingLevel },
        },
      })
    );

    const parsed = JSON.parse(response.text?.trim() ?? '{}');
    return res.json(parsed);
  } catch (err: unknown) {
    console.error('NOVA /api/nova/whatsapp-autoreply error:', err);
    const message = err instanceof Error ? err.message : 'Auto-reply generation failed.';
    return res.status(502).json({ error: message });
  }
});

const quickRepliesSchema = {
  type: Type.OBJECT,
  properties: {
    suggestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        'Exactly 3 short, natural, distinct WhatsApp quick-reply suggestions (3-8 words each) tailored to the last received message.',
    },
  },
  required: ['suggestions'],
};

app.post('/api/nova/whatsapp-quick-replies', async (req, res) => {
  try {
    const {
      senderName = 'Contact',
      lastMessage,
      history = [],
      voiceMode = 'hinglish_female',
    } = req.body ?? {};
    if (!lastMessage || typeof lastMessage !== 'string') {
      return res.status(400).json({ error: 'lastMessage is required.' });
    }

    const ai = getGeminiClient();

    const response = await withGeminiRetry(true, (modelName, thinkingLevel) =>
      ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Contact: ${senderName}\nLast received WhatsApp message: "${lastMessage}"\nRecent chat history: ${JSON.stringify(
                  Array.isArray(history) ? history.slice(-5) : []
                )}\nLanguage preference: ${voiceMode}`,
              },
            ],
          },
        ],
        config: {
          systemInstruction:
            'Generate exactly 3 distinct, natural, ready-to-tap WhatsApp quick replies (3 to 8 words each) directly answering the last received message in matching Hindi, Hinglish, or English tone (e.g., one affirmative/helpful, one time/status update, one polite follow-up or decline).',
          responseMimeType: 'application/json',
          responseSchema: quickRepliesSchema,
          thinkingConfig: { thinkingLevel },
        },
      })
    );

    const parsed = JSON.parse(response.text?.trim() ?? '{}') as { suggestions?: string[] };
    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions
          .map((s) => String(s).trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];

    return res.json({ suggestions });
  } catch (err: unknown) {
    console.error('NOVA /api/nova/whatsapp-quick-replies error:', err);
    const message = err instanceof Error ? err.message : 'Quick replies generation failed.';
    return res.status(502).json({ error: message });
  }
});

app.post('/api/nova/tts', async (req, res) => {
  try {
    const { text, voiceMode } = req.body ?? {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for speech synthesis.' });
    }

    const base64Audio = await synthesizeFemaleSpeech(text, voiceMode);
    if (!base64Audio) {
      return res.status(502).json({ error: 'No audio returned from Gemini TTS.' });
    }

    return res.json({
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
    });
  } catch (err: unknown) {
    console.error('NOVA /api/nova/tts error:', err);
    const message = err instanceof Error ? err.message : 'Speech synthesis failed.';
    return res.status(502).json({ error: message });
  }
});

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZipBuffer(entries: { path: string; content: string }[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.path, 'utf8');
    const dataBuf = Buffer.from(entry.content, 'utf8');
    const crc = crc32(dataBuf);

    // Local File Header (30 bytes + filename)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
    localHeader.writeUInt16LE(20, 4); // Version needed to extract
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    localHeader.writeUInt16LE(0, 8); // Compression method: 0 (store)
    localHeader.writeUInt16LE(0, 10); // Mod time
    localHeader.writeUInt16LE(0x5421, 12); // Mod date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(dataBuf.length, 18);
    localHeader.writeUInt32LE(dataBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // Extra field length

    localParts.push(localHeader, nameBuf, dataBuf);

    // Central Directory File Header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Central directory signature
    centralHeader.writeUInt16LE(20, 4); // Version made by
    centralHeader.writeUInt16LE(20, 6); // Version needed
    centralHeader.writeUInt16LE(0x0800, 8); // UTF-8 flag
    centralHeader.writeUInt16LE(0, 10); // Compression method: 0
    centralHeader.writeUInt16LE(0, 12); // Mod time
    centralHeader.writeUInt16LE(0x5421, 14); // Mod date
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(dataBuf.length, 20);
    centralHeader.writeUInt32LE(dataBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // Extra length
    centralHeader.writeUInt16LE(0, 32); // Comment length
    centralHeader.writeUInt16LE(0, 34); // Disk start
    centralHeader.writeUInt16LE(0, 36); // Internal attrs
    centralHeader.writeUInt32LE(0, 38); // External attrs
    centralHeader.writeUInt32LE(offset, 42); // Relative offset of local header

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + dataBuf.length;
  }

  const centralDirBuffer = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // End of central directory signature
  eocd.writeUInt16LE(0, 4); // Disk number
  eocd.writeUInt16LE(0, 6); // Central dir start disk
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20); // Comment length

  return Buffer.concat([...localParts, centralDirBuffer, eocd]);
}

app.get('/api/nova/download-android-zip', (_req, res) => {
  try {
    const projectFiles = getAndroidProjectFiles().map((f) => ({
      path: `NOVA-AI-Manager-Android/${f.path}`,
      content: f.content,
    }));
    const zipBuffer = buildZipBuffer(projectFiles);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="NOVA-AI-Manager-APK-Kit.zip"');
    res.setHeader('Content-Length', String(zipBuffer.length));
    return res.send(zipBuffer);
  } catch (err: unknown) {
    console.error('ZIP generation failed:', err);
    return res.status(500).json({ error: 'Failed to build Android APK Kit zip.' });
  }
});

async function startServer() {
  const port = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`NOVA AI Manager server running on http://0.0.0.0:${port}`);
  });
}

startServer();
