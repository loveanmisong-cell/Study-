import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  CloudUpload,
  Download,
  ExternalLink,
  FileArchive,
  LogOut,
  Smartphone,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  deleteDriveFile,
  downloadDriveFile,
  DriveFileItem,
  getDriveAccessToken,
  googleDriveSignIn,
  initDriveAuth,
  listNovaDriveFiles,
  logoutDrive,
  uploadApkKitToDrive,
} from '../services/googleDriveService';

interface ApkDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownloadZip: () => void;
}

type PendingDriveMutation =
  | { type: 'upload' }
  | { type: 'delete'; file: DriveFileItem };

export const ApkDownloadModal: React.FC<ApkDownloadModalProps> = ({
  isOpen,
  onClose,
  onDownloadZip,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  const [driveUser, setDriveUser] = useState<User | null>(null);
  const [driveToken, setDriveToken] = useState<string | null>(() => getDriveAccessToken());
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveNotice, setDriveNotice] = useState<string | null>(null);
  const [pendingMutation, setPendingMutation] = useState<PendingDriveMutation | null>(null);

  const refreshFiles = useCallback(async (token: string) => {
    setIsLoadingDrive(true);
    setDriveError(null);
    try {
      const files = await listNovaDriveFiles(token);
      setDriveFiles(files);
    } catch (err: unknown) {
      setDriveError(err instanceof Error ? err.message : 'Unable to load Google Drive files.');
    } finally {
      setIsLoadingDrive(false);
    }
  }, []);

  useEffect(() => {
    const unsub = initDriveAuth(
      (user, token) => {
        setDriveUser(user);
        setDriveToken(token);
      },
      () => {
        setDriveUser(null);
        setDriveToken(null);
        setDriveFiles([]);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isOpen && driveToken) {
      void refreshFiles(driveToken);
    }
  }, [isOpen, driveToken, refreshFiles]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setDriveError(null);
    setDriveNotice(null);
    try {
      const { user, accessToken } = await googleDriveSignIn();
      setDriveUser(user);
      setDriveToken(accessToken);
      await refreshFiles(accessToken);
    } catch (err: unknown) {
      setDriveError(err instanceof Error ? err.message : 'Google Sign-In failed.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleConfirmMutation = async () => {
    if (!pendingMutation || !driveToken) return;
    const mutation = pendingMutation;
    setPendingMutation(null);
    setIsLoadingDrive(true);
    setDriveError(null);
    setDriveNotice(null);

    try {
      if (mutation.type === 'upload') {
        const uploaded = await uploadApkKitToDrive(driveToken);
        setDriveNotice(`Saved "${uploaded.name}" to your Google Drive.`);
        await refreshFiles(driveToken);
      } else {
        await deleteDriveFile(driveToken, mutation.file.id);
        setDriveNotice(`Removed "${mutation.file.name}" from your Google Drive.`);
        await refreshFiles(driveToken);
      }
    } catch (err: unknown) {
      setDriveError(err instanceof Error ? err.message : 'Google Drive action failed.');
    } finally {
      setIsLoadingDrive(false);
    }
  };

  const handleDownloadFromDrive = async (file: DriveFileItem) => {
    if (!driveToken) return;
    setDownloadingFileId(file.id);
    setDriveError(null);
    setDriveNotice(null);
    try {
      await downloadDriveFile(driveToken, file.id, file.name);
      setDriveNotice(`Downloaded "${file.name}" from Google Drive.`);
    } catch (err: unknown) {
      setDriveError(err instanceof Error ? err.message : 'Unable to download file from Drive.');
    } finally {
      setDownloadingFileId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apk-modal-title"
    >
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 bg-slate-50/70 shrink-0">
          <div className="space-y-1">
            <h2 id="apk-modal-title" className="text-lg font-bold tracking-tight text-slate-900">
              Install NOVA AI Manager &amp; Google Drive
            </h2>
            <p className="text-xs text-slate-600">
              Install directly on your device, save the APK Kit to Google Drive, or download ZIP.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
            aria-label="Close install dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Option 1: Direct In-Browser App Install (PWA) */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
                <Smartphone className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Direct Phone / Desktop App Install</span>
              </div>
              <p className="text-xs text-emerald-900/80 leading-relaxed">
                {isInstalled
                  ? 'NOVA AI Manager is already installed on this device.'
                  : isInstallable
                    ? '1-tap install onto your phone home screen with standalone window & offline shell.'
                    : isIOS
                      ? 'In Safari, tap Share and choose "Add to Home Screen" to install NOVA AI.'
                      : 'Open browser menu (⋮) and tap "Install app" or "Add to Home screen" to install directly on your phone.'}
              </p>
            </div>
            {isInstalled ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-semibold shrink-0">
                <CheckCircle2 className="w-4 h-4" />
                <span>Installed</span>
              </span>
            ) : isInstallable ? (
              <button
                type="button"
                onClick={() => void install()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Install App Now</span>
              </button>
            ) : null}
          </div>

          {/* Option 2: Save to Google Drive */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-slate-900">Save App Kit to Google Drive</p>
                <p className="text-xs text-slate-600">
                  {driveUser && driveToken
                    ? `Connected as ${driveUser.email ?? driveUser.displayName ?? 'Google User'}`
                    : 'Sign in with Google to save NOVA-AI-Manager-APK-Kit.zip to your Drive.'}
                </p>
              </div>

              {driveToken ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPendingMutation({ type: 'upload' })}
                    disabled={isLoadingDrive}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap transition-colors active:scale-95"
                  >
                    <CloudUpload className="w-3.5 h-3.5" />
                    <span>Save to Drive</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void logoutDrive()}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                    title="Disconnect Google Drive"
                    aria-label="Disconnect Google Drive"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleGoogleSignIn()}
                  disabled={isSigningIn}
                  className="inline-flex items-center gap-2.5 px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold shadow-2xs transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>{isSigningIn ? 'Connecting...' : 'Sign in with Google'}</span>
                </button>
              )}
            </div>

            {pendingMutation && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-amber-950 font-medium">
                  {pendingMutation.type === 'upload'
                    ? 'Confirm uploading "NOVA-AI-Manager-APK-Kit.zip" to your Google Drive?'
                    : `Confirm removing "${pendingMutation.file.name}" from your Google Drive?`}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleConfirmMutation()}
                    className="px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingMutation(null)}
                    className="px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {driveError && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {driveError}
              </p>
            )}

            {driveNotice && (
              <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                {driveNotice}
              </p>
            )}

            {driveToken && driveFiles.length > 0 && (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {driveFiles.map((file) => (
                  <div
                    key={file.id}
                    className="px-3 py-2 flex items-center justify-between gap-2 bg-slate-50/50 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">{file.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {file.size ? `${Math.round(Number(file.size) / 1024)} KB` : 'Google Drive'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleDownloadFromDrive(file)}
                        disabled={downloadingFileId === file.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium"
                      >
                        <Download className="w-3 h-3" />
                        <span>{downloadingFileId === file.id ? 'Downloading...' : 'Download'}</span>
                      </button>
                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Open</span>
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setPendingMutation({ type: 'delete', file })}
                        className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-red-50 hover:text-red-600 text-slate-500"
                        aria-label={`Delete ${file.name} from Drive`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {driveToken && !isLoadingDrive && driveFiles.length === 0 && (
              <p className="text-xs text-slate-500">
                No NOVA files in Google Drive yet. Click <strong>Save to Drive</strong> above to
                upload and download from any device, or{' '}
                <a
                  href="https://drive.google.com/drive/my-drive"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline font-medium"
                >
                  open Google Drive
                </a>
                .
              </p>
            )}
          </div>

          {/* Option 3: Local Download of Native Android APK Kit */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-indigo-950">
                <FileArchive className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Native Android APK Kit (.zip)</span>
              </div>
              <p className="text-xs text-indigo-900/80 leading-relaxed">
                Full Kotlin Accessibility &amp; Contacts calling project +{' '}
                <span className="font-mono">.github/workflows/build-apk.yml</span> for automatic APK
                compilation.
              </p>
            </div>
            <button
              type="button"
              onClick={onDownloadZip}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Download ZIP</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Cloud APK Build (No PC)</span>
              </div>
              <ol className="text-xs text-slate-600 space-y-1.5 leading-relaxed list-decimal list-inside">
                <li>Unzip <span className="font-mono text-slate-800">NOVA-AI-Manager-APK-Kit.zip</span></li>
                <li>Upload files to a free GitHub repository</li>
                <li>Open GitHub <span className="font-semibold text-slate-800">Actions</span> tab</li>
                <li>Download compiled <span className="font-mono text-slate-800">app-debug.apk</span></li>
              </ol>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <Terminal className="w-4 h-4 text-slate-700 shrink-0" />
                <span>Android Studio (PC)</span>
              </div>
              <ol className="text-xs text-slate-600 space-y-1.5 leading-relaxed list-decimal list-inside">
                <li>Open unzipped folder in Android Studio</li>
                <li>Copy <span className="font-mono text-slate-800">local.properties.example</span> to <span className="font-mono text-slate-800">local.properties</span></li>
                <li>Add your <span className="font-mono text-slate-800">OPENAI_API_KEY</span></li>
                <li>Click <span className="font-semibold text-slate-800">Build &gt; Build APK(s)</span></li>
              </ol>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onDownloadZip}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download APK Kit (.zip)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
