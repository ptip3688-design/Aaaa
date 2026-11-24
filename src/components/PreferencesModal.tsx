import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { PreferredLanguage } from '../types';

interface PreferencesModalProps {
  open: boolean;
  onClose: () => void;
  preferredLanguage: PreferredLanguage;
  voiceEnabled: boolean;
  memoryNotes: string;
  isSignedIn: boolean;
  onSave: (updates: {
    preferredLanguage: PreferredLanguage;
    voiceEnabled: boolean;
    memoryNotes: string;
  }) => Promise<void>;
}

export function PreferencesModal({
  open,
  onClose,
  preferredLanguage,
  voiceEnabled,
  memoryNotes,
  isSignedIn,
  onSave,
}: PreferencesModalProps) {
  const [lang, setLang] = useState<PreferredLanguage>(preferredLanguage);
  const [voice, setVoice] = useState<boolean>(voiceEnabled);
  const [notes, setNotes] = useState<string>(memoryNotes);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (open) {
      setLang(preferredLanguage);
      setVoice(voiceEnabled);
      setNotes(memoryNotes);
      setSavedNotice(false);
    }
  }, [open, preferredLanguage, voiceEnabled, memoryNotes]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        preferredLanguage: lang,
        voiceEnabled: voice,
        memoryNotes: notes.slice(0, 2000),
      });
      setSavedNotice(true);
      setTimeout(() => {
        onClose();
      }, 450);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0A0E17]/85 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Assistant Preferences and Memory"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-[#111827] border border-white/10 rounded-2xl p-6 space-y-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Preferences &amp; Memory
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {isSignedIn
                ? 'Saved to your private Firebase profile and restored whenever you reopen the app.'
                : 'Applied to your current session. Sign in with Google to save permanently online.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preferences"
            className="p-2 rounded-lg border border-white/10 text-slate-300 hover:text-slate-100 hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="pref-language"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Response Language
            </label>
            <select
              id="pref-language"
              value={lang}
              onChange={(e) => setLang(e.target.value as PreferredLanguage)}
              className="w-full bg-[#0A0E17] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-sky-400"
            >
              <option value="auto">Auto-detect (Urdu, Roman Urdu, Hindi, English)</option>
              <option value="roman-ur">Roman Urdu</option>
              <option value="ur">Urdu (اردو)</option>
              <option value="hi">Hindi (हिन्दी)</option>
              <option value="en">English</option>
            </select>
          </div>

          <label className="flex items-center justify-between gap-4 bg-[#0A0E17] border border-white/10 rounded-xl px-4 py-3 cursor-pointer">
            <div>
              <div className="text-sm font-medium text-slate-100">
                Auto-Speak Replies
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Automatically read JARVIS responses aloud using speech synthesis.
              </div>
            </div>
            <input
              type="checkbox"
              checked={voice}
              onChange={(e) => setVoice(e.target.checked)}
              className="w-4 h-4 accent-sky-400 rounded"
            />
          </label>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="pref-memory"
                className="text-xs font-medium text-slate-300"
              >
                Remembered Preferences (With Your Permission)
              </label>
              <span className="text-[11px] text-slate-500 tabular-nums">
                {notes.length}/2000
              </span>
            </div>
            <textarea
              id="pref-memory"
              rows={4}
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Example: Address me as Ali. I prefer concise TypeScript examples and answers in Roman Urdu."
              className="w-full bg-[#0A0E17] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-400 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-white/10 text-sm font-medium text-slate-300 hover:bg-white/5 transition-colors whitespace-nowrap shrink-0"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 text-slate-950 text-sm font-semibold hover:bg-sky-400 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            {savedNotice ? (
              <>
                <Check className="w-4 h-4" />
                Saved
              </>
            ) : saving ? (
              'Saving...'
            ) : (
              'Save Preferences'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
