import { useState } from 'react';
import {
  Check,
  LogOut,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { AssistantMode, Conversation } from '../types';

interface SidebarProps {
  open: boolean;
  onCloseMobile: () => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  loadingConversations: boolean;
  isSignedIn: boolean;
  userName: string | null;
  userEmail: string | null;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => Promise<void>;
  onDeleteConversation: (id: string) => Promise<void>;
  onOpenPreferences: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

const MODE_LABELS: Record<AssistantMode, string> = {
  general: 'General',
  coding: 'Coding',
  writing: 'Writing',
  translate: 'Translate',
};

function formatRelativeTime(ms: number): string {
  const diffMin = Math.floor((Date.now() - ms) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function Sidebar({
  open,
  onCloseMobile,
  conversations,
  activeConversationId,
  loadingConversations,
  isSignedIn,
  userName,
  userEmail,
  onNewChat,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onOpenPreferences,
  onSignIn,
  onSignOut,
}: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredConversations = conversations.filter((conv) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      conv.title.toLowerCase().includes(q) ||
      conv.lastMessagePreview.toLowerCase().includes(q)
    );
  });

  const saveRename = async (id: string) => {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      await onRenameConversation(id, trimmed);
    }
    setEditingId(null);
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-[268px] shrink-0 bg-[#0D1320] border-r border-white/8 flex flex-col transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-4 border-b border-white/8 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              onCloseMobile();
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-sky-500 text-slate-950 text-xs font-semibold hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Conversation
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close sidebar"
            className="p-2 rounded-lg border border-white/10 text-slate-400 hover:text-slate-100 lg:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 pt-3 pb-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search history..."
              aria-label="Search conversation history"
              className="w-full bg-[#0A0E17] border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {!isSignedIn ? (
            <div className="p-3.5 rounded-xl bg-[#111827] border border-white/8 space-y-2.5 mt-2">
              <div className="text-xs font-semibold text-slate-200">
                Cloud Sync Available
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Sign in with Google to save chats, voice preferences, and memory notes online across sessions.
              </p>
              <button
                type="button"
                onClick={onSignIn}
                className="w-full px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-slate-100 transition-colors whitespace-nowrap"
              >
                Sign in with Google
              </button>
            </div>
          ) : loadingConversations ? (
            <div className="space-y-2 pt-2">
              <div className="h-12 rounded-lg bg-white/5 animate-pulse" />
              <div className="h-12 rounded-lg bg-white/5 animate-pulse" />
              <div className="h-12 rounded-lg bg-white/5 animate-pulse" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="px-3 py-8 text-center space-y-1">
              <MessageSquare className="w-5 h-5 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">
                {searchTerm ? 'No matching conversations.' : 'No saved conversations yet.'}
              </p>
              <p className="text-[11px] text-slate-500">
                Send a message to start syncing with Firebase.
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = conv.id === activeConversationId;
              const isEditing = editingId === conv.id;
              const isDeleting = confirmDeleteId === conv.id;

              return (
                <div
                  key={conv.id}
                  className={`group rounded-lg border transition-colors ${
                    isActive
                      ? 'bg-[#151F32] border-sky-500/35'
                      : 'bg-transparent border-transparent hover:bg-white/5'
                  }`}
                >
                  {isEditing ? (
                    <div className="p-2 flex items-center gap-1.5">
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRename(conv.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        className="flex-1 min-w-0 bg-[#0A0E17] border border-sky-400 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => saveRename(conv.id)}
                        aria-label="Save title"
                        className="p-1.5 text-emerald-400 hover:bg-white/10 rounded"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : isDeleting ? (
                    <div className="p-2.5 flex items-center justify-between gap-2">
                      <span className="text-xs text-red-300 truncate">Delete chat?</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            await onDeleteConversation(conv.id);
                            setConfirmDeleteId(null);
                          }}
                          className="px-2 py-1 rounded bg-red-500 text-white text-[11px] font-medium hover:bg-red-400"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded border border-white/10 text-[11px] text-slate-300 hover:bg-white/5"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-1 p-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectConversation(conv.id);
                          onCloseMobile();
                        }}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="text-xs font-medium text-slate-100 truncate">
                          {conv.title}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1 tabular-nums">
                          <span>{MODE_LABELS[conv.mode]}</span>
                          <span aria-hidden="true">&middot;</span>
                          <span>{conv.messageCount} msgs</span>
                          <span aria-hidden="true">&middot;</span>
                          <span>{formatRelativeTime(conv.updatedAtMs)}</span>
                        </div>
                      </button>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(conv.id);
                            setEditingTitle(conv.title);
                          }}
                          title="Rename conversation"
                          aria-label="Rename conversation"
                          className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-white/10"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(conv.id)}
                          title="Delete conversation"
                          aria-label="Delete conversation"
                          className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-white/10"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 border-t border-white/8 space-y-2">
          <button
            type="button"
            onClick={() => {
              onOpenPreferences();
              onCloseMobile();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-white/10 text-xs font-medium text-slate-200 hover:bg-white/5 transition-colors whitespace-nowrap"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>Preferences &amp; Memory</span>
          </button>

          {isSignedIn && (
            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-200 truncate">
                  {userName || 'Signed In'}
                </div>
                <div className="text-[11px] text-slate-500 truncate">{userEmail}</div>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                title="Sign out"
                aria-label="Sign out"
                className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
