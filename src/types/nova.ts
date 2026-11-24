export type VoiceMode = 'hinglish_female' | 'hindi_female' | 'english_female';
export type BrainMode = 'memory' | 'stateless';
export type SpeechOutputMode = 'gemini_tts' | 'browser_tts' | 'muted';

export type NovaActionType =
  | 'none'
  | 'open_app'
  | 'dial_call'
  | 'type_text'
  | 'draft_whatsapp'
  | 'send_whatsapp'
  | 'read_whatsapp'
  | 'auto_reply_whatsapp'
  | 'toggle_auto_reply'
  | 'click_ui_element'
  | 'set_reminder'
  | 'navigate_back'
  | 'navigate_home'
  | 'navigate_recents'
  | 'scroll_down'
  | 'scroll_up'
  | 'toggle_setting'
  | 'confirm_pending'
  | 'cancel_pending';

export type PhoneScreen =
  | 'home'
  | 'phone'
  | 'whatsapp'
  | 'youtube'
  | 'chrome'
  | 'notes'
  | 'settings'
  | 'camera'
  | 'recents'
  | 'universal_app';

export interface DeviceSettings {
  wifi: boolean;
  bluetooth: boolean;
  flashlight: boolean;
  dnd: boolean;
}

export interface ContactEntry {
  name: string;
  phone: string;
  relation?: string;
}

export interface PendingAction {
  actionType: NovaActionType;
  summary: string;
  appName?: string;
  phoneNumber?: string;
  contactName?: string;
  textContent?: string;
  settingKey?: keyof DeviceSettings;
  settingValue?: boolean;
}

export interface WhatsAppMessage {
  id: string;
  sender: 'me' | 'contact';
  text: string;
  time: string;
  isAutoReply?: boolean;
}

export interface ReminderItem {
  id: string;
  title: string;
  time: string;
}

export interface DeviceState {
  currentScreen: PhoneScreen;
  screenHistory: PhoneScreen[];
  activeAppName: string;
  activeAppQuery: string;
  lastClickedElement: string;
  activeContact: string;
  autoReplyEnabled: boolean;
  contacts: ContactEntry[];
  whatsappDraft: string;
  whatsappMessages: Record<string, WhatsAppMessage[]>;
  notesText: string;
  reminders: ReminderItem[];
  chromeQuery: string;
  youtubeQuery: string;
  dialedNumber: string;
  isCallActive: boolean;
  callContactName: string;
  scrollOffset: number;
  settings: DeviceSettings;
  pendingAction: PendingAction | null;
}

export interface NovaCommandConfig {
  voiceMode: VoiceMode;
  brainMode: BrainMode;
  requireConfirmation: boolean;
  includeAudio?: boolean;
}

export interface NovaCommandResponse {
  replyText: string;
  actionType: NovaActionType;
  appName?: string;
  phoneNumber?: string;
  contactName?: string;
  textContent?: string;
  reminderTime?: string;
  settingKey?: keyof DeviceSettings;
  settingValue?: boolean;
  autoReplyState?: boolean;
  needsConfirmation: boolean;
  confirmationSummary?: string;
  detectedLanguage: 'hi' | 'en' | 'hinglish';
  audioBase64?: string;
  audioMimeType?: string;
}

export interface ConversationEntry {
  id: string;
  role: 'user' | 'nova';
  text: string;
  timestamp: string;
  actionBadge?: string;
  needsConfirmation?: boolean;
}
