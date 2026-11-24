import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Code2,
  Compass,
  Globe,
  Languages,
  Menu,
  Mic,
  MicOff,
  Paperclip,
  PenLine,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { useFirebase } from './contexts/FirebaseContext';
import {
  AssistantMode,
  AttachmentPayload,
  ChatMessage,
  PreferredLanguage,
} from './types';
import { Sidebar } from './components/Sidebar';
import { ChatMessageItem } from './components/ChatMessageItem';
import { VoiceOrb } from './components/VoiceOrb';
import { VoiceOverlay } from './components/VoiceOverlay';
import { QuickActionsModal } from './components/QuickActionsModal';
import { PreferencesModal } from './components/PreferencesModal';

const MODE_OPTIONS: Array<{ id: AssistantMode; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'coding', label: 'Coding' },
  { id: 'writing', label: 'Writing' },
  { id: 'translate', label: 'Translate' },
];

const STARTER_PROMPTS: Array<{
  title: string;
  prompt: string;
  mode: AssistantMode;
}> = [
  {
    title: 'Roman Urdu Assistant',
    prompt: 'Assalam-o-Alaikum Jarvis! Aaj meri productivity behtar banane ke 3 practical tareeqe Roman Urdu mein batao.',
    mode: 'general',
  },
  {
    title: 'Code Debugging & Design',
    prompt: 'Write a clean TypeScript debounce hook for React with proper cleanup and explain how it works.',
    mode: 'coding',
  },
  {
    title: 'Email & Message Drafting',
    prompt: 'Draft a polite professional email requesting a project timeline update from a client.',
    mode: 'writing',
  },
  {
    title: 'Multilingual Translation',
    prompt: 'Translate "Success comes from consistent daily effort" into Urdu script, Roman Urdu, and Hindi.',
    mode: 'translate',
  },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const {
    user,
    authReady,
    firestoreOnline,
    profile,
    conversations,
    activeConversationId,
    messages: firestoreMessages,
    loadingConversations,
    loadingMessages,
    authError,
    setActiveConversationId,
    signInWithGoogle,
    signOutUser,
    updatePreferences,
    persistTurn,
    renameConversation,
    deleteConversation,
  } = useFirebase();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mode, setMode] = useState<AssistantMode>('general');
  const [useWebSearch, setUseWebSearch] = useState(true);
  const [inputText, setInputText] = useState('');
  const [attachment, setAttachment] = useState<AttachmentPayload | null>(null);
  const [sending, setSending] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [guestMessages, setGuestMessages] = useState<ChatMessage[]>([]);
  const [guestLanguage, setGuestLanguage] = useState<PreferredLanguage>('auto');
  const [guestVoiceEnabled, setGuestVoiceEnabled] = useState(false);
  const [guestMemoryNotes, setGuestMemoryNotes] = useState('');

  const [voiceOverlayOpen, setVoiceOverlayOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [dictating, setDictating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const dictationRef = useRef<{ stop: () => void } | null>(null);

  const activeMessages = user ? firestoreMessages : guestMessages;
  const preferredLanguage = profile?.preferredLanguage ?? guestLanguage;
  const voiceEnabled = profile?.voiceEnabled ?? guestVoiceEnabled;
  const memoryNotes = profile?.memoryNotes ?? guestMemoryNotes;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length, sending]);

  useEffect(() => {
    if (user && activeConversationId) {
      const activeConv = conversations.find((c) => c.id === activeConversationId);
      if (activeConv) {
        setMode(activeConv.mode);
      }
    }
  }, [user, activeConversationId, conversations]);

  const stopSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMessageId(null);
  }, []);

  const speakMessage = useCallback(
    (msg: ChatMessage) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setErrorBanner('Text-to-Speech is not supported in this browser.');
        return;
      }

      if (speakingMessageId === msg.id) {
        stopSpeech();
        return;
      }

      window.speechSynthesis.cancel();
      const plain = msg.content
        .replace(/```[\s\S]*?```/g, 'Code block omitted.')
        .replace(/[*#_`]/g, '');
      const utterance = new SpeechSynthesisUtterance(plain);
      if (preferredLanguage === 'ur' || preferredLanguage === 'roman-ur') {
        utterance.lang = 'ur-PK';
      } else if (preferredLanguage === 'hi') {
        utterance.lang = 'hi-IN';
      } else {
        utterance.lang = 'en-US';
      }
      utterance.onend = () => setSpeakingMessageId(null);
      utterance.onerror = () => setSpeakingMessageId(null);
      setSpeakingMessageId(msg.id);
      window.speechSynthesis.speak(utterance);
    },
    [preferredLanguage, speakingMessageId, stopSpeech]
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorBanner('File size exceeds 10 MB limit. Please upload a smaller file.');
      return;
    }

    try {
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        const base64Data = await fileToBase64(file);
        const previewUrl = file.type.startsWith('image/')
          ? URL.createObjectURL(file)
          : undefined;
        setAttachment({
          name: file.name,
          mimeType: file.type,
          base64Data,
          previewUrl,
        });
      } else {
        const textContent = await file.text();
        setAttachment({
          name: file.name,
          mimeType: file.type || 'text/plain',
          textContent: textContent.slice(0, 24000),
        });
      }
      setErrorBanner(null);
    } catch {
      setErrorBanner('Could not read the selected file.');
    }
  };

  const sendMessageCore = useCallback(
    async (
      rawText: string,
      overrideMode?: AssistantMode,
      currentAttachment?: AttachmentPayload | null
    ): Promise<string> => {
      const trimmed = rawText.trim();
      const targetMode = overrideMode || mode;
      const attached = currentAttachment ?? null;

      if (!trimmed && !attached) {
        return '';
      }

      setSending(true);
      setErrorBanner(null);

      try {
        const historyPayload = activeMessages.slice(-12).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch('/api/jarvis/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            history: historyPayload,
            mode: targetMode,
            preferredLanguage,
            memoryNotes,
            useWebSearch: targetMode === 'general' && useWebSearch,
            attachment: attached
              ? {
                  name: attached.name,
                  mimeType: attached.mimeType,
                  base64Data: attached.base64Data,
                  textContent: attached.textContent,
                }
              : null,
          }),
        });

        const data = (await response.json()) as {
          reply?: string;
          groundingLinks?: string[];
          error?: string;
        };

        if (!response.ok || !data.reply) {
          throw new Error(
            data.error || 'JARVIS could not complete this request. Please try again.'
          );
        }

        const groundingLinks = Array.isArray(data.groundingLinks)
          ? data.groundingLinks
          : [];
        const userTextForLog =
          trimmed || `Analyze attachment: ${attached?.name || 'file'}`;

        if (user) {
          const titleCandidate = (trimmed || attached?.name || 'New Conversation')
            .replace(/\s+/g, ' ')
            .slice(0, 64);

          await persistTurn({
            conversationId: activeConversationId,
            titleIfNew: titleCandidate,
            mode: targetMode,
            userMessage: userTextForLog,
            assistantReply: data.reply,
            hasAttachment: Boolean(attached),
            attachmentName: attached?.name || '',
            attachmentType: attached?.mimeType || '',
            groundingLinks,
          });
        } else {
          const now = Date.now();
          const uMsg: ChatMessage = {
            id: `guest_u_${now}`,
            ownerId: 'guest',
            role: 'user',
            content: userTextForLog,
            mode: targetMode,
            hasAttachment: Boolean(attached),
            attachmentName: attached?.name || '',
            attachmentType: attached?.mimeType || '',
            groundingLinks: [],
            createdAtMs: now,
          };
          const aMsg: ChatMessage = {
            id: `guest_a_${now + 1}`,
            ownerId: 'guest',
            role: 'assistant',
            content: data.reply,
            mode: targetMode,
            hasAttachment: false,
            attachmentName: '',
            attachmentType: '',
            groundingLinks,
            createdAtMs: now + 1,
          };
          setGuestMessages((prev) => [...prev, uMsg, aMsg]);

          if (voiceEnabled) {
            speakMessage(aMsg);
          }
        }

        if (user && voiceEnabled) {
          speakMessage({
            id: `auto_${Date.now()}`,
            ownerId: user.uid,
            role: 'assistant',
            content: data.reply,
            mode: targetMode,
            hasAttachment: false,
            attachmentName: '',
            attachmentType: '',
            groundingLinks,
            createdAtMs: Date.now(),
          });
        }

        return data.reply;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Unexpected error communicating with JARVIS.';
        setErrorBanner(msg);
        throw err;
      } finally {
        setSending(false);
      }
    },
    [
      activeConversationId,
      activeMessages,
      memoryNotes,
      mode,
      persistTurn,
      preferredLanguage,
      speakMessage,
      useWebSearch,
      user,
      voiceEnabled,
    ]
  );

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (sending) return;
    const text = inputText;
    const currentAttach = attachment;
    if (!text.trim() && !currentAttach) return;

    setInputText('');
    setAttachment(null);
    try {
      await sendMessageCore(text, mode, currentAttach);
    } catch {
      setInputText(text);
      setAttachment(currentAttach);
    }
  };

  const toggleDictation = () => {
    if (dictating && dictationRef.current) {
      dictationRef.current.stop();
      setDictating(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
    };

    const Rec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Rec) {
      setErrorBanner('Speech dictation is not supported in this browser.');
      return;
    }

    const rec = new Rec();
    rec.lang =
      preferredLanguage === 'ur' || preferredLanguage === 'roman-ur'
        ? 'ur-PK'
        : preferredLanguage === 'hi'
        ? 'hi-IN'
        : 'en-US';
    rec.interimResults = false;
    rec.onresult = (ev) => {
      const resultText = ev.results?.[0]?.[0]?.transcript || '';
      if (resultText) {
        setInputText((prev) => (prev ? `${prev} ${resultText}` : resultText));
      }
    };
    rec.onerror = () => setDictating(false);
    rec.onend = () => {
      setDictating(false);
      dictationRef.current = null;
    };
    dictationRef.current = rec;
    setDictating(true);
    rec.start();
  };

  const handleNewChat = () => {
    stopSpeech();
    if (user) {
      setActiveConversationId(null);
    } else {
      setGuestMessages([]);
    }
    setErrorBanner(null);
  };

  return (
    <div className="h-screen w-full bg-[#0A0E17] text-slate-100 flex flex-col overflow-hidden">
      {/* Top Bar Contract: 3 zones */}
      <header className="h-14 shrink-0 border-b border-white/8 bg-[#0D1320] px-4 lg:px-6 flex items-center justify-between gap-8">
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open conversation sidebar"
            className="p-2 -ml-1 rounded-lg text-slate-300 hover:text-slate-100 hover:bg-white/5 lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-display text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0">
            JARVIS AI
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            type="button"
            onClick={() => {
              setVoiceOverlayOpen(false);
              setQuickActionsOpen(false);
            }}
            className="text-sky-400 underline underline-offset-4 whitespace-nowrap shrink-0"
          >
            Assistant
          </button>
          <button
            type="button"
            onClick={() => setVoiceOverlayOpen(true)}
            className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            Voice Mode
          </button>
          <button
            type="button"
            onClick={() => setQuickActionsOpen(true)}
            className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            Quick Actions
          </button>
          <button
            type="button"
            onClick={() => setPreferencesOpen(true)}
            className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            Preferences
          </button>
        </nav>

        <div className="flex items-center shrink-0">
          {!authReady ? (
            <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
              Connecting...
            </span>
          ) : user ? (
            <button
              type="button"
              onClick={handleNewChat}
              className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 text-xs font-semibold hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0"
            >
              New Chat
            </button>
          ) : (
            <button
              type="button"
              onClick={signInWithGoogle}
              className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 text-xs font-semibold hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0"
            >
              Sign in with Google
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <Sidebar
          open={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
          conversations={conversations}
          activeConversationId={activeConversationId}
          loadingConversations={loadingConversations}
          isSignedIn={Boolean(user)}
          userName={profile?.displayName || user?.displayName || null}
          userEmail={profile?.email || user?.email || null}
          onNewChat={handleNewChat}
          onSelectConversation={(id) => {
            stopSpeech();
            setActiveConversationId(id);
          }}
          onRenameConversation={renameConversation}
          onDeleteConversation={deleteConversation}
          onOpenPreferences={() => setPreferencesOpen(true)}
          onSignIn={signInWithGoogle}
          onSignOut={signOutUser}
        />

        <main className="flex-1 flex flex-col min-w-0 bg-[#0A0E17]">
          {/* Workspace Toolbar */}
          <div className="shrink-0 border-b border-white/8 px-4 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 bg-[#0A0E17]">
            <div
              className="flex items-center gap-1 p-1 bg-[#111827] border border-white/8 rounded-lg"
              role="tablist"
              aria-label="Assistant modes"
            >
              {MODE_OPTIONS.map((opt) => {
                const active = mode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setMode(opt.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-sky-500 text-slate-950 font-semibold'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              {mode === 'general' && (
                <button
                  type="button"
                  onClick={() => setUseWebSearch((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    useWebSearch
                      ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                      : 'border-white/10 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Web Search: {useWebSearch ? 'On' : 'Off'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setVoiceOverlayOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-slate-200 hover:bg-white/5 transition-colors whitespace-nowrap shrink-0"
              >
                <Mic className="w-3.5 h-3.5 text-sky-400" />
                <span>Voice Mode</span>
              </button>
            </div>
          </div>

          {/* Alerts / Connection Issues */}
          {(errorBanner || authError || !firestoreOnline) && (
            <div className="px-4 lg:px-8 pt-3 space-y-2 shrink-0">
              {!firestoreOnline && (
                <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 text-xs text-amber-200">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                    Unable to reach Cloud Firestore right now. Check your network connection.
                  </span>
                </div>
              )}
              {(errorBanner || authError) && (
                <div className="flex items-center justify-between gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-xs text-red-200">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <span className="break-words">{errorBanner || authError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setErrorBanner(null)}
                    aria-label="Dismiss error"
                    className="p-1 text-red-300 hover:text-white shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Chat Message Stream or Empty State */}
          <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6">
            <div className="max-w-4xl mx-auto space-y-5">
              {loadingMessages ? (
                <div className="space-y-4">
                  <div className="h-20 rounded-2xl bg-white/5 animate-pulse w-2/3 ml-auto" />
                  <div className="h-32 rounded-2xl bg-white/5 animate-pulse w-3/4" />
                </div>
              ) : activeMessages.length === 0 ? (
                <div className="py-8 md:py-12 flex flex-col items-center text-center space-y-6">
                  <VoiceOrb state={sending ? 'thinking' : 'idle'} size="lg" />

                  <div className="space-y-2 max-w-xl">
                    <h1 className="font-display text-2xl md:text-3xl font-bold text-slate-100">
                      How can JARVIS assist you today?
                    </h1>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Talk or type in English, Urdu, Roman Urdu, or Hindi. Analyze images and files, search live web sources, or switch to hands-free Voice Mode.
                    </p>
                  </div>

                  <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3 text-left pt-2">
                    {STARTER_PROMPTS.map((item) => {
                      const IconComp =
                        item.mode === 'coding'
                          ? Code2
                          : item.mode === 'writing'
                          ? PenLine
                          : item.mode === 'translate'
                          ? Languages
                          : Sparkles;

                      return (
                        <button
                          key={item.title}
                          type="button"
                          onClick={() => {
                            setMode(item.mode);
                            sendMessageCore(item.prompt, item.mode, null).catch(() => {});
                          }}
                          className="bg-[#111827] border border-white/8 hover:border-sky-500/40 rounded-xl p-4 transition-colors text-left space-y-1.5 group"
                        >
                          <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
                            <IconComp className="w-3.5 h-3.5 shrink-0" />
                            <span>{item.title}</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed line-clamp-2 group-hover:text-slate-100">
                            {item.prompt}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                activeMessages.map((msg) => (
                  <ChatMessageItem
                    key={msg.id}
                    message={msg}
                    isSpeaking={speakingMessageId === msg.id}
                    onToggleSpeak={speakMessage}
                  />
                ))
              )}

              {sending && (
                <div className="flex justify-start">
                  <div className="bg-[#111827] border border-white/8 rounded-2xl px-5 py-4 flex items-center gap-3">
                    <VoiceOrb state="thinking" size="sm" />
                    <span className="text-sm text-slate-300">
                      JARVIS is preparing your response...
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Composer */}
          <div className="shrink-0 border-t border-white/8 bg-[#0D1320] px-4 lg:px-8 py-3">
            <form
              onSubmit={handleSubmit}
              className="max-w-4xl mx-auto space-y-2.5"
            >
              {attachment && (
                <div className="flex items-center justify-between gap-3 bg-[#111827] border border-sky-500/30 rounded-xl px-3.5 py-2">
                  <div className="flex items-center gap-3 min-w-0">
                    {attachment.previewUrl ? (
                      <img
                        src={attachment.previewUrl}
                        alt={attachment.name}
                        className="w-9 h-9 rounded-lg object-cover border border-white/10 shrink-0"
                      />
                    ) : (
                      <Paperclip className="w-4 h-4 text-sky-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-100 truncate">
                        {attachment.name}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {attachment.mimeType}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    aria-label="Remove attachment"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/5 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2 bg-[#0A0E17] border border-white/12 focus-within:border-sky-400 rounded-2xl p-2 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf,.txt,.md,.csv,.json,.js,.ts,.tsx,.py,.html,.css"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach image, PDF, or document"
                  aria-label="Attach image, PDF, or document"
                  className="p-2.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors shrink-0"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setQuickActionsOpen(true)}
                  title="Quick Actions & Phone Tools"
                  aria-label="Open quick actions"
                  className="p-2.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors shrink-0 md:hidden"
                >
                  <Compass className="w-4 h-4" />
                </button>

                <textarea
                  rows={1}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Ask JARVIS in Urdu, Hindi, or English..."
                  className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 px-2 py-2.5 max-h-36 focus:outline-none resize-none leading-relaxed"
                />

                <button
                  type="button"
                  onClick={toggleDictation}
                  title={dictating ? 'Stop voice dictation' : 'Dictate message'}
                  aria-label={dictating ? 'Stop voice dictation' : 'Dictate message'}
                  className={`p-2.5 rounded-xl transition-colors shrink-0 ${
                    dictating
                      ? 'bg-red-500/20 text-red-400'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                  }`}
                >
                  {dictating ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </button>

                <button
                  type="submit"
                  disabled={sending || (!inputText.trim() && !attachment)}
                  aria-label="Send message"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-500 text-slate-950 text-xs font-semibold hover:bg-sky-400 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>

      <VoiceOverlay
        open={voiceOverlayOpen}
        onClose={() => setVoiceOverlayOpen(false)}
        preferredLanguage={preferredLanguage}
        onSendVoiceMessage={(transcript) => sendMessageCore(transcript, mode, null)}
      />

      <QuickActionsModal
        open={quickActionsOpen}
        onClose={() => setQuickActionsOpen(false)}
        onCameraCaptureRequest={() => cameraInputRef.current?.click()}
      />

      <PreferencesModal
        open={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
        preferredLanguage={preferredLanguage}
        voiceEnabled={voiceEnabled}
        memoryNotes={memoryNotes}
        isSignedIn={Boolean(user)}
        onSave={async (updates) => {
          if (user) {
            await updatePreferences(updates);
          } else {
            setGuestLanguage(updates.preferredLanguage);
            setGuestVoiceEnabled(updates.voiceEnabled);
            setGuestMemoryNotes(updates.memoryNotes);
          }
        }}
      />
    </div>
  );
}
