import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
} from '../lib/firebase';
import {
  AssistantMode,
  ChatMessage,
  Conversation,
  PreferredLanguage,
  UserProfile,
} from '../types';

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  firestoreOnline: boolean;
  profile: UserProfile | null;
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: ChatMessage[];
  loadingConversations: boolean;
  loadingMessages: boolean;
  authError: string | null;
  setActiveConversationId: (id: string | null) => void;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  updatePreferences: (updates: {
    preferredLanguage?: PreferredLanguage;
    voiceEnabled?: boolean;
    memoryNotes?: string;
  }) => Promise<void>;
  persistTurn: (params: {
    conversationId: string | null;
    titleIfNew: string;
    mode: AssistantMode;
    userMessage: string;
    assistantReply: string;
    hasAttachment: boolean;
    attachmentName: string;
    attachmentType: string;
    groundingLinks: string[];
  }) => Promise<string>;
  renameConversation: (conversationId: string, newTitle: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | undefined>(undefined);

function toMillis(val: unknown): number {
  if (val instanceof Timestamp) {
    return val.toMillis();
  }
  return Date.now();
}

function makeClientId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${randomPart}`;
}

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [firestoreOnline, setFirestoreOnline] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    testFirestoreConnection().then((ok) => setFirestoreOnline(ok));
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);

      if (!nextUser) {
        setProfile(null);
        setConversations([]);
        setMessages([]);
        setActiveConversationId(null);
        return;
      }

      const userDocRef = doc(db, 'users', nextUser.uid);
      try {
        const snap = await getDoc(userDocRef);
        if (!snap.exists()) {
          const displayName = (nextUser.displayName || 'User').slice(0, 100);
          const email = (nextUser.email || '').slice(0, 200);
          await setDoc(userDocRef, {
            uid: nextUser.uid,
            displayName,
            email,
            preferredLanguage: 'auto',
            voiceEnabled: false,
            memoryNotes: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setProfile({
            uid: nextUser.uid,
            displayName,
            email,
            preferredLanguage: 'auto',
            voiceEnabled: false,
            memoryNotes: '',
            createdAtMs: Date.now(),
            updatedAtMs: Date.now(),
          });
        } else {
          const d = snap.data();
          setProfile({
            uid: String(d.uid || nextUser.uid),
            displayName: String(d.displayName || 'User'),
            email: String(d.email || ''),
            preferredLanguage: (d.preferredLanguage as PreferredLanguage) || 'auto',
            voiceEnabled: Boolean(d.voiceEnabled),
            memoryNotes: String(d.memoryNotes || ''),
            createdAtMs: toMillis(d.createdAt),
            updatedAtMs: toMillis(d.updatedAt),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${nextUser.uid}`);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !user) {
      return;
    }

    setLoadingConversations(true);
    const convQuery = query(
      collection(db, 'conversations'),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      convQuery,
      (snapshot) => {
        const loaded: Conversation[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            ownerId: String(d.ownerId),
            title: String(d.title || 'New Conversation'),
            mode: (d.mode as AssistantMode) || 'general',
            messageCount: Number(d.messageCount || 0),
            lastMessagePreview: String(d.lastMessagePreview || ''),
            createdAtMs: toMillis(d.createdAt),
            updatedAtMs: toMillis(d.updatedAt),
          };
        });
        loaded.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setConversations(loaded);
        setLoadingConversations(false);

        setActiveConversationId((prev) => {
          if (prev && loaded.some((c) => c.id === prev)) {
            return prev;
          }
          return loaded.length > 0 ? loaded[0].id : null;
        });
      },
      (error) => {
        setLoadingConversations(false);
        handleFirestoreError(error, OperationType.LIST, 'conversations');
      }
    );

    return () => unsubscribe();
  }, [authReady, user]);

  useEffect(() => {
    if (!authReady || !user || !activeConversationId) {
      setMessages([]);
      setLoadingMessages(false);
      return;
    }

    setLoadingMessages(true);
    const msgPath = `conversations/${activeConversationId}/messages`;
    const msgQuery = query(
      collection(db, 'conversations', activeConversationId, 'messages'),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      msgQuery,
      (snapshot) => {
        const loaded: ChatMessage[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            ownerId: String(d.ownerId),
            role: d.role === 'assistant' ? 'assistant' : 'user',
            content: String(d.content || ''),
            mode: (d.mode as AssistantMode) || 'general',
            hasAttachment: Boolean(d.hasAttachment),
            attachmentName: String(d.attachmentName || ''),
            attachmentType: String(d.attachmentType || ''),
            groundingLinks: Array.isArray(d.groundingLinks)
              ? d.groundingLinks.map(String)
              : [],
            createdAtMs: toMillis(d.createdAt),
          };
        });
        loaded.sort((a, b) => a.createdAtMs - b.createdAtMs);
        setMessages(loaded);
        setLoadingMessages(false);
      },
      (error) => {
        setLoadingMessages(false);
        handleFirestoreError(error, OperationType.LIST, msgPath);
      }
    );

    return () => unsubscribe();
  }, [authReady, user, activeConversationId]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      setAuthError(msg);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  const updatePreferences = useCallback(
    async (updates: {
      preferredLanguage?: PreferredLanguage;
      voiceEnabled?: boolean;
      memoryNotes?: string;
    }) => {
      if (!user || !profile) return;
      const userRef = doc(db, 'users', user.uid);
      const nextPreferredLanguage = updates.preferredLanguage ?? profile.preferredLanguage;
      const nextVoiceEnabled = updates.voiceEnabled ?? profile.voiceEnabled;
      const nextMemoryNotes = (updates.memoryNotes ?? profile.memoryNotes).slice(0, 2000);

      try {
        await updateDoc(userRef, {
          preferredLanguage: nextPreferredLanguage,
          voiceEnabled: nextVoiceEnabled,
          memoryNotes: nextMemoryNotes,
          updatedAt: serverTimestamp(),
        });
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                preferredLanguage: nextPreferredLanguage,
                voiceEnabled: nextVoiceEnabled,
                memoryNotes: nextMemoryNotes,
                updatedAtMs: Date.now(),
              }
            : prev
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }
    },
    [user, profile]
  );

  const persistTurn = useCallback(
    async (params: {
      conversationId: string | null;
      titleIfNew: string;
      mode: AssistantMode;
      userMessage: string;
      assistantReply: string;
      hasAttachment: boolean;
      attachmentName: string;
      attachmentType: string;
      groundingLinks: string[];
    }): Promise<string> => {
      if (!user) {
        throw new Error('Authentication required to persist conversations.');
      }

      const convId = params.conversationId || makeClientId('conv');
      const convRef = doc(db, 'conversations', convId);
      const existingConv = conversations.find((c) => c.id === convId);
      const prevCount = existingConv ? existingConv.messageCount : 0;

      const safeTitle = (params.titleIfNew.trim() || 'New Conversation').slice(0, 120);
      const safePreview = params.assistantReply.replace(/\s+/g, ' ').trim().slice(0, 280);
      const safeUserContent = params.userMessage.trim().slice(0, 30000) || '[Attachment]';
      const safeAssistantContent = params.assistantReply.trim().slice(0, 30000);
      const safeLinks = params.groundingLinks.slice(0, 10).map((u) => u.slice(0, 500));

      const batch = writeBatch(db);

      if (!existingConv) {
        batch.set(convRef, {
          ownerId: user.uid,
          title: safeTitle,
          mode: params.mode,
          messageCount: 2,
          lastMessagePreview: safePreview,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.update(convRef, {
          mode: params.mode,
          messageCount: prevCount + 2,
          lastMessagePreview: safePreview,
          updatedAt: serverTimestamp(),
        });
      }

      const userMsgId = makeClientId('msg_u');
      const assistantMsgId = makeClientId('msg_a');

      batch.set(doc(db, 'conversations', convId, 'messages', userMsgId), {
        ownerId: user.uid,
        role: 'user',
        content: safeUserContent,
        mode: params.mode,
        hasAttachment: params.hasAttachment,
        attachmentName: params.attachmentName.slice(0, 200),
        attachmentType: params.attachmentType.slice(0, 100),
        groundingLinks: [],
        createdAt: serverTimestamp(),
      });

      batch.set(doc(db, 'conversations', convId, 'messages', assistantMsgId), {
        ownerId: user.uid,
        role: 'assistant',
        content: safeAssistantContent,
        mode: params.mode,
        hasAttachment: false,
        attachmentName: '',
        attachmentType: '',
        groundingLinks: safeLinks,
        createdAt: serverTimestamp(),
      });

      try {
        await batch.commit();
        setActiveConversationId(convId);
        return convId;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `conversations/${convId}`);
      }
    },
    [user, conversations]
  );

  const renameConversation = useCallback(
    async (conversationId: string, newTitle: string) => {
      if (!user) return;
      const safeTitle = newTitle.trim().slice(0, 120);
      if (!safeTitle) return;

      try {
        await updateDoc(doc(db, 'conversations', conversationId), {
          title: safeTitle,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.UPDATE,
          `conversations/${conversationId}`
        );
      }
    },
    [user]
  );

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      if (!user) return;
      try {
        const msgSnap = await getDocs(
          query(
            collection(db, 'conversations', conversationId, 'messages'),
            where('ownerId', '==', user.uid)
          )
        );
        const batch = writeBatch(db);
        msgSnap.docs.forEach((d) => batch.delete(d.ref));
        batch.delete(doc(db, 'conversations', conversationId));
        await batch.commit();

        if (activeConversationId === conversationId) {
          setActiveConversationId(null);
        }
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.DELETE,
          `conversations/${conversationId}`
        );
      }
    },
    [user, activeConversationId]
  );

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authReady,
        firestoreOnline,
        profile,
        conversations,
        activeConversationId,
        messages,
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
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used inside FirebaseProvider');
  }
  return ctx;
}
