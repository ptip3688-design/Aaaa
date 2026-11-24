import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Check,
  Copy,
  ExternalLink,
  Paperclip,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatMessageItemProps {
  message: ChatMessage;
  isSpeaking: boolean;
  onToggleSpeak: (message: ChatMessage) => void;
}

export function ChatMessageItem({
  message,
  isSpeaking,
  onToggleSpeak,
}: ChatMessageItemProps) {
  const [copiedId, setCopiedId] = useState(false);
  const isUser = message.role === 'user';

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1500);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const timeFormatted = new Date(message.createdAtMs).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] md:max-w-[72%] bg-[#162238] border border-sky-500/25 rounded-2xl px-4 py-3 space-y-2">
          {message.hasAttachment && message.attachmentName && (
            <div className="flex items-center gap-1.5 text-xs text-sky-300">
              <Paperclip className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{message.attachmentName}</span>
            </div>
          )}
          <p className="text-[15px] text-slate-100 leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
          <div className="text-[11px] text-slate-400 text-right tabular-nums">
            You &middot; {timeFormatted}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] md:max-w-[82%] bg-[#111827] border border-white/8 rounded-2xl px-5 py-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-400 tabular-nums">
            <span className="font-semibold text-sky-400">JARVIS</span>
            <span aria-hidden="true">&middot;</span>
            <span className="capitalize">{message.mode}</span>
            <span aria-hidden="true">&middot;</span>
            <span>{timeFormatted}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onToggleSpeak(message)}
              title={isSpeaking ? 'Stop reading' : 'Read aloud'}
              aria-label={isSpeaking ? 'Stop reading response' : 'Read response aloud'}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors whitespace-nowrap shrink-0 ${
                isSpeaking
                  ? 'bg-sky-500/20 text-sky-300'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`}
            >
              {isSpeaking ? (
                <>
                  <VolumeX className="w-3.5 h-3.5" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Listen</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleCopyAll}
              title="Copy response"
              aria-label="Copy response"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors whitespace-nowrap shrink-0"
            >
              {copiedId ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="jarvis-prose text-[15px] text-slate-200 break-words">
          <ReactMarkdown
            components={{
              code({ className, children, ...props }) {
                const isInline = !className;
                if (isInline) {
                  return (
                    <code
                      className="bg-white/8 text-sky-300 px-1.5 py-0.5 rounded text-[13px] font-mono"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                }
                return (
                  <pre className="bg-[#0A0E17] border border-white/10 rounded-xl p-3.5 overflow-x-auto my-3 text-[13px] text-slate-200 font-mono leading-relaxed">
                    <code className={className} {...props}>
                      {children}
                    </code>
                  </pre>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {message.groundingLinks && message.groundingLinks.length > 0 && (
          <div className="pt-2 border-t border-white/8 space-y-1.5">
            <div className="text-[11px] font-medium text-slate-400">
              Verified Web Sources
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {message.groundingLinks.map((url, idx) => {
                let hostname = url;
                try {
                  hostname = new URL(url).hostname.replace(/^www\./, '');
                } catch {
                  // Keep raw url
                }
                return (
                  <a
                    key={`${url}-${idx}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 underline underline-offset-2"
                  >
                    <span>{hostname}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
