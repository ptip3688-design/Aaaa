export type AssistantMode = 'general' | 'coding' | 'writing' | 'translate';

export type PreferredLanguage = 'auto' | 'en' | 'ur' | 'roman-ur' | 'hi';

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  preferredLanguage: PreferredLanguage;
  voiceEnabled: boolean;
  memoryNotes: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface Conversation {
  id: string;
  ownerId: string;
  title: string;
  mode: AssistantMode;
  messageCount: number;
  lastMessagePreview: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface ChatMessage {
  id: string;
  ownerId: string;
  role: 'user' | 'assistant';
  content: string;
  mode: AssistantMode;
  hasAttachment: boolean;
  attachmentName: string;
  attachmentType: string;
  groundingLinks: string[];
  createdAtMs: number;
}

export interface AttachmentPayload {
  name: string;
  mimeType: string;
  base64Data?: string;
  textContent?: string;
  previewUrl?: string;
}
