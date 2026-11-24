import React from 'react';
import {
  Bluetooth,
  Bot,
  Camera,
  Check,
  ChevronLeft,
  Circle,
  Clock,
  Flashlight,
  Globe,
  Instagram,
  Mail,
  MapPin,
  MessageSquare,
  Moon,
  Music,
  NotebookPen,
  Phone,
  PhoneCall,
  PhoneOff,
  Search,
  Send,
  Settings,
  Smartphone,
  Square,
  Video,
  Wifi,
  X,
} from 'lucide-react';
import { DeviceState, PhoneScreen } from '../types/nova';

interface AndroidPhoneSimulatorProps {
  device: DeviceState;
  isListening: boolean;
  isSpeaking: boolean;
  onToggleListening: () => void;
  onNavigateScreen: (screen: PhoneScreen, appLabel?: string) => void;
  onNavigateBack: () => void;
  onNavigateHome: () => void;
  onToggleSetting: (key: keyof DeviceState['settings']) => void;
  onToggleAutoReply: () => void;
  onSimulateIncomingMessage: () => void;
  onSelectContact: (name: string) => void;
  onUpdateNotes: (val: string) => void;
  onUpdateAppQuery: (screen: PhoneScreen, val: string) => void;
  onUpdateWhatsappDraft: (val: string) => void;
  onSendWhatsappDraft: () => void;
  quickReplies: string[];
  isLoadingQuickReplies: boolean;
  onSendQuickReply: (text: string) => void;
  onEndCall: () => void;
  onApprovePending: () => void;
  onCancelPending: () => void;
}

const WALLPAPER_SRC = '/src/assets/images/android_device_wallpaper_1795554434131.jpg';
const EMBLEM_SRC = '/src/assets/images/nova_assistant_emblem_1795554434025.jpg';

export const AndroidPhoneSimulator: React.FC<AndroidPhoneSimulatorProps> = ({
  device,
  isListening,
  isSpeaking,
  onToggleListening,
  onNavigateScreen,
  onNavigateBack,
  onNavigateHome,
  onToggleSetting,
  onToggleAutoReply,
  onSimulateIncomingMessage,
  onSelectContact,
  onUpdateNotes,
  onUpdateAppQuery,
  onUpdateWhatsappDraft,
  onSendWhatsappDraft,
  quickReplies,
  isLoadingQuickReplies,
  onSendQuickReply,
  onEndCall,
  onApprovePending,
  onCancelPending,
}) => {
  const nowStr = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const apps: {
    id: PhoneScreen;
    label: string;
    icon: React.ReactNode;
    bg: string;
  }[] = [
    { id: 'youtube', label: 'YouTube', icon: <Video className="w-5 h-5 text-white" />, bg: 'bg-red-600' },
    { id: 'whatsapp', label: 'WhatsApp', icon: <MessageSquare className="w-5 h-5 text-white" />, bg: 'bg-emerald-600' },
    { id: 'universal_app', label: 'Instagram', icon: <Instagram className="w-5 h-5 text-white" />, bg: 'bg-pink-600' },
    { id: 'universal_app', label: 'Spotify', icon: <Music className="w-5 h-5 text-white" />, bg: 'bg-green-600' },
    { id: 'universal_app', label: 'Maps', icon: <MapPin className="w-5 h-5 text-white" />, bg: 'bg-teal-600' },
    { id: 'universal_app', label: 'Telegram', icon: <Send className="w-5 h-5 text-white" />, bg: 'bg-sky-500' },
    { id: 'chrome', label: 'Chrome', icon: <Globe className="w-5 h-5 text-white" />, bg: 'bg-blue-600' },
    { id: 'universal_app', label: 'Gmail', icon: <Mail className="w-5 h-5 text-white" />, bg: 'bg-rose-600' },
    { id: 'phone', label: 'Phone', icon: <Phone className="w-5 h-5 text-white" />, bg: 'bg-indigo-600' },
    { id: 'notes', label: 'Notes', icon: <NotebookPen className="w-5 h-5 text-white" />, bg: 'bg-amber-600' },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5 text-white" />, bg: 'bg-slate-600' },
    { id: 'camera', label: 'Camera', icon: <Camera className="w-5 h-5 text-white" />, bg: 'bg-zinc-700' },
  ];

  const chatContacts = Array.from(
    new Set([
      ...device.contacts.map((c) => c.name),
      ...Object.keys(device.whatsappMessages),
      device.activeContact,
    ])
  );

  const activeMessages = device.whatsappMessages[device.activeContact] ?? [
    {
      id: `init-${device.activeContact}`,
      sender: 'contact',
      text: `Hi! ${device.activeContact} chat open hai. Message type ya speak karein.`,
      time: nowStr,
    },
  ];

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-[360px] rounded-[40px] bg-slate-900 p-3 border border-slate-800 shadow-xl">
        <div className="relative flex flex-col h-[640px] rounded-[30px] overflow-hidden bg-slate-950 text-slate-100 border border-slate-800">
          {/* Status Bar */}
          <div className="relative z-20 flex items-center justify-between px-5 pt-3 pb-2 text-xs font-medium text-slate-200 bg-slate-950/80 backdrop-blur-sm">
            <span className="tabular-nums font-mono">{nowStr}</span>
            <div className="w-16 h-4 rounded-full bg-slate-900 border border-slate-800" aria-hidden="true" />
            <div className="flex items-center gap-2 text-slate-300">
              {device.autoReplyEnabled && <Bot className="w-3.5 h-3.5 text-emerald-400" />}
              {device.settings.dnd && <Moon className="w-3.5 h-3.5 text-amber-400" />}
              {device.settings.flashlight && <Flashlight className="w-3.5 h-3.5 text-amber-300" />}
              {device.settings.bluetooth && <Bluetooth className="w-3.5 h-3.5 text-sky-400" />}
              {device.settings.wifi ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <span className="text-[10px] text-slate-500 font-mono">OFF</span>
              )}
              <span className="tabular-nums font-mono text-[11px]">94%</span>
            </div>
          </div>

          {/* Pending Permission Overlay */}
          {device.pendingAction && (
            <div className="relative z-30 mx-3 mt-1 rounded-2xl bg-slate-900/95 border border-indigo-500/40 p-3.5 shadow-lg">
              <p className="text-xs font-semibold text-indigo-300 mb-1">NOVA Permission Request</p>
              <p className="text-xs text-slate-200 leading-relaxed mb-3">
                {device.pendingAction.summary}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onApprovePending}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Allow</span>
                </button>
                <button
                  type="button"
                  onClick={onCancelPending}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          )}

          {/* Active Phone Viewport */}
          <div className="relative flex-1 overflow-y-auto">
            {device.currentScreen === 'home' && (
              <div className="relative min-h-full flex flex-col justify-between p-4">
                <img
                  src={WALLPAPER_SRC}
                  alt="Android wallpaper"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/30 to-slate-950/90" />

                <div className="relative z-10 space-y-2.5">
                  {/* Interactive NOVA Voice Listening Widget */}
                  <button
                    type="button"
                    onClick={onToggleListening}
                    aria-pressed={isListening}
                    className={`w-full text-left rounded-2xl backdrop-blur-md border p-3 flex items-center gap-3 transition-all active:scale-[0.98] ${
                      isListening
                        ? 'bg-red-950/90 border-red-500/70'
                        : 'bg-slate-900/85 border-slate-700/60 hover:border-indigo-500/60'
                    }`}
                  >
                    <img
                      src={EMBLEM_SRC}
                      alt="NOVA emblem"
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-xl object-cover shrink-0 border border-slate-700"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white truncate">NOVA AI Manager</p>
                        <span
                          className={`text-[10px] font-mono font-semibold shrink-0 ${
                            isListening ? 'text-red-300' : 'text-indigo-300'
                          }`}
                        >
                          {isListening ? 'LISTENING ON' : 'TAP TO LISTEN'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 truncate mt-0.5">
                        {isListening
                          ? 'Sun rahi hoon — Hindi ya English bolein'
                          : isSpeaking
                            ? 'Speaking response...'
                            : device.autoReplyEnabled
                              ? 'All-App + WhatsApp Auto-Reply ON'
                              : 'All-App Accessibility Control'}
                      </p>
                    </div>
                  </button>

                  {/* Quick Search/Status Bar */}
                  <div className="rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/60 px-3 py-2 flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-xs text-slate-300 truncate">
                      {device.notesText
                        ? `Typed: "${device.notesText}"`
                        : 'Say any app name or WhatsApp contact'}
                    </span>
                  </div>

                  {device.reminders.length > 0 && (
                    <div className="rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/60 px-3 py-2 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-300">
                        <Clock className="w-3 h-3" />
                        <span>Reminder</span>
                      </div>
                      <p className="text-xs text-slate-200 truncate">
                        {device.reminders[device.reminders.length - 1].title} ·{' '}
                        <span className="font-mono">
                          {device.reminders[device.reminders.length - 1].time}
                        </span>
                      </p>
                    </div>
                  )}
                </div>

                {/* 12-App Grid */}
                <div className="relative z-10 grid grid-cols-4 gap-x-2.5 gap-y-3 pt-4 pb-1">
                  {apps.map((app) => (
                    <button
                      key={app.label}
                      type="button"
                      onClick={() => onNavigateScreen(app.id, app.label)}
                      className="flex flex-col items-center gap-1 group"
                    >
                      <div
                        className={`w-11 h-11 rounded-2xl ${app.bg} flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform`}
                      >
                        {app.icon}
                      </div>
                      <span className="text-[11px] font-medium text-slate-200 truncate w-full text-center">
                        {app.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {device.currentScreen === 'universal_app' && (
              <div className="p-4 space-y-4 bg-slate-950 min-h-full">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center shrink-0">
                      <Smartphone className="w-4 h-4 text-indigo-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate capitalize">
                        {device.activeAppName || 'App'}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        Controlled via NOVA Accessibility
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 flex items-center gap-2 focus-within:border-indigo-500">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={device.activeAppQuery}
                    onChange={(e) => onUpdateAppQuery('universal_app', e.target.value)}
                    placeholder={`Type or speak in ${device.activeAppName}...`}
                    className="w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
                  />
                </div>

                {device.lastClickedElement && (
                  <div className="rounded-xl bg-indigo-950/50 border border-indigo-500/30 px-3 py-2 text-xs text-indigo-200">
                    Tapped UI element: <span className="font-semibold">{device.lastClickedElement}</span>
                  </div>
                )}

                <div
                  className="space-y-2.5 transition-transform duration-200"
                  style={{ transform: `translateY(-${device.scrollOffset * 36}px)` }}
                >
                  {[
                    device.activeAppQuery
                      ? `Top match for "${device.activeAppQuery}"`
                      : `${device.activeAppName} Home Feed`,
                    `${device.activeAppName} Quick Action`,
                    `${device.activeAppName} Recent Activity`,
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 space-y-1"
                    >
                      <p className="text-xs font-medium text-white truncate">{item}</p>
                      <p className="text-[11px] text-slate-400">
                        Say “Type karo ...” or “Scroll down”
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {device.currentScreen === 'phone' && (
              <div className="p-5 flex flex-col justify-between min-h-full bg-slate-950">
                <div className="text-center pt-6">
                  <p className="text-xs font-medium text-slate-400 mb-2">
                    {device.isCallActive ? 'Connected Call' : 'Phone Dialer'}
                  </p>
                  <p className="text-2xl font-semibold text-white tracking-wide font-mono tabular-nums">
                    {device.dialedNumber || device.callContactName || 'Enter number'}
                  </p>
                  {device.callContactName && device.dialedNumber ? (
                    <p className="text-sm text-indigo-300 mt-1">{device.callContactName}</p>
                  ) : device.callContactName ? (
                    <p className="text-xs text-indigo-300 mt-1">Mobile Contact Lookup</p>
                  ) : null}
                </div>

                {device.isCallActive ? (
                  <div className="flex flex-col items-center gap-4 pb-8">
                    <div className="w-20 h-20 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center">
                      <PhoneCall className="w-8 h-8 text-indigo-400" />
                    </div>
                    <p className="text-xs text-emerald-400 font-medium">Calling via NOVA Dialer</p>
                    <button
                      type="button"
                      onClick={onEndCall}
                      className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white transition-colors"
                      aria-label="End Call"
                    >
                      <PhoneOff className="w-6 h-6" />
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3 pb-4">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                      <div
                        key={digit}
                        className="h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-lg font-mono tabular-nums text-slate-200"
                      >
                        {digit}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {device.currentScreen === 'whatsapp' && (
              <div className="flex flex-col h-full bg-slate-950">
                <div className="px-3.5 py-2.5 bg-emerald-950/60 border-b border-emerald-900/50 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {device.activeContact}
                      </p>
                      <p className="text-[11px] text-emerald-300 truncate">
                        WhatsApp · {device.autoReplyEnabled ? 'Auto-Reply ON' : 'Manual Mode'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={onToggleAutoReply}
                        className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${
                          device.autoReplyEnabled
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {device.autoReplyEnabled ? 'Auto-Reply ON' : 'Auto-Reply OFF'}
                      </button>
                      <button
                        type="button"
                        onClick={onSimulateIncomingMessage}
                        className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] font-medium text-slate-200 transition-colors"
                      >
                        Test Msg
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                    {chatContacts.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => onSelectContact(name)}
                        className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                          device.activeContact === name
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 p-3 space-y-2.5 overflow-y-auto">
                  {activeMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`max-w-[82%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                        msg.sender === 'me'
                          ? 'ml-auto bg-emerald-700 text-white'
                          : 'bg-slate-800 text-slate-100'
                      }`}
                    >
                      <p>{msg.text}</p>
                      <p className="text-[10px] text-white/60 text-right mt-1 tabular-nums">
                        {msg.isAutoReply ? 'NOVA Auto-Reply · ' : ''}
                        {msg.time}
                      </p>
                    </div>
                  ))}
                </div>

                {quickReplies.length > 0 && (
                  <div className="px-2.5 py-2 bg-slate-950 border-t border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-[10px] font-medium text-slate-400">Quick Replies</span>
                      {isLoadingQuickReplies && (
                        <span className="text-[10px] text-emerald-400">Updating...</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                      {quickReplies.slice(0, 3).map((reply, idx) => (
                        <button
                          key={`${idx}-${reply}`}
                          type="button"
                          onClick={() => onSendQuickReply(reply)}
                          className="px-2.5 py-1.5 rounded-lg border border-emerald-800/60 bg-slate-900 hover:bg-emerald-950/70 hover:border-emerald-600/70 text-[11px] font-medium text-emerald-100 whitespace-nowrap shrink-0 transition-colors active:scale-95"
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
                  <input
                    type="text"
                    value={device.whatsappDraft}
                    onChange={(e) => onUpdateWhatsappDraft(e.target.value)}
                    placeholder="Message draft..."
                    className="flex-1 bg-slate-800 text-xs text-white rounded-xl px-3 py-2 border border-slate-700 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={onSendWhatsappDraft}
                    className="w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white shrink-0 transition-colors"
                    aria-label="Send WhatsApp message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {device.currentScreen === 'notes' && (
              <div className="p-4 flex flex-col h-full bg-slate-950 gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <p className="text-sm font-semibold text-amber-300">Notes & Reminders</p>
                  <span className="text-[11px] text-slate-400">Accessibility Ready</span>
                </div>
                <textarea
                  value={device.notesText}
                  onChange={(e) => onUpdateNotes(e.target.value)}
                  placeholder='Say "Type karo Hello dosto..." to dictate here'
                  className="flex-1 w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 leading-relaxed resize-none focus:outline-none focus:border-amber-500"
                />
                {device.reminders.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] font-semibold text-slate-400">Saved Reminders</p>
                    {device.reminders.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                      >
                        <span className="text-slate-200 truncate">{r.title}</span>
                        <span className="text-amber-400 font-mono shrink-0 ml-2">{r.time}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {device.currentScreen === 'youtube' && (
              <div className="p-4 space-y-4 bg-slate-950 min-h-full">
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 focus-within:border-red-500 rounded-xl px-3 py-2">
                  <Video className="w-4 h-4 text-red-500 shrink-0" />
                  <input
                    type="text"
                    value={device.youtubeQuery}
                    onChange={(e) => onUpdateAppQuery('youtube', e.target.value)}
                    placeholder="Type or speak YouTube search..."
                    className="w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
                  />
                </div>
                <div
                  className="space-y-3 transition-transform duration-200"
                  style={{ transform: `translateY(-${device.scrollOffset * 40}px)` }}
                >
                  {[
                    device.youtubeQuery || 'Arijit Singh Live Acoustic Session',
                    'Android AccessibilityService Kotlin Guide',
                    'Morning Focus Instrumental Mix',
                  ].map((item, idx) => (
                    <div key={idx} className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
                      <div className="h-28 bg-slate-800 flex items-center justify-center">
                        <Video className="w-8 h-8 text-red-500/80" />
                      </div>
                      <div className="p-3">
                        <p className="text-xs font-medium text-white truncate">{item}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Playing via NOVA Launch</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {device.currentScreen === 'chrome' && (
              <div className="p-4 space-y-4 bg-slate-950 min-h-full">
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 focus-within:border-sky-500 rounded-xl px-3 py-2">
                  <Globe className="w-4 h-4 text-sky-400 shrink-0" />
                  <input
                    type="text"
                    value={device.chromeQuery}
                    onChange={(e) => onUpdateAppQuery('chrome', e.target.value)}
                    placeholder="Type URL or search in Chrome..."
                    className="w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
                  />
                </div>
                <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-2">
                  <p className="text-xs font-semibold text-sky-400">
                    {device.chromeQuery ? `Results for "${device.chromeQuery}"` : 'Chrome New Tab'}
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Browser launched by NOVA AI Manager. Speak a query or say "Back jao" to return.
                  </p>
                </div>
              </div>
            )}

            {device.currentScreen === 'settings' && (
              <div className="p-4 space-y-3 bg-slate-950 min-h-full">
                <p className="text-sm font-semibold text-white pb-2 border-b border-slate-800">
                  Device Quick Controls
                </p>
                {(
                  [
                    { key: 'wifi', label: 'Wi-Fi' },
                    { key: 'bluetooth', label: 'Bluetooth' },
                    { key: 'flashlight', label: 'Flashlight' },
                    { key: 'dnd', label: 'Do Not Disturb' },
                  ] as const
                ).map((item) => {
                  const active = device.settings[item.key];
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onToggleSetting(item.key)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors"
                    >
                      <span className="text-xs font-medium text-slate-200">{item.label}</span>
                      <span
                        className={`text-xs font-mono font-medium ${
                          active ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        {active ? 'ON' : 'OFF'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {device.currentScreen === 'camera' && (
              <div className="p-4 flex flex-col items-center justify-center h-full bg-slate-950 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
                  <Camera className="w-7 h-7 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-white">Camera Active</p>
                <p className="text-xs text-slate-400">Say "Home kholo" or "Back jao" to exit.</p>
              </div>
            )}

            {device.currentScreen === 'recents' && (
              <div className="p-4 space-y-3 bg-slate-950 min-h-full">
                <p className="text-xs font-semibold text-slate-400">Recent Apps</p>
                {device.screenHistory.slice(-3).map((scr, idx) => (
                  <button
                    key={`${scr}-${idx}`}
                    type="button"
                    onClick={() => onNavigateScreen(scr)}
                    className="w-full text-left p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 transition-colors"
                  >
                    <p className="text-xs font-semibold text-white capitalize">{scr}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Tap to resume</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Android Navigation Bar */}
          <div className="relative z-20 flex items-center justify-around px-6 py-3 bg-slate-950 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onNavigateBack}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Android Back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onNavigateHome}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Android Home"
            >
              <Circle className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigateScreen('recents')}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Android Recents"
            >
              <Square className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
