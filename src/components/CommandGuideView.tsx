import React from 'react';

interface CommandExample {
  command: string;
  language: string;
  action: string;
  notes: string;
}

const COMMANDS: CommandExample[] = [
  {
    command: 'Ankit ko call lagao / Rohit ko call karo',
    language: 'Hindi / Hinglish',
    action: 'Looks up contact name automatically and dials or places the call',
    notes: 'Works with any saved contact name (READ_CONTACTS) or spoken digits',
  },
  {
    command: 'Instagram mein type karo Virat Kohli',
    language: 'Hinglish',
    action: 'Opens any mobile app and types directly into its search or input box',
    notes: 'Works in YouTube, WhatsApp, Instagram, Chrome, Gmail, Telegram, and Notes',
  },
  {
    command: 'WhatsApp pe Priya ko message bhejo ki 10 min mein aa raha hoon',
    language: 'Hinglish',
    action: 'Opens any contact chat dynamically and sends the message immediately',
    notes: 'Also supports AI Auto-Reply for incoming WhatsApp messages',
  },
  {
    command: 'Type karo Kal subah 10 baje meeting hai',
    language: 'Hindi / English',
    action: 'Types dictated text directly into whichever app is currently open',
    notes: 'Uses ACTION_SET_TEXT + Clipboard ACTION_PASTE fallback across all Android apps',
  },
  {
    command: 'Wi-Fi off karo / Flashlight on karo',
    language: 'Hinglish',
    action: 'Toggles hardware settings with safety prompt for Wi-Fi off',
    notes: 'Supports Wi-Fi, Bluetooth, Flashlight, and Do Not Disturb',
  },
  {
    command: 'Back jao / Home screen kholo / Scroll down',
    language: 'Hinglish / English',
    action: 'Executes Android Global Navigation & Swipe Gestures',
    notes: 'Requires Accessibility permission enabled on physical Android device',
  },
];

interface CommandGuideViewProps {
  onTryCommand: (command: string) => void;
}

export const CommandGuideView: React.FC<CommandGuideViewProps> = ({ onTryCommand }) => {
  return (
    <section className="space-y-8">
      <div className="space-y-1.5 pb-6 border-b border-slate-200 max-w-2xl">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Bilingual Voice Commands & Android Setup
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Speak naturally in Hindi, English, or Hinglish. Click any example below to run it
          immediately inside the live NOVA simulator.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Voice Command</th>
                <th className="py-3 px-4">Language</th>
                <th className="py-3 px-4">Executed Action</th>
                <th className="py-3 px-4 text-right">Try Live</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {COMMANDS.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-slate-900">
                    “{row.command}”
                    <p className="text-xs font-normal text-slate-500 mt-0.5">{row.notes}</p>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                    {row.language}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-700">{row.action}</td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onTryCommand(row.command)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-xs font-medium text-slate-800 transition-colors"
                    >
                      Run Command
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
          <p className="text-sm font-semibold text-slate-900">01. Add OpenAI Key Safely</p>
          <p className="text-xs text-slate-600 leading-relaxed">
            In Android Studio, copy <span className="font-mono">local.properties.example</span> to{' '}
            <span className="font-mono">local.properties</span> and add{' '}
            <span className="font-mono">OPENAI_API_KEY=...</span>. Gradle injects it into{' '}
            <span className="font-mono">BuildConfig</span> without committing secrets.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
          <p className="text-sm font-semibold text-slate-900">02. Enable Accessibility Service</p>
          <p className="text-xs text-slate-600 leading-relaxed">
            After installing on your Android phone, tap Enable Accessibility Control inside NOVA
            to grant screen typing, scrolling, and Back / Home navigation access.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
          <p className="text-sm font-semibold text-slate-900">03. Female Voice Selection</p>
          <p className="text-xs text-slate-600 leading-relaxed">
            Ensure Google Speech Services Hindi (India) and English (India) female voice packs are
            downloaded in Android Text-to-Speech settings for crisp natural output.
          </p>
        </div>
      </div>
    </section>
  );
};
