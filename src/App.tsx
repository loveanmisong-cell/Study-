import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Check,
  Download,
  Mic,
  MicOff,
  Power,
  RotateCcw,
  Send,
  ShieldCheck,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { AndroidPhoneSimulator } from './components/AndroidPhoneSimulator';
import { ApkDownloadModal } from './components/ApkDownloadModal';
import { CommandGuideView } from './components/CommandGuideView';
import { KotlinStudioView } from './components/KotlinStudioView';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import {
  BrainMode,
  ConversationEntry,
  DeviceSettings,
  DeviceState,
  NovaCommandResponse,
  PendingAction,
  PhoneScreen,
  SpeechOutputMode,
  VoiceMode,
} from './types/nova';

type ActiveTab = 'studio' | 'kotlin' | 'guide' | 'setup';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
  resultIndex?: number;
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives?: number;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstanceLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstanceLike;
  }
}

const INITIAL_DEVICE_STATE: DeviceState = {
  currentScreen: 'home',
  screenHistory: ['home'],
  activeAppName: 'Home',
  activeAppQuery: '',
  lastClickedElement: '',
  activeContact: 'Ankit',
  autoReplyEnabled: true,
  contacts: [
    { name: 'Ankit', phone: '9876543210', relation: 'friend' },
    { name: 'Priya', phone: '9811223344', relation: 'colleague' },
    { name: 'Mummy', phone: '9820011223', relation: 'mother' },
    { name: 'Rahul', phone: '9988776655', relation: 'brother' },
  ],
  whatsappDraft: '',
  whatsappMessages: {
    Ankit: [
      { id: 'm1', sender: 'contact', text: 'Bhai aaj meeting kitne baje hai?', time: '12:30' },
    ],
    Priya: [
      { id: 'm2', sender: 'contact', text: 'Please share the updated deck.', time: '11:15' },
    ],
    Mummy: [
      { id: 'm3', sender: 'contact', text: 'Khana kha liya beta?', time: '12:50' },
    ],
    Rahul: [
      { id: 'm4', sender: 'contact', text: 'Match dekhne chalega shaam ko?', time: '11:45' },
    ],
  },
  notesText: '',
  reminders: [],
  chromeQuery: '',
  youtubeQuery: '',
  dialedNumber: '',
  isCallActive: false,
  callContactName: '',
  scrollOffset: 0,
  settings: {
    wifi: true,
    bluetooth: false,
    flashlight: false,
    dnd: false,
  },
  pendingAction: null,
};

const QUICK_COMMANDS = [
  'Rohit ko call lagao',
  'Instagram mein type karo Virat Kohli',
  'YouTube mein type karo Arijit Singh',
  'WhatsApp pe Priya ko message bhejo ki 10 min mein aa raha hoon',
  'Back jao',
];

const SIMULATED_INCOMING_PROMPTS = [
  'Kahan pahunche ho? Meeting 15 minute mein start ho rahi hai.',
  'Bhai kal ka plan confirm hai kya? Time bata do.',
  'Ghar kab tak aaoge? Dinner ready hai.',
  'Please send me the file link when free.',
];

function tryLocalInstantCommand(
  rawText: string,
  currentDevice: DeviceState,
  voiceMode: VoiceMode,
  requireConfirmation: boolean
): NovaCommandResponse | null {
  const clean = rawText.trim().toLowerCase().replace(/[।.!?]+$/g, '');

  if (currentDevice.pendingAction) {
    if (/^(haan|han|yes|ok|okay|kar do|bhej do|lagao|confirm|allow|theek hai)$/.test(clean)) {
      return {
        replyText:
          voiceMode === 'english_female'
            ? 'Confirmed, executing now.'
            : 'Theek hai, abhi kar rahi hoon.',
        actionType: 'confirm_pending',
        needsConfirmation: false,
        detectedLanguage: 'hinglish',
      };
    }
    if (/^(nahi|no|cancel|mat karo|ruko|stop)$/.test(clean)) {
      return {
        replyText:
          voiceMode === 'english_female'
            ? 'Cancelled.'
            : 'Theek hai, cancel kar diya.',
        actionType: 'cancel_pending',
        needsConfirmation: false,
        detectedLanguage: 'hinglish',
      };
    }
  }

  // Instant conversational greetings & time/date responses
  if (/^(hi|hello|hey|namaste|namaskar|hello nova|hi nova|namaste nova)$/.test(clean)) {
    return {
      replyText:
        voiceMode === 'english_female'
          ? 'Hello! I am NOVA, listening and ready. What should I do?'
          : 'Namaste! Main NOVA hoon, aapki awaaz sun rahi hoon. Bataiye kya karna hai?',
      actionType: 'none',
      needsConfirmation: false,
      detectedLanguage: 'hinglish',
    };
  }

  if (/^(kaise ho|kaisi ho|how are you|kya haal hai|sab theek)$/.test(clean)) {
    return {
      replyText:
        voiceMode === 'english_female'
          ? 'I am doing great and ready to help with your phone!'
          : 'Main bilkul theek hoon! Bataiye aapka kaunsa kaam karun?',
      actionType: 'none',
      needsConfirmation: false,
      detectedLanguage: 'hinglish',
    };
  }

  if (/^(thanks|thank you|shukriya|dhanyavaad|thx)$/.test(clean)) {
    return {
      replyText:
        voiceMode === 'english_female'
          ? 'You are welcome! Always ready when you need me.'
          : 'Aapka swagat hai! Jab bhi zaroorat ho boliye.',
      actionType: 'none',
      needsConfirmation: false,
      detectedLanguage: 'hinglish',
    };
  }

  if (/(time kya hua|kitne baje|what time|current time|samay kya)/.test(clean)) {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return {
      replyText:
        voiceMode === 'english_female'
          ? `The time is ${timeStr}.`
          : `Abhi ${timeStr} ho rahe hain.`,
      actionType: 'none',
      needsConfirmation: false,
      detectedLanguage: 'hinglish',
    };
  }

  if (/^(back|go back|back jao|piche jao|peeche jao|वापस जाओ)$/.test(clean)) {
    return {
      replyText: voiceMode === 'english_female' ? 'Going back.' : 'Back ja rahi hoon.',
      actionType: 'navigate_back',
      needsConfirmation: false,
      detectedLanguage: 'hinglish',
    };
  }

  if (/^(home|go home|home kholo|home screen|home screen kholo|होम खोलो)$/.test(clean)) {
    return {
      replyText: voiceMode === 'english_female' ? 'Opening home screen.' : 'Home screen khol rahi hoon.',
      actionType: 'navigate_home',
      needsConfirmation: false,
      detectedLanguage: 'hinglish',
    };
  }

  if (/^(recents|recent apps|recent dikhao)$/.test(clean)) {
    return {
      replyText: voiceMode === 'english_female' ? 'Showing recent apps.' : 'Recent apps dikha rahi hoon.',
      actionType: 'navigate_recents',
      needsConfirmation: false,
      detectedLanguage: 'hinglish',
    };
  }

  if (/^(scroll down|neeche karo|neeche scroll karo|niche jao)$/.test(clean)) {
    return {
      replyText: voiceMode === 'english_female' ? 'Scrolling down.' : 'Neeche scroll kar rahi hoon.',
      actionType: 'scroll_down',
      needsConfirmation: false,
      detectedLanguage: 'hinglish',
    };
  }

  if (/^(scroll up|upar karo|upar scroll karo|upar jao)$/.test(clean)) {
    return {
      replyText: voiceMode === 'english_female' ? 'Scrolling up.' : 'Upar scroll kar rahi hoon.',
      actionType: 'scroll_up',
      needsConfirmation: false,
      detectedLanguage: 'hinglish',
    };
  }

  const settingMatch = clean.match(
    /^(wifi|wi-fi|bluetooth|flashlight|torch|dnd|silent)\s+(on|off|karo|on karo|off karo|band karo|chalu karo)$/
  );
  if (settingMatch) {
    const rawKey = settingMatch[1];
    const key: keyof DeviceSettings =
      rawKey === 'wi-fi' || rawKey === 'wifi'
        ? 'wifi'
        : rawKey === 'bluetooth'
          ? 'bluetooth'
          : rawKey === 'flashlight' || rawKey === 'torch'
            ? 'flashlight'
            : 'dnd';
    const turnOn = /on|chalu/.test(settingMatch[2]);
    return {
      replyText:
        voiceMode === 'english_female'
          ? `${key} turned ${turnOn ? 'on' : 'off'}.`
          : `${key} ${turnOn ? 'on' : 'off'} kar diya.`,
      actionType: 'toggle_setting',
      settingKey: key,
      settingValue: turnOn,
      needsConfirmation: false,
      detectedLanguage: 'hinglish',
    };
  }

  const singleAppMatch = clean.match(
    /^(?:open\s+)?(youtube|whatsapp|instagram|spotify|maps|telegram|chrome|gmail|phone|notes|settings|camera|google drive|drive)(?:\s+(?:kholo|open|chalu karo|open karo))?$/
  );
  if (singleAppMatch && !clean.includes('pe ') && !clean.includes('ko ')) {
    const appName = singleAppMatch[1];
    const capitalized =
      appName === 'google drive' || appName === 'drive'
        ? 'Google Drive'
        : appName.charAt(0).toUpperCase() + appName.slice(1);
    return {
      replyText:
        voiceMode === 'english_female'
          ? `Opening ${capitalized}.`
          : `${capitalized} khol rahi hoon.`,
      actionType: 'open_app',
      appName: capitalized,
      needsConfirmation: false,
      detectedLanguage: 'hinglish',
    };
  }

  // Instant name/number call (e.g., "Rohit ko call karo", "call Ankit", "Papa ko phone lagao")
  const nameCallMatch =
    rawText.trim().match(/^([a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F\s]{1,30}?)\s+ko\s+(?:call|phone|ring)\s*(?:karo|lagao|laga do|kar do|milao)?[.!?।]*$/i) ||
    rawText.trim().match(/^(?:call|dial|phone)\s+([a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F\s]{1,30}?)[.!?।]*$/i);
  if (nameCallMatch) {
    const spokenTarget = nameCallMatch[1].trim();
    if (!/^(whatsapp|instagram|youtube|chrome|settings|camera|back|home)$/i.test(spokenTarget)) {
      const formattedName = spokenTarget.charAt(0).toUpperCase() + spokenTarget.slice(1);
      const matched = currentDevice.contacts.find((c) =>
        c.name.toLowerCase() === spokenTarget.toLowerCase() ||
        c.name.toLowerCase().includes(spokenTarget.toLowerCase())
      );
      return {
        replyText: requireConfirmation
          ? voiceMode === 'english_female'
            ? `Should I call ${matched?.name ?? formattedName}?`
            : `Kya main ${matched?.name ?? formattedName} ko call lagaun?`
          : voiceMode === 'english_female'
            ? `Calling ${matched?.name ?? formattedName} now.`
            : `${matched?.name ?? formattedName} ko call laga rahi hoon.`,
        actionType: 'dial_call',
        contactName: matched?.name ?? formattedName,
        phoneNumber: matched?.phone ?? '',
        needsConfirmation: requireConfirmation,
        confirmationSummary: requireConfirmation
          ? `Call ${matched?.name ?? formattedName}${matched?.phone ? ` (${matched.phone})` : ''}`
          : undefined,
        detectedLanguage: 'hinglish',
      };
    }
  }

  // Instant typing into currently active app (e.g., "type karo Hello dosto", "likho Good morning")
  const directTypeMatch = rawText
    .trim()
    .match(/^(?:type\s*karo|type\s*kardo|type|likho)\s+(.+)$/i);
  if (directTypeMatch) {
    const textToType = directTypeMatch[1].trim();
    const targetLabel =
      currentDevice.currentScreen === 'home' || currentDevice.currentScreen === 'notes'
        ? 'Notes'
        : currentDevice.activeAppName || currentDevice.currentScreen;
    return {
      replyText:
        voiceMode === 'english_female'
          ? `Typed in ${targetLabel}.`
          : `${targetLabel} mein type kar diya.`,
      actionType: 'type_text',
      textContent: textToType,
      needsConfirmation: false,
      detectedLanguage: 'hinglish',
    };
  }

  return null;
}

function buildFallbackQuickReplies(lastReceivedText: string, voiceMode: VoiceMode): string[] {
  const lower = lastReceivedText.toLowerCase();
  const isEnglish = voiceMode === 'english_female';

  if (/meeting|baje|time|kitne/.test(lower)) {
    return isEnglish
      ? ['4 PM works for me', 'Joining in 10 mins', 'Can we reschedule?']
      : ['4 baje theek rahega', '10 min mein join karti hoon', 'Thoda late chalega?'];
  }
  if (/deck|file|link|share|send/.test(lower)) {
    return isEnglish
      ? ['Sending it right now', 'Shared on email, check please', 'Will send in 15 mins']
      : ['Abhi bhej rahi hoon', 'Check karo, share kar diya', '15 min mein bhejti hoon'];
  }
  if (/khana|dinner|ghar|aao|pahunche/.test(lower)) {
    return isEnglish
      ? ['On my way, 15 mins', 'Yes, had it already', 'Reaching home soon']
      : ['Bas 15 min mein aa rahi hoon', 'Haan, kha liya hai', 'Thodi der mein pahunchti hoon'];
  }
  if (/match|plan|shaam|kal|chalega/.test(lower)) {
    return isEnglish
      ? ['Count me in!', 'Let me confirm in an hour', 'Next time for sure']
      : ['Haan bilkul chalenge!', '1 ghante mein confirm karti hoon', 'Aaj thoda busy hoon'];
  }
  return isEnglish
    ? ['Sounds good!', 'On it, give me 5 mins', 'Call you in a bit']
    : ['Theek hai, done!', '5 min mein update karti hoon', 'Thodi der mein call karti hoon'];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('studio');
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('hinglish_female');
  const [brainMode, setBrainMode] = useState<BrainMode>('memory');
  const [speechOutputMode, setSpeechOutputMode] = useState<SpeechOutputMode>('browser_tts');
  const [requireConfirmation, setRequireConfirmation] = useState<boolean>(false);
  const [fastProcessing, setFastProcessing] = useState<boolean>(true);
  const [voiceAssistantActive, setVoiceAssistantActive] = useState<boolean>(false);
  const [isApkModalOpen, setIsApkModalOpen] = useState<boolean>(false);

  const [device, setDevice] = useState<DeviceState>(INITIAL_DEVICE_STATE);
  const [conversation, setConversation] = useState<ConversationEntry[]>([
    {
      id: 'welcome',
      role: 'nova',
      text: 'Namaste! Main NOVA hoon. Voice Listening ON button dabaiye — main aapki har baat turant sunungi, fast reply dungi aur har command follow karungi.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [quickRepliesByKey, setQuickRepliesByKey] = useState<Record<string, string[]>>({});
  const [isLoadingQuickReplies, setIsLoadingQuickReplies] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const deviceRef = useRef<DeviceState>(device);
  const conversationRef = useRef<ConversationEntry[]>(conversation);
  const voiceAssistantActiveRef = useRef<boolean>(voiceAssistantActive);
  const fetchedQuickReplyKeysRef = useRef<Set<string>>(new Set());
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const activeWhatsappMessages = device.whatsappMessages[device.activeContact] ?? [];
  const lastReceivedWhatsappMsg = [...activeWhatsappMessages]
    .reverse()
    .find((m) => m.sender === 'contact');
  const activeQuickReplyKey = lastReceivedWhatsappMsg
    ? `${lastReceivedWhatsappMsg.id}:${voiceMode}`
    : '';
  const activeQuickReplies = lastReceivedWhatsappMsg
    ? quickRepliesByKey[activeQuickReplyKey] ??
      buildFallbackQuickReplies(lastReceivedWhatsappMsg.text, voiceMode)
    : [];

  useEffect(() => {
    deviceRef.current = device;
  }, [device]);

  useEffect(() => {
    voiceAssistantActiveRef.current = voiceAssistantActive;
  }, [voiceAssistantActive]);

  useEffect(() => {
    conversationRef.current = conversation;
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  useEffect(() => {
    if (
      device.currentScreen !== 'whatsapp' ||
      !lastReceivedWhatsappMsg ||
      !activeQuickReplyKey ||
      fetchedQuickReplyKeysRef.current.has(activeQuickReplyKey) ||
      (typeof navigator !== 'undefined' && !navigator.onLine)
    ) {
      return;
    }

    fetchedQuickReplyKeysRef.current.add(activeQuickReplyKey);
    let cancelled = false;
    setIsLoadingQuickReplies(true);

    fetch('/api/nova/whatsapp-quick-replies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderName: device.activeContact,
        lastMessage: lastReceivedWhatsappMsg.text,
        history: activeWhatsappMessages.slice(-5),
        voiceMode,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Quick replies unavailable');
        return (await res.json()) as { suggestions?: string[] };
      })
      .then((data) => {
        if (cancelled) return;
        const suggestions = Array.isArray(data.suggestions) ? data.suggestions.slice(0, 3) : [];
        if (suggestions.length > 0) {
          setQuickRepliesByKey((prev) => ({
            ...prev,
            [activeQuickReplyKey]: suggestions,
          }));
        }
      })
      .catch(() => {
        // Fallback suggestions already displayed smoothly
      })
      .finally(() => {
        if (!cancelled) setIsLoadingQuickReplies(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    device.currentScreen,
    device.activeContact,
    lastReceivedWhatsappMsg,
    activeQuickReplyKey,
    activeWhatsappMessages,
    voiceMode,
  ]);

  const stopAllAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const speakWithBrowser = useCallback(
    (text: string, onDone?: () => void) => {
      if (!('speechSynthesis' in window)) {
        onDone?.();
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voiceMode === 'english_female' ? 'en-IN' : 'hi-IN';
      utterance.pitch = 1.14;
      utterance.rate = 1.1;

      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) =>
          v.lang.startsWith(voiceMode === 'english_female' ? 'en' : 'hi') &&
          /female|lekha|heera|kalpana|samantha|google/i.test(v.name)
      );
      if (preferred) utterance.voice = preferred;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        onDone?.();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        onDone?.();
      };
      window.speechSynthesis.speak(utterance);
    },
    [voiceMode]
  );

  const playAudioOrSpeak = useCallback(
    async (text: string, inlineBase64?: string, inlineMimeType?: string, onDone?: () => void) => {
      if (speechOutputMode === 'muted' || !text.trim()) {
        onDone?.();
        return;
      }
      stopAllAudio();

      if (inlineBase64) {
        try {
          setIsSpeaking(true);
          const audio = new Audio(`data:${inlineMimeType ?? 'audio/wav'};base64,${inlineBase64}`);
          audioRef.current = audio;
          audio.onended = () => {
            setIsSpeaking(false);
            onDone?.();
          };
          audio.onerror = () => {
            setIsSpeaking(false);
            speakWithBrowser(text, onDone);
          };
          await audio.play();
          return;
        } catch {
          setIsSpeaking(false);
          speakWithBrowser(text, onDone);
          return;
        }
      }

      if (speechOutputMode === 'browser_tts') {
        speakWithBrowser(text, onDone);
        return;
      }

      try {
        setIsSpeaking(true);
        const res = await fetch('/api/nova/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voiceMode }),
        });

        if (!res.ok) {
          throw new Error('Gemini TTS unavailable');
        }
        const data = (await res.json()) as { audioBase64?: string; mimeType?: string };
        if (!data.audioBase64) {
          throw new Error('Empty audio payload');
        }

        const audio = new Audio(`data:${data.mimeType ?? 'audio/wav'};base64,${data.audioBase64}`);
        audioRef.current = audio;
        audio.onended = () => {
          setIsSpeaking(false);
          onDone?.();
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          speakWithBrowser(text, onDone);
        };
        await audio.play();
      } catch {
        setIsSpeaking(false);
        speakWithBrowser(text, onDone);
      }
    },
    [speechOutputMode, stopAllAudio, speakWithBrowser, voiceMode]
  );

  const ensureContactThread = (
    prev: DeviceState,
    rawName?: string
  ): { contactName: string; messagesMap: DeviceState['whatsappMessages'] } => {
    const cleanName = (rawName ?? '').trim() || prev.activeContact;
    const existingKey = Object.keys(prev.whatsappMessages).find(
      (k) => k.toLowerCase() === cleanName.toLowerCase()
    );
    const resolvedName = existingKey ?? cleanName;
    if (prev.whatsappMessages[resolvedName]) {
      return { contactName: resolvedName, messagesMap: prev.whatsappMessages };
    }
    return {
      contactName: resolvedName,
      messagesMap: {
        ...prev.whatsappMessages,
        [resolvedName]: [],
      },
    };
  };

  const applyExecutableAction = useCallback(
    (action: {
      actionType: NovaCommandResponse['actionType'];
      appName?: string;
      phoneNumber?: string;
      contactName?: string;
      textContent?: string;
      reminderTime?: string;
      settingKey?: keyof DeviceSettings;
      settingValue?: boolean;
      autoReplyState?: boolean;
    }) => {
      setDevice((prev) => {
        const pushScreen = (nextScreen: PhoneScreen): Pick<DeviceState, 'currentScreen' | 'screenHistory'> => ({
          currentScreen: nextScreen,
          screenHistory:
            prev.currentScreen === nextScreen
              ? prev.screenHistory
              : [...prev.screenHistory, nextScreen].slice(-10),
        });

        switch (action.actionType) {
          case 'open_app': {
            const raw = (action.appName ?? '').toLowerCase().trim();
            const map: Record<string, PhoneScreen> = {
              youtube: 'youtube',
              whatsapp: 'whatsapp',
              chrome: 'chrome',
              google: 'chrome',
              phone: 'phone',
              dialer: 'phone',
              notes: 'notes',
              settings: 'settings',
              camera: 'camera',
            };
            const target = map[raw] ?? 'universal_app';
            const { contactName, messagesMap } = action.contactName
              ? ensureContactThread(prev, action.contactName)
              : { contactName: prev.activeContact, messagesMap: prev.whatsappMessages };

            return {
              ...prev,
              ...pushScreen(target),
              activeAppName: action.appName || raw || 'App',
              activeAppQuery: action.textContent ?? '',
              lastClickedElement: '',
              scrollOffset: 0,
              activeContact: target === 'whatsapp' ? contactName : prev.activeContact,
              whatsappMessages: messagesMap,
              youtubeQuery: target === 'youtube' && action.textContent ? action.textContent : prev.youtubeQuery,
              chromeQuery: target === 'chrome' && action.textContent ? action.textContent : prev.chromeQuery,
              pendingAction: null,
            };
          }
          case 'click_ui_element': {
            return {
              ...prev,
              lastClickedElement: action.textContent || 'Button',
              pendingAction: null,
            };
          }
          case 'dial_call': {
            const spokenName = (action.contactName ?? '').trim();
            const matchedContact = spokenName
              ? prev.contacts.find(
                  (c) =>
                    c.name.toLowerCase() === spokenName.toLowerCase() ||
                    c.name.toLowerCase().includes(spokenName.toLowerCase()) ||
                    spokenName.toLowerCase().includes(c.name.toLowerCase())
                )
              : undefined;
            const digits = (action.phoneNumber || matchedContact?.phone || '').replace(/[^\d+]/g, '');
            const resolvedName = matchedContact?.name ?? spokenName;
            return {
              ...prev,
              ...pushScreen('phone'),
              activeAppName: 'Phone',
              dialedNumber: digits,
              callContactName: resolvedName,
              isCallActive: Boolean(digits || resolvedName),
              pendingAction: null,
            };
          }
          case 'type_text': {
            const textToType = action.textContent ?? '';
            const rawApp = (action.appName ?? '').toLowerCase().trim();
            const appScreenMap: Record<string, PhoneScreen> = {
              youtube: 'youtube',
              whatsapp: 'whatsapp',
              chrome: 'chrome',
              google: 'chrome',
              notes: 'notes',
              phone: 'phone',
              settings: 'settings',
              camera: 'camera',
            };

            const targetScreen: PhoneScreen = rawApp
              ? appScreenMap[rawApp] ?? 'universal_app'
              : prev.currentScreen === 'home'
                ? 'notes'
                : prev.currentScreen;

            const nextAppName = action.appName
              ? action.appName.charAt(0).toUpperCase() + action.appName.slice(1)
              : targetScreen === 'notes'
                ? 'Notes'
                : prev.activeAppName;

            if (targetScreen === 'whatsapp') {
              const { contactName, messagesMap } = action.contactName
                ? ensureContactThread(prev, action.contactName)
                : { contactName: prev.activeContact, messagesMap: prev.whatsappMessages };
              return {
                ...prev,
                ...pushScreen('whatsapp'),
                activeAppName: 'WhatsApp',
                activeContact: contactName,
                whatsappMessages: messagesMap,
                whatsappDraft:
                  prev.currentScreen === 'whatsapp' && !rawApp && prev.whatsappDraft
                    ? `${prev.whatsappDraft} ${textToType}`.trim()
                    : textToType,
                pendingAction: null,
              };
            }
            if (targetScreen === 'youtube') {
              return {
                ...prev,
                ...pushScreen('youtube'),
                activeAppName: 'YouTube',
                youtubeQuery: textToType,
                pendingAction: null,
              };
            }
            if (targetScreen === 'chrome') {
              return {
                ...prev,
                ...pushScreen('chrome'),
                activeAppName: 'Chrome',
                chromeQuery: textToType,
                pendingAction: null,
              };
            }
            if (targetScreen === 'universal_app') {
              return {
                ...prev,
                ...pushScreen('universal_app'),
                activeAppName: nextAppName || 'App',
                activeAppQuery: textToType,
                pendingAction: null,
              };
            }
            return {
              ...prev,
              ...pushScreen('notes'),
              activeAppName: 'Notes',
              notesText: prev.notesText ? `${prev.notesText}\n${textToType}` : textToType,
              pendingAction: null,
            };
          }
          case 'set_reminder': {
            const title = action.textContent || 'Reminder';
            const time = action.reminderTime || 'Today';
            return {
              ...prev,
              ...pushScreen('notes'),
              reminders: [
                ...prev.reminders,
                { id: `r-${Date.now()}`, title, time },
              ],
              pendingAction: null,
            };
          }
          case 'read_whatsapp': {
            const { contactName, messagesMap } = ensureContactThread(prev, action.contactName);
            return {
              ...prev,
              ...pushScreen('whatsapp'),
              activeContact: contactName,
              whatsappMessages: messagesMap,
              pendingAction: null,
            };
          }
          case 'draft_whatsapp': {
            const { contactName, messagesMap } = ensureContactThread(prev, action.contactName);
            return {
              ...prev,
              ...pushScreen('whatsapp'),
              activeContact: contactName,
              whatsappMessages: messagesMap,
              whatsappDraft: action.textContent ?? prev.whatsappDraft,
              pendingAction: null,
            };
          }
          case 'send_whatsapp':
          case 'auto_reply_whatsapp': {
            const { contactName, messagesMap } = ensureContactThread(prev, action.contactName);
            const textToSend = action.textContent || prev.whatsappDraft;
            if (!textToSend) {
              return {
                ...prev,
                ...pushScreen('whatsapp'),
                activeContact: contactName,
                whatsappMessages: messagesMap,
                pendingAction: null,
              };
            }
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const existing = messagesMap[contactName] ?? [];
            return {
              ...prev,
              ...pushScreen('whatsapp'),
              activeContact: contactName,
              whatsappDraft: '',
              whatsappMessages: {
                ...messagesMap,
                [contactName]: [
                  ...existing,
                  {
                    id: `${Date.now()}`,
                    sender: 'me',
                    text: textToSend,
                    time,
                    isAutoReply: action.actionType === 'auto_reply_whatsapp',
                  },
                ],
              },
              pendingAction: null,
            };
          }
          case 'toggle_auto_reply': {
            const nextState =
              typeof action.autoReplyState === 'boolean'
                ? action.autoReplyState
                : !prev.autoReplyEnabled;
            return {
              ...prev,
              autoReplyEnabled: nextState,
              pendingAction: null,
            };
          }
          case 'navigate_back': {
            if (prev.screenHistory.length <= 1) {
              return { ...prev, currentScreen: 'home', isCallActive: false, pendingAction: null };
            }
            const nextHist = prev.screenHistory.slice(0, -1);
            return {
              ...prev,
              currentScreen: nextHist[nextHist.length - 1] ?? 'home',
              screenHistory: nextHist,
              isCallActive: false,
              pendingAction: null,
            };
          }
          case 'navigate_home':
            return {
              ...prev,
              ...pushScreen('home'),
              isCallActive: false,
              pendingAction: null,
            };
          case 'navigate_recents':
            return {
              ...prev,
              ...pushScreen('recents'),
              pendingAction: null,
            };
          case 'scroll_down':
            return { ...prev, scrollOffset: Math.min(prev.scrollOffset + 1, 4) };
          case 'scroll_up':
            return { ...prev, scrollOffset: Math.max(prev.scrollOffset - 1, 0) };
          case 'toggle_setting': {
            const key = action.settingKey;
            if (!key) return prev;
            const nextVal =
              typeof action.settingValue === 'boolean' ? action.settingValue : !prev.settings[key];
            return {
              ...prev,
              settings: {
                ...prev.settings,
                [key]: nextVal,
              },
              pendingAction: null,
            };
          }
          default:
            return prev;
        }
      });
    },
    []
  );

  const startListeningCycleRef = useRef<() => void>(() => {});

  const handleSimulateIncomingMessage = useCallback(async () => {
    const senderName = deviceRef.current.activeContact || 'Ankit';
    const sampleText =
      SIMULATED_INCOMING_PROMPTS[Math.floor(Math.random() * SIMULATED_INCOMING_PROMPTS.length)];
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setDevice((prev) => {
      const existing = prev.whatsappMessages[senderName] ?? [];
      return {
        ...prev,
        currentScreen: 'whatsapp',
        whatsappMessages: {
          ...prev.whatsappMessages,
          [senderName]: [
            ...existing,
            { id: `in-${Date.now()}`, sender: 'contact', text: sampleText, time },
          ],
        },
      };
    });

    if (!deviceRef.current.autoReplyEnabled) {
      const notice = `${senderName} ka naya message aaya hai: "${sampleText}".`;
      setConversation((prev) => [
        ...prev,
        {
          id: `n-${Date.now()}`,
          role: 'nova',
          text: notice,
          timestamp: time,
          actionBadge: `Incoming WhatsApp · ${senderName}`,
        },
      ]);
      playAudioOrSpeak(notice);
      return;
    }

    setIsThinking(true);
    try {
      const history = deviceRef.current.whatsappMessages[senderName] ?? [];
      const res = await fetch('/api/nova/whatsapp-autoreply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName,
          incomingMessage: sampleText,
          history,
          voiceMode,
        }),
      });
      const data = (await res.json()) as {
        replyMessage?: string;
        novaAnnouncement?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Auto-reply failed');
      }

      const replyMessage = data.replyMessage || 'Ji, main thodi der mein update karti hoon.';
      const announcement =
        data.novaAnnouncement ||
        `${senderName} ka message aaya tha, maine khud se reply bhej diya: "${replyMessage}"`;

      applyExecutableAction({
        actionType: 'auto_reply_whatsapp',
        contactName: senderName,
        textContent: replyMessage,
      });

      setConversation((prev) => [
        ...prev,
        {
          id: `n-${Date.now()}`,
          role: 'nova',
          text: announcement,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actionBadge: `WhatsApp Auto-Reply · ${senderName}`,
        },
      ]);
      playAudioOrSpeak(announcement);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Auto-reply failed.');
    } finally {
      setIsThinking(false);
    }
  }, [applyExecutableAction, playAudioOrSpeak, voiceMode]);

  const sendCommand = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || isThinking) return;

      setErrorMsg(null);
      setInputText('');
      setInterimTranscript('');

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const userEntry: ConversationEntry = {
        id: `u-${Date.now()}`,
        role: 'user',
        text,
        timestamp: nowStr,
      };
      setConversation((prev) => [...prev, userEntry]);

      // Instant sub-10ms local execution
      const instantCmd = tryLocalInstantCommand(
        text,
        deviceRef.current,
        voiceMode,
        requireConfirmation
      );
      if (instantCmd) {
        if (instantCmd.needsConfirmation) {
          const pending: PendingAction = {
            actionType: instantCmd.actionType,
            summary: instantCmd.confirmationSummary || instantCmd.replyText,
            appName: instantCmd.appName,
            phoneNumber: instantCmd.phoneNumber,
            contactName: instantCmd.contactName,
            textContent: instantCmd.textContent,
            settingKey: instantCmd.settingKey,
            settingValue: instantCmd.settingValue,
          };
          setDevice((prev) => ({ ...prev, pendingAction: pending }));
        } else if (instantCmd.actionType === 'confirm_pending' && deviceRef.current.pendingAction) {
          applyExecutableAction(deviceRef.current.pendingAction);
        } else if (instantCmd.actionType === 'cancel_pending') {
          setDevice((prev) => ({ ...prev, pendingAction: null }));
        } else {
          applyExecutableAction(instantCmd);
        }
        setConversation((prev) => [
          ...prev,
          {
            id: `n-${Date.now()}`,
            role: 'nova',
            text: instantCmd.replyText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            actionBadge: instantCmd.appName
              ? `Instant · ${instantCmd.appName}`
              : instantCmd.actionType === 'none'
                ? 'Instant Reply'
                : `Instant · ${instantCmd.actionType.replace(/_/g, ' ')}`,
          },
        ]);
        playAudioOrSpeak(instantCmd.replyText, undefined, undefined, () => {
          if (voiceAssistantActiveRef.current) startListeningCycleRef.current();
        });
        return;
      }

      setIsThinking(true);
      try {
        const res = await fetch('/api/nova/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: text,
            history: conversationRef.current.slice(-8).map((c) => ({ role: c.role, text: c.text })),
            config: {
              voiceMode,
              brainMode,
              requireConfirmation,
              fastProcessing,
              includeAudio: speechOutputMode === 'gemini_tts',
            },
            deviceState: deviceRef.current,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Server error (${res.status})`);
        }

        const cmd = data as NovaCommandResponse;

        if (cmd.needsConfirmation) {
          const pending: PendingAction = {
            actionType: cmd.actionType,
            summary: cmd.confirmationSummary || cmd.replyText,
            appName: cmd.appName,
            phoneNumber: cmd.phoneNumber,
            contactName: cmd.contactName,
            textContent: cmd.textContent,
            settingKey: cmd.settingKey,
            settingValue: cmd.settingValue,
          };
          setDevice((prev) => ({ ...prev, pendingAction: pending }));
        } else if (cmd.actionType === 'confirm_pending' && deviceRef.current.pendingAction) {
          const toExecute = deviceRef.current.pendingAction;
          applyExecutableAction(toExecute);
        } else if (cmd.actionType === 'cancel_pending') {
          setDevice((prev) => ({ ...prev, pendingAction: null }));
        } else {
          applyExecutableAction(cmd);
        }

        const actionLabel =
          cmd.actionType !== 'none'
            ? cmd.needsConfirmation
              ? `Awaiting confirmation · ${cmd.actionType.replace(/_/g, ' ')}`
              : cmd.appName
                ? `${cmd.actionType.replace(/_/g, ' ')} · ${cmd.appName}`
                : cmd.contactName
                  ? `${cmd.actionType.replace(/_/g, ' ')} · ${cmd.contactName}`
                  : cmd.actionType.replace(/_/g, ' ')
            : undefined;

        const novaEntry: ConversationEntry = {
          id: `n-${Date.now()}`,
          role: 'nova',
          text: cmd.replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actionBadge: actionLabel,
          needsConfirmation: cmd.needsConfirmation,
        };
        setConversation((prev) => [...prev, novaEntry]);
        playAudioOrSpeak(cmd.replyText, cmd.audioBase64, cmd.audioMimeType, () => {
          if (voiceAssistantActiveRef.current) startListeningCycleRef.current();
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unable to reach NOVA backend.';
        setErrorMsg(message);
        if (voiceAssistantActiveRef.current) {
          setVoiceAssistantActive(false);
        }
      } finally {
        setIsThinking(false);
      }
    },
    [
      isThinking,
      voiceMode,
      brainMode,
      requireConfirmation,
      fastProcessing,
      speechOutputMode,
      applyExecutableAction,
      playAudioOrSpeak,
    ]
  );

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const startListeningCycle = useCallback(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setVoiceAssistantActive(false);
      setErrorMsg('Browser Speech Recognition is not available here. Type a command below.');
      return;
    }

    stopAllAudio();
    clearSilenceTimer();
    setErrorMsg(null);

    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore prior instance stop error
    }

    const recognition = new SpeechRec();
    recognition.lang = voiceMode === 'english_female' ? 'en-IN' : 'hi-IN';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    let dispatched = false;
    let latestTranscript = '';

    const finalizeAndSend = (textToSend: string) => {
      if (dispatched || !textToSend.trim()) return;
      dispatched = true;
      clearSilenceTimer();
      setIsListening(false);
      setInterimTranscript('');
      try {
        recognition.stop();
      } catch {
        // ignore stop error
      }
      sendCommand(textToSend.trim());
    };

    recognition.onresult = (event) => {
      let fullText = '';
      let hasFinal = false;

      for (let i = 0; i < event.results.length; i += 1) {
        const res = event.results[i];
        fullText += res[0].transcript;
        if (res.isFinal) hasFinal = true;
      }

      latestTranscript = fullText.trim();
      setInterimTranscript(latestTranscript);

      if (hasFinal && latestTranscript) {
        finalizeAndSend(latestTranscript);
        return;
      }

      clearSilenceTimer();
      if (latestTranscript) {
        silenceTimerRef.current = window.setTimeout(() => {
          finalizeAndSend(latestTranscript);
        }, 550);
      }
    };

    recognition.onerror = (ev) => {
      clearSilenceTimer();
      setIsListening(false);
      if (ev.error === 'no-speech' && voiceAssistantActiveRef.current) {
        window.setTimeout(() => {
          if (voiceAssistantActiveRef.current) startListeningCycleRef.current();
        }, 250);
        return;
      }
      if (ev.error !== 'no-speech' && ev.error !== 'aborted') {
        setVoiceAssistantActive(false);
        setErrorMsg(`Microphone error: ${ev.error}. You can also type commands directly.`);
      }
    };

    recognition.onend = () => {
      clearSilenceTimer();
      setIsListening(false);
      if (!dispatched && latestTranscript) {
        finalizeAndSend(latestTranscript);
      }
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [voiceMode, stopAllAudio, sendCommand]);

  useEffect(() => {
    startListeningCycleRef.current = startListeningCycle;
  }, [startListeningCycle]);

  const toggleVoiceAssistantPower = () => {
    if (voiceAssistantActive || isListening) {
      setVoiceAssistantActive(false);
      voiceAssistantActiveRef.current = false;
      clearSilenceTimer();
      stopAllAudio();
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      setInterimTranscript('');
      return;
    }

    setVoiceAssistantActive(true);
    voiceAssistantActiveRef.current = true;
    startListeningCycle();
  };

  const handleApprovePending = () => {
    if (!device.pendingAction) return;
    const pending = device.pendingAction;
    applyExecutableAction(pending);
    const reply =
      voiceMode === 'english_female'
        ? 'Confirmed. Executing your request now.'
        : 'Theek hai, permission mil gayi. Main abhi kar rahi hoon.';
    setConversation((prev) => [
      ...prev,
      {
        id: `n-${Date.now()}`,
        role: 'nova',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionBadge: `Confirmed · ${pending.actionType.replace(/_/g, ' ')}`,
      },
    ]);
    playAudioOrSpeak(reply);
  };

  const handleCancelPending = () => {
    setDevice((prev) => ({ ...prev, pendingAction: null }));
    const reply =
      voiceMode === 'english_female'
        ? 'Cancelled. I will not proceed.'
        : 'Theek hai, maine action cancel kar diya.';
    setConversation((prev) => [
      ...prev,
      {
        id: `n-${Date.now()}`,
        role: 'nova',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actionBadge: 'Cancelled',
      },
    ]);
    playAudioOrSpeak(reply);
  };

  const handleDownloadApkKitZip = () => {
    const a = document.createElement('a');
    a.href = '/api/nova/download-android-zip';
    a.download = 'NOVA-AI-Manager-APK-Kit.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleResetSession = () => {
    setVoiceAssistantActive(false);
    voiceAssistantActiveRef.current = false;
    stopAllAudio();
    clearSilenceTimer();
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    setIsListening(false);
    setDevice(INITIAL_DEVICE_STATE);
    setErrorMsg(null);
    setConversation([
      {
        id: `welcome-${Date.now()}`,
        role: 'nova',
        text: 'Session reset. Voice Listening ON button dabakar command bolein.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 Zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('studio')}
            className="text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0 text-left"
          >
            NOVA AI Manager
          </button>

          {/* Zone 2: Clean single-line navigation links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
            {(
              [
                { id: 'studio', label: 'Voice Studio' },
                { id: 'kotlin', label: 'Android Code' },
                { id: 'guide', label: 'Command Guide' },
                { id: 'setup', label: 'Custom Setup' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors border-b-2 ${
                  activeTab === item.id
                    ? 'text-slate-900 border-indigo-600'
                    : 'text-slate-600 border-transparent hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setIsApkModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install / APK</span>
            </button>
          </div>
        </div>

        {/* Mobile Nav Switcher */}
        <div className="md:hidden border-t border-slate-100 px-4 py-2 flex items-center gap-4 overflow-x-auto text-xs font-medium">
          {(
            [
              { id: 'studio', label: 'Voice Studio' },
              { id: 'kotlin', label: 'Android Code' },
              { id: 'guide', label: 'Command Guide' },
              { id: 'setup', label: 'Custom Setup' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`whitespace-nowrap shrink-0 py-1 ${
                activeTab === item.id ? 'text-indigo-600 font-semibold' : 'text-slate-600'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {activeTab === 'studio' && (
          <div className="space-y-8">
            {/* Hero Intro & Quick Config Bar */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-200">
              <div className="space-y-2 max-w-2xl">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
                  Full-Phone & WhatsApp Auto-Reply AI Manager
                </h1>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Turn Voice Listening ON for continuous hands-free Hindi & English conversation,
                  instant mobile app control, and automatic WhatsApp messaging.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
                  {(
                    [
                      { id: 'hinglish_female', label: 'Hindi + English' },
                      { id: 'hindi_female', label: 'Hindi Female' },
                      { id: 'english_female', label: 'English Female' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setVoiceMode(opt.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                        voiceMode === opt.id
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setFastProcessing((f) => !f)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors ${
                    fastProcessing
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{fastProcessing ? 'Speed: Ultra-Fast' : 'Speed: Deep Brain'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRequireConfirmation((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors ${
                    !requireConfirmation
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-indigo-50 border-indigo-200 text-indigo-800'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{!requireConfirmation ? 'Follow Commands: Direct' : 'Ask Before Call'}</span>
                </button>

                <PWAInstallButton />
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start justify-between gap-3 text-sm text-red-800">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
                  <span>{errorMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setErrorMsg(null)}
                  className="text-red-500 hover:text-red-700 shrink-0"
                  aria-label="Dismiss error"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Two-Column Studio Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              {/* Left: Tactile Voice Assistant Console */}
              <div className="lg:col-span-7 flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden">
                {/* Tactile Voice Listening ON / OFF Dock */}
                <div
                  className={`px-5 py-4 border-b transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    voiceAssistantActive || isListening
                      ? 'bg-slate-900 border-slate-800 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <button
                      type="button"
                      onClick={toggleVoiceAssistantPower}
                      aria-pressed={voiceAssistantActive || isListening}
                      className={`relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-sm border ${
                        voiceAssistantActive || isListening
                          ? 'bg-red-600 hover:bg-red-500 border-red-400 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-500 text-white'
                      }`}
                    >
                      {voiceAssistantActive || isListening ? (
                        <Mic className="w-6 h-6" />
                      ) : (
                        <MicOff className="w-6 h-6" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold tracking-tight">
                          {isListening
                            ? 'Voice Listening: ON'
                            : isSpeaking
                              ? 'NOVA Speaking...'
                              : isThinking
                                ? 'Processing Command...'
                                : voiceAssistantActive
                                  ? 'Voice Assistant: Active'
                                  : 'Voice Listening: OFF'}
                        </span>
                      </div>
                      <p
                        className={`text-xs mt-0.5 truncate ${
                          voiceAssistantActive || isListening ? 'text-slate-300' : 'text-slate-600'
                        }`}
                      >
                        {interimTranscript
                          ? `“${interimTranscript}”`
                          : isListening
                            ? 'Bolein — 550ms silence par turant reply milega'
                            : voiceAssistantActive
                              ? 'Continuous hands-free loop ready'
                              : 'Tap Mic button to turn Voice Listening ON'}
                      </p>
                    </div>
                  </div>

                  {/* Tactile ON / OFF Hardware Switch Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={toggleVoiceAssistantPower}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95 border whitespace-nowrap ${
                        voiceAssistantActive || isListening
                          ? 'bg-white text-slate-900 border-white hover:bg-slate-100'
                          : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>
                        {voiceAssistantActive || isListening
                          ? 'Turn Listening OFF'
                          : 'Turn Listening ON'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Secondary Toolbar */}
                <div className="px-5 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-white">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">Voice Assistant</span>
                    <span aria-hidden="true">·</span>
                    <span>{brainMode === 'memory' ? 'Memory ON' : 'Single-Turn'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSimulateIncomingMessage}
                      disabled={isThinking}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-xs font-medium text-emerald-800 whitespace-nowrap disabled:opacity-50"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>Test Incoming WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setSpeechOutputMode((m) =>
                          m === 'browser_tts' ? 'gemini_tts' : m === 'gemini_tts' ? 'muted' : 'browser_tts'
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap"
                    >
                      {speechOutputMode === 'muted' ? (
                        <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                      )}
                      <span>
                        {speechOutputMode === 'browser_tts'
                          ? 'Fast Voice'
                          : speechOutputMode === 'gemini_tts'
                            ? 'HD Voice'
                            : 'Muted'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetSession}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-600 whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>

                {/* Conversation Timeline */}
                <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[410px] min-h-[320px]">
                  {conversation.map((entry) => (
                    <div
                      key={entry.id}
                      className={`flex flex-col ${
                        entry.role === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-1">
                        <span className="font-medium text-slate-700">
                          {entry.role === 'user' ? 'You' : 'NOVA'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums font-mono">{entry.timestamp}</span>
                        {entry.actionBadge && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-indigo-700 font-medium capitalize">
                              {entry.actionBadge}
                            </span>
                          </>
                        )}
                      </div>

                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          entry.role === 'user'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-900 border border-slate-200/80'
                        }`}
                      >
                        <p>{entry.text}</p>
                        {entry.role === 'nova' && (
                          <button
                            type="button"
                            onClick={() => playAudioOrSpeak(entry.text)}
                            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 hover:text-indigo-900"
                          >
                            <Volume2 className="w-3 h-3" />
                            <span>Replay voice</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {isThinking && (
                    <div className="flex flex-col items-start">
                      <span className="text-[11px] text-slate-500 mb-1">NOVA · Fast Processing</span>
                      <div className="rounded-2xl px-4 py-2.5 text-sm bg-slate-100 text-slate-600 border border-slate-200/80">
                        Command process kar rahi hoon...
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Permission Request Strip in Console */}
                {device.pendingAction && (
                  <div className="mx-5 mb-3 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-indigo-950">
                        Permission Required Before Action
                      </p>
                      <p className="text-xs text-indigo-800 mt-0.5">
                        {device.pendingAction.summary}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleApprovePending}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Haan, Allow</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelPending}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Quick Commands */}
                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center gap-2 overflow-x-auto">
                  {QUICK_COMMANDS.map((cmd) => (
                    <button
                      key={cmd}
                      type="button"
                      onClick={() => sendCommand(cmd)}
                      disabled={isThinking}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0 transition-colors disabled:opacity-50"
                    >
                      {cmd}
                    </button>
                  ))}
                </div>

                {/* Text Command Composer */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendCommand(inputText);
                  }}
                  className="p-4 border-t border-slate-200 bg-white flex items-center gap-2.5"
                >
                  <input
                    type="text"
                    value={isListening && interimTranscript ? interimTranscript : inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      isListening
                        ? 'Sun rahi hoon — bolte rahiye...'
                        : 'Koi bhi baat ya command likhein (e.g. "Instagram kholo", "Kaise ho?")'
                    }
                    className="flex-1 h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500"
                  />

                  <button
                    type="submit"
                    disabled={!inputText.trim() || isThinking}
                    className="h-11 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </form>
              </div>

              {/* Right: Live Target Android Phone Simulator */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center">
                <AndroidPhoneSimulator
                  device={device}
                  isListening={isListening || voiceAssistantActive}
                  isSpeaking={isSpeaking}
                  onToggleListening={toggleVoiceAssistantPower}
                  onNavigateScreen={(screen, appLabel) =>
                    setDevice((prev) => ({
                      ...prev,
                      currentScreen: screen,
                      activeAppName: appLabel ?? prev.activeAppName,
                      activeAppQuery: '',
                      screenHistory: [...prev.screenHistory, screen].slice(-10),
                    }))
                  }
                  onNavigateBack={() => applyExecutableAction({ actionType: 'navigate_back' })}
                  onNavigateHome={() => applyExecutableAction({ actionType: 'navigate_home' })}
                  onToggleSetting={(key) =>
                    applyExecutableAction({ actionType: 'toggle_setting', settingKey: key })
                  }
                  onToggleAutoReply={() =>
                    applyExecutableAction({ actionType: 'toggle_auto_reply' })
                  }
                  onSimulateIncomingMessage={handleSimulateIncomingMessage}
                  onSelectContact={(name) =>
                    setDevice((prev) => ({ ...prev, activeContact: name }))
                  }
                  onUpdateNotes={(val) => setDevice((prev) => ({ ...prev, notesText: val }))}
                  onUpdateAppQuery={(screen, val) =>
                    setDevice((prev) => ({
                      ...prev,
                      youtubeQuery: screen === 'youtube' ? val : prev.youtubeQuery,
                      chromeQuery: screen === 'chrome' ? val : prev.chromeQuery,
                      activeAppQuery: screen === 'universal_app' ? val : prev.activeAppQuery,
                    }))
                  }
                  onUpdateWhatsappDraft={(val) =>
                    setDevice((prev) => ({ ...prev, whatsappDraft: val }))
                  }
                  onSendWhatsappDraft={() =>
                    applyExecutableAction({ actionType: 'send_whatsapp' })
                  }
                  quickReplies={activeQuickReplies}
                  isLoadingQuickReplies={isLoadingQuickReplies}
                  onSendQuickReply={(text) =>
                    applyExecutableAction({
                      actionType: 'send_whatsapp',
                      contactName: device.activeContact,
                      textContent: text,
                    })
                  }
                  onEndCall={() =>
                    setDevice((prev) => ({ ...prev, isCallActive: false }))
                  }
                  onApprovePending={handleApprovePending}
                  onCancelPending={handleCancelPending}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'kotlin' && (
          <KotlinStudioView onOpenApkModal={() => setIsApkModalOpen(true)} />
        )}

        {activeTab === 'guide' && (
          <CommandGuideView
            onTryCommand={(cmd) => {
              setActiveTab('studio');
              setTimeout(() => sendCommand(cmd), 60);
            }}
          />
        )}

        {activeTab === 'setup' && (
          <section className="space-y-8 max-w-3xl">
            <div className="space-y-1.5 pb-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                NOVA AI Custom Setup
              </h2>
              <p className="text-sm text-slate-600">
                Configure voice speed, AI processing latency, WhatsApp auto-reply, and permission
                rules.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200">
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Female Voice Profile</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select Hindi Female, English Female, or bilingual Hinglish response tone.
                  </p>
                </div>
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {(
                    [
                      { id: 'hindi_female', label: 'Hindi Female' },
                      { id: 'english_female', label: 'English Female' },
                      { id: 'hinglish_female', label: 'Hindi + English' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setVoiceMode(opt.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                        voiceMode === opt.id
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Command Processing Speed</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ultra-Fast executes local commands instantaneously and uses Flash Lite for
                    sub-second AI parsing.
                  </p>
                </div>
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {(
                    [
                      { id: true, label: 'Ultra-Fast' },
                      { id: false, label: 'Deep Reasoning' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={String(opt.id)}
                      type="button"
                      onClick={() => setFastProcessing(opt.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                        fastProcessing === opt.id
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Voice Response Speed</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Fast Voice speaks instantaneously; HD Gemini Voice generates studio audio in one
                    round trip.
                  </p>
                </div>
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {(
                    [
                      { id: 'browser_tts', label: 'Fast Voice' },
                      { id: 'gemini_tts', label: 'HD Voice' },
                      { id: 'muted', label: 'Muted' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSpeechOutputMode(opt.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                        speechOutputMode === opt.id
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">AI Brain Mode</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Keep multi-turn context memory across commands or treat each query standalone.
                  </p>
                </div>
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                  {(
                    [
                      { id: 'memory', label: 'AI + Memory + Voice' },
                      { id: 'stateless', label: 'AI + Voice Only' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setBrainMode(opt.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                        brainMode === opt.id
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Permission Before Phone Calls
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ask confirmation before placing calls or execute all commands immediately.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRequireConfirmation((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    requireConfirmation
                      ? 'bg-indigo-600 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{requireConfirmation ? 'Ask Before Call: On' : 'Follow Commands: Direct'}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('studio')}
                className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors"
              >
                Open Live Voice Studio
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('kotlin')}
                className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-sm font-medium transition-colors"
              >
                Inspect Android Code
              </button>
            </div>
          </section>
        )}
      </main>

      <ApkDownloadModal
        isOpen={isApkModalOpen}
        onClose={() => setIsApkModalOpen(false)}
        onDownloadZip={handleDownloadApkKitZip}
      />

      <OfflineIndicator />
    </div>
  );
}
