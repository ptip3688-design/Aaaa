import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, X } from 'lucide-react';
import { PreferredLanguage, VoiceState } from '../types';
import { VoiceOrb } from './VoiceOrb';

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [altIndex: number]: { transcript: string };
    };
  };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface VoiceOverlayProps {
  open: boolean;
  onClose: () => void;
  preferredLanguage: PreferredLanguage;
  onSendVoiceMessage: (transcript: string) => Promise<string>;
}

const SPEECH_LANG_MAP: Record<PreferredLanguage, string> = {
  auto: 'en-US',
  en: 'en-US',
  ur: 'ur-PK',
  'roman-ur': 'ur-PK',
  hi: 'hi-IN',
};

export function VoiceOverlay({
  open,
  onClose,
  preferredLanguage,
  onSendVoiceMessage,
}: VoiceOverlayProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [speechLang, setSpeechLang] = useState<string>(
    SPEECH_LANG_MAP[preferredLanguage] || 'en-US'
  );
  const [transcript, setTranscript] = useState('');
  const [replyText, setReplyText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(true);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setSpeechLang(SPEECH_LANG_MAP[preferredLanguage] || 'en-US');
  }, [preferredLanguage]);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors
      }
      recognitionRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopListening();
      stopSpeaking();
      setVoiceState('idle');
    }
  }, [open, stopListening, stopSpeaking]);

  const speakResponse = useCallback(
    (text: string) => {
      if (!autoSpeak || typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setVoiceState('idle');
        return;
      }

      window.speechSynthesis.cancel();
      const cleanText = text.replace(/```[\s\S]*?```/g, 'Code block omitted.').replace(/[*#_`]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = speechLang;
      utterance.rate = 1.02;

      utterance.onstart = () => {
        if (isMountedRef.current) setVoiceState('speaking');
      };
      utterance.onend = () => {
        if (isMountedRef.current) setVoiceState('idle');
      };
      utterance.onerror = () => {
        if (isMountedRef.current) setVoiceState('idle');
      };

      setVoiceState('speaking');
      window.speechSynthesis.speak(utterance);
    },
    [autoSpeak, speechLang]
  );

  const processTranscript = useCallback(
    async (finalText: string) => {
      const cleaned = finalText.trim();
      if (!cleaned) {
        setVoiceState('idle');
        return;
      }

      setVoiceState('thinking');
      setErrorMsg(null);
      try {
        const reply = await onSendVoiceMessage(cleaned);
        if (!isMountedRef.current) return;
        setReplyText(reply);
        speakResponse(reply);
      } catch (err) {
        if (!isMountedRef.current) return;
        setErrorMsg(err instanceof Error ? err.message : 'Unable to process voice query.');
        setVoiceState('idle');
      }
    },
    [onSendVoiceMessage, speakResponse]
  );

  const startListening = useCallback(() => {
    setErrorMsg(null);
    stopSpeaking();

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setErrorMsg(
        'Browser speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari, or type your message in the chat.'
      );
      return;
    }

    stopListening();

    const rec = new SpeechRec();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = speechLang;

    let finalBuffer = '';

    rec.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) {
          finalBuffer += chunk + ' ';
        } else {
          interim += chunk;
        }
      }
      setTranscript((finalBuffer + interim).trim());
    };

    rec.onerror = (event: { error: string }) => {
      if (!isMountedRef.current) return;
      if (event.error === 'not-allowed') {
        setErrorMsg('Microphone permission was denied. Please allow microphone access.');
      } else if (event.error !== 'aborted') {
        setErrorMsg(`Voice input error: ${event.error}`);
      }
      setVoiceState('idle');
    };

    rec.onend = () => {
      recognitionRef.current = null;
      if (!isMountedRef.current) return;
      if (finalBuffer.trim()) {
        processTranscript(finalBuffer);
      } else {
        setVoiceState((prev) => (prev === 'listening' ? 'idle' : prev));
      }
    };

    recognitionRef.current = rec;
    setTranscript('');
    setVoiceState('listening');
    try {
      rec.start();
    } catch {
      setErrorMsg('Could not start microphone listener.');
      setVoiceState('idle');
    }
  }, [processTranscript, speechLang, stopListening, stopSpeaking]);

  if (!open) return null;

  const stateLabel =
    voiceState === 'listening'
      ? 'Listening — speak naturally'
      : voiceState === 'thinking'
      ? 'Thinking — querying Gemini'
      : voiceState === 'speaking'
      ? 'Speaking — reading response'
      : 'Ready — tap microphone to talk';

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0A0E17]/90 backdrop-blur-md flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="JARVIS Voice Conversation Mode"
    >
      <div className="w-full max-w-xl bg-[#111827] border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col items-center gap-6">
        <div className="w-full flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Voice Assistant</h2>
            <p className="text-xs text-slate-400 mt-0.5">{stateLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Speech recognition language"
              value={speechLang}
              onChange={(e) => setSpeechLang(e.target.value)}
              className="bg-[#0A0E17] border border-white/10 text-xs text-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-sky-400"
            >
              <option value="en-US">English (US)</option>
              <option value="ur-PK">Urdu / Roman Urdu (PK)</option>
              <option value="hi-IN">Hindi (IN)</option>
            </select>
            <button
              type="button"
              onClick={() => {
                if (autoSpeak) stopSpeaking();
                setAutoSpeak((v) => !v);
              }}
              title={autoSpeak ? 'Mute spoken replies' : 'Enable spoken replies'}
              className="p-2 rounded-lg border border-white/10 text-slate-300 hover:text-slate-100 hover:bg-white/5 transition-colors"
            >
              {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                stopListening();
                stopSpeaking();
                onClose();
              }}
              aria-label="Close voice mode"
              className="p-2 rounded-lg border border-white/10 text-slate-300 hover:text-slate-100 hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="py-4">
          <VoiceOrb state={voiceState} size="lg" />
        </div>

        <div className="w-full space-y-3 min-h-[96px]">
          {transcript && (
            <div className="bg-[#0A0E17] border border-white/10 rounded-xl px-4 py-3">
              <div className="text-xs text-slate-400 mb-1">You said</div>
              <p className="text-sm text-slate-100">{transcript}</p>
            </div>
          )}
          {replyText && (
            <div className="bg-[#0A0E17] border border-sky-500/20 rounded-xl px-4 py-3 max-h-40 overflow-y-auto">
              <div className="text-xs text-sky-400 mb-1">JARVIS</div>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                {replyText}
              </p>
            </div>
          )}
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-300">
              {errorMsg}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {voiceState === 'listening' ? (
            <button
              type="button"
              onClick={stopListening}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-400 transition-colors whitespace-nowrap shrink-0"
            >
              <MicOff className="w-4 h-4" />
              Stop Listening
            </button>
          ) : (
            <button
              type="button"
              disabled={voiceState === 'thinking'}
              onClick={startListening}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 text-slate-950 text-sm font-semibold hover:bg-sky-400 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Mic className="w-4 h-4" />
              {voiceState === 'speaking' ? 'Interrupt & Speak' : 'Tap to Speak'}
            </button>
          )}
          {voiceState === 'speaking' && (
            <button
              type="button"
              onClick={() => {
                stopSpeaking();
                setVoiceState('idle');
              }}
              className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-slate-200 hover:bg-white/5 transition-colors whitespace-nowrap shrink-0"
            >
              Stop Audio
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
