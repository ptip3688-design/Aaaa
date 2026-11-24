import { useState } from 'react';
import {
  Camera,
  ExternalLink,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Search,
  Video,
  X,
} from 'lucide-react';

interface QuickActionsModalProps {
  open: boolean;
  onClose: () => void;
  onCameraCaptureRequest: () => void;
}

interface PendingConfirm {
  label: string;
  description: string;
  href: string;
}

export function QuickActionsModal({
  open,
  onClose,
  onCameraCaptureRequest,
}: QuickActionsModalProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [smsBody, setSmsBody] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  if (!open) return null;

  const sanitizePhone = (num: string) => num.replace(/[^0-9+*#]/g, '');

  const triggerLink = (href: string) => {
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.target = href.startsWith('http') ? '_blank' : '_self';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0A0E17]/85 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Quick Actions & Device Integrations"
    >
      <div className="w-full max-w-2xl bg-[#111827] border border-white/10 rounded-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Quick Actions &amp; App Launcher
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Launch supported apps or prepare phone calls and SMS drafts with explicit confirmation.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close quick actions"
            className="p-2 rounded-lg border border-white/10 text-slate-300 hover:text-slate-100 hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {statusNotice && (
          <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl px-4 py-3 text-xs text-sky-200">
            {statusNotice}
          </div>
        )}

        {pendingConfirm && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-3">
            <div className="text-sm font-semibold text-amber-300">
              Confirm Sensitive Action: {pendingConfirm.label}
            </div>
            <p className="text-xs text-slate-200">{pendingConfirm.description}</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  triggerLink(pendingConfirm.href);
                  setStatusNotice(`Requested device action: ${pendingConfirm.label}`);
                  setPendingConfirm(null);
                }}
                className="px-4 py-2 rounded-lg bg-amber-400 text-slate-950 text-xs font-semibold hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0"
              >
                Confirm &amp; Proceed
              </button>
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="px-4 py-2 rounded-lg border border-white/10 text-xs font-medium text-slate-300 hover:bg-white/5 transition-colors whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#0A0E17] border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
              <Phone className="w-4 h-4 text-sky-400" />
              <span>Phone Call &amp; SMS Draft</span>
            </div>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Phone number (e.g. +923001234567)"
              className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
            />
            <textarea
              rows={2}
              value={smsBody}
              onChange={(e) => setSmsBody(e.target.value)}
              placeholder="Optional message text for SMS or WhatsApp..."
              className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-400 resize-none"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const clean = sanitizePhone(phoneNumber);
                  if (!clean) {
                    setStatusNotice('Enter a valid phone number before dialing.');
                    return;
                  }
                  setPendingConfirm({
                    label: `Call ${clean}`,
                    description: `Open your device phone dialer to start a call with ${clean}.`,
                    href: `tel:${clean}`,
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-500/15 border border-sky-500/30 text-xs font-medium text-sky-300 hover:bg-sky-500/25 transition-colors whitespace-nowrap shrink-0"
              >
                <Phone className="w-3.5 h-3.5" />
                Dial Number
              </button>
              <button
                type="button"
                onClick={() => {
                  const clean = sanitizePhone(phoneNumber);
                  const encoded = encodeURIComponent(smsBody.trim());
                  setPendingConfirm({
                    label: 'Open SMS Draft',
                    description: `Open your messaging app with${clean ? ` recipient ${clean} and` : ''} your drafted SMS text.`,
                    href: `sms:${clean}${encoded ? `?body=${encoded}` : ''}`,
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-xs font-medium text-slate-200 hover:bg-white/5 transition-colors whitespace-nowrap shrink-0"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                SMS Draft
              </button>
              <button
                type="button"
                onClick={() => {
                  const clean = sanitizePhone(phoneNumber).replace(/^\+/, '');
                  const encoded = encodeURIComponent(smsBody.trim());
                  const url = clean
                    ? `https://wa.me/${clean}${encoded ? `?text=${encoded}` : ''}`
                    : `https://wa.me/${encoded ? `?text=${encoded}` : ''}`;
                  setPendingConfirm({
                    label: 'Open WhatsApp',
                    description: 'Open WhatsApp with your message draft ready to review and send.',
                    href: url,
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-xs font-medium text-slate-200 hover:bg-white/5 transition-colors whitespace-nowrap shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                WhatsApp
              </button>
            </div>
          </div>

          <div className="bg-[#0A0E17] border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
              <Search className="w-4 h-4 text-sky-400" />
              <span>App &amp; Web Shortcuts</span>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search YouTube, Maps, or draft email..."
              className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
            />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const q = encodeURIComponent(searchQuery.trim());
                  triggerLink(
                    q
                      ? `https://www.youtube.com/results?search_query=${q}`
                      : 'https://www.youtube.com'
                  );
                }}
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-white/10 text-xs font-medium text-slate-200 hover:bg-white/5 transition-colors whitespace-nowrap"
              >
                <Video className="w-3.5 h-3.5 text-red-400" />
                YouTube
              </button>
              <button
                type="button"
                onClick={() => {
                  const q = encodeURIComponent(searchQuery.trim());
                  triggerLink(
                    q ? `https://maps.google.com/?q=${q}` : 'https://maps.google.com'
                  );
                }}
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-white/10 text-xs font-medium text-slate-200 hover:bg-white/5 transition-colors whitespace-nowrap"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                Maps
              </button>
              <button
                type="button"
                onClick={() => {
                  const body = encodeURIComponent(smsBody.trim() || searchQuery.trim());
                  triggerLink(`mailto:?body=${body}`);
                }}
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-white/10 text-xs font-medium text-slate-200 hover:bg-white/5 transition-colors whitespace-nowrap"
              >
                <Mail className="w-3.5 h-3.5 text-sky-400" />
                Email App
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCameraCaptureRequest();
                }}
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-white/10 text-xs font-medium text-slate-200 hover:bg-white/5 transition-colors whitespace-nowrap"
              >
                <Camera className="w-3.5 h-3.5 text-amber-400" />
                Camera Input
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Note: Web browsers cannot directly open native Android OS settings or private gallery folders without an Android native wrapper.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
