import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, FileCode2 } from 'lucide-react';
import { AndroidProjectFile, getAndroidProjectFiles } from '../data/androidProjectFiles';

interface KotlinStudioViewProps {
  onOpenApkModal: () => void;
}

export const KotlinStudioView: React.FC<KotlinStudioViewProps> = ({ onOpenApkModal }) => {
  const files = useMemo(() => getAndroidProjectFiles(), []);
  const [selectedId, setSelectedId] = useState<string>('main_activity');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeFile: AndroidProjectFile =
    files.find((f) => f.id === selectedId) ?? files[0];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeFile.content);
    setCopiedId(activeFile.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleDownloadSingle = () => {
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-1.5 max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Android Studio Kotlin Project &amp; APK Kit
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Updated <span className="font-mono text-slate-900">MainActivity.kt</span> with OkHttp
            client calling the OpenAI Chat Completions API, speaking responses via Android{' '}
            <span className="font-mono text-slate-900">TextToSpeech</span>, plus Accessibility
            service typing, WhatsApp auto-reply, Gradle files, and GitHub APK workflow.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenApkModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 active:scale-95"
        >
          <Download className="w-4 h-4" />
          <span>Download APK Kit (.zip)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* File Explorer */}
        <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-3 space-y-1">
          <p className="px-3 py-2 text-xs font-semibold text-slate-500">Project Files</p>
          {files.map((file) => {
            const active = file.id === activeFile.id;
            return (
              <button
                key={file.id}
                type="button"
                onClick={() => setSelectedId(file.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-start gap-2.5 ${
                  active
                    ? 'bg-indigo-50 text-indigo-950'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <FileCode2
                  className={`w-4 h-4 mt-0.5 shrink-0 ${
                    active ? 'text-indigo-600' : 'text-slate-400'
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{file.filename}</p>
                  <p className="text-xs text-slate-500 font-mono truncate">{file.path}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Code Viewer */}
        <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-slate-950 text-slate-100 overflow-hidden flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{activeFile.filename}</p>
              <p className="text-xs text-slate-400 truncate">{activeFile.summary}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap"
              >
                {copiedId === activeFile.id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownloadSingle}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save File</span>
              </button>
            </div>
          </div>

          <pre className="p-4 text-xs leading-relaxed font-mono overflow-x-auto max-h-[620px] text-slate-200">
            <code>{activeFile.content}</code>
          </pre>
        </div>
      </div>
    </section>
  );
};
