import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('MISSING_GEMINI_API_KEY');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

type AssistantMode = 'general' | 'coding' | 'writing' | 'translate';
type PreferredLanguage = 'auto' | 'en' | 'ur' | 'roman-ur' | 'hi';

interface HistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

interface AttachmentInput {
  name: string;
  mimeType: string;
  base64Data?: string;
  textContent?: string;
}

interface ChatRequestBody {
  message: string;
  history?: HistoryItem[];
  mode?: AssistantMode;
  preferredLanguage?: PreferredLanguage;
  memoryNotes?: string;
  useWebSearch?: boolean;
  attachment?: AttachmentInput | null;
}

function buildSystemInstruction(
  mode: AssistantMode,
  preferredLanguage: PreferredLanguage,
  memoryNotes?: string
): string {
  const modeDirectives: Record<AssistantMode, string> = {
    general:
      'Active Mode: General Personal Assistant. Provide accurate, well-structured, practical answers across general knowledge, research, planning, math, and everyday tasks.',
    coding:
      'Active Mode: Software Engineering & Coding Co-Pilot. Write clean, production-grade code, explain architecture clearly, debug root causes accurately, and include concise runnable examples.',
    writing:
      'Active Mode: Writing & Communication Assistant. Craft polished emails, WhatsApp/SMS drafts, essays, stories, and prompts tailored to the requested tone and audience.',
    translate:
      'Active Mode: Multilingual Translator. Translate accurately and naturally between Urdu, Roman Urdu, Hindi, and English while preserving tone, idioms, and intent.',
  };

  const languageDirectives: Record<PreferredLanguage, string> = {
    auto: 'Language Policy: Automatically detect the user’s language (Urdu script, Roman Urdu, Hindi, or English) and reply in that exact same language and script.',
    en: 'Language Policy: Reply in clear, natural English unless the user explicitly asks for a translation.',
    ur: 'Language Policy: Reply in natural, well-formatted Urdu (اردو رسم الخط) unless the user explicitly asks for another language.',
    'roman-ur':
      'Language Policy: Reply in natural, easy-to-read Roman Urdu (e.g., "Aap ka kaam ho gaya hai...") unless the user asks for another language.',
    hi: 'Language Policy: Reply in natural, clear Hindi (हिन्दी) unless the user asks for another language.',
  };

  const memoryBlock =
    memoryNotes && memoryNotes.trim().length > 0
      ? `\n\nSaved User Preferences & Context (use naturally when relevant):\n${memoryNotes.trim()}`
      : '';

  return `You are JARVIS AI, an intelligent, calm, and reliable personal assistant powered by Google's Gemini API.

Core Personality & Rules:
1. Act like an intelligent, professional personal assistant. Respond naturally, clearly, and directly.
2. Understand Urdu, Roman Urdu, Hindi, and English fluently.
3. Never invent facts, fabricate search results, or pretend an external device action was completed if it was not.
4. When a user asks to open phone apps (YouTube, WhatsApp, Dialer, Camera, Settings, Gallery) or send SMS/calls, clearly guide them or offer the exact draft text and remind them to confirm using the Quick Actions launcher in the app.
5. Keep formatting crisp and scannable with clean headings, lists, or fenced code blocks where appropriate.

${modeDirectives[mode]}
${languageDirectives[preferredLanguage]}${memoryBlock}`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  app.use('/api', (req: Request, res: Response, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'jarvis-ai' });
  });

  app.post('/api/jarvis/chat', async (req: Request, res: Response) => {
    try {
      const body = req.body as ChatRequestBody;
      const message = (body.message || '').trim();
      const mode: AssistantMode = body.mode || 'general';
      const preferredLanguage: PreferredLanguage = body.preferredLanguage || 'auto';
      const useWebSearch = Boolean(body.useWebSearch);
      const history = Array.isArray(body.history) ? body.history.slice(-16) : [];
      const attachment = body.attachment || null;

      if (!message && !attachment) {
        res.status(400).json({ error: 'Message or attachment is required.' });
        return;
      }

      const ai = getGeminiClient();
      const systemInstruction = buildSystemInstruction(
        mode,
        preferredLanguage,
        body.memoryNotes
      );

      const contents: Array<{
        role: 'user' | 'model';
        parts: Array<
          | { text: string }
          | { inlineData: { mimeType: string; data: string } }
        >;
      }> = [];

      for (const item of history) {
        if (!item.content || !item.content.trim()) continue;
        contents.push({
          role: item.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: item.content.slice(0, 12000) }],
        });
      }

      const currentParts: Array<
        | { text: string }
        | { inlineData: { mimeType: string; data: string } }
      > = [];

      if (attachment) {
        if (attachment.base64Data && attachment.mimeType) {
          currentParts.push({
            inlineData: {
              mimeType: attachment.mimeType,
              data: attachment.base64Data,
            },
          });
        } else if (attachment.textContent) {
          currentParts.push({
            text: `[Attached File: ${attachment.name}]\n\`\`\`\n${attachment.textContent.slice(0, 24000)}\n\`\`\``,
          });
        }
      }

      currentParts.push({
        text: message || `Please analyze the attached file (${attachment?.name || 'attachment'}).`,
      });

      contents.push({
        role: 'user',
        parts: currentParts,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction,
          ...(useWebSearch ? { tools: [{ googleSearch: {} }] } : {}),
        },
      });

      const reply = (response.text || '').trim();
      if (!reply) {
        res.status(502).json({
          error: 'JARVIS received an empty response from Gemini. Please try rephrasing your request.',
        });
        return;
      }

      const rawChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const seenUrls = new Set<string>();
      const groundingLinks: string[] = [];

      for (const chunk of rawChunks) {
        const uri = chunk.web?.uri;
        if (uri && !seenUrls.has(uri) && groundingLinks.length < 10) {
          seenUrls.add(uri);
          groundingLinks.push(uri);
        }
      }

      res.json({
        reply,
        groundingLinks,
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('JARVIS Gemini API Error:', errMsg);

      if (errMsg.includes('MISSING_GEMINI_API_KEY')) {
        res.status(500).json({
          error:
            'Gemini API key is not configured. Please verify GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }

      if (
        errMsg.includes('API_KEY_INVALID') ||
        errMsg.includes('PERMISSION_DENIED') ||
        errMsg.includes('403') ||
        errMsg.includes('401')
      ) {
        res.status(403).json({
          error:
            'Gemini API authorization failed. Please check your GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }

      if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429')) {
        res.status(429).json({
          error:
            'Gemini API rate limit or quota reached. Please wait a moment and try again.',
        });
        return;
      }

      res.status(500).json({
        error: 'Unable to reach Gemini right now. Please try again in a moment.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`JARVIS AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start JARVIS AI server:', err);
  process.exit(1);
});
