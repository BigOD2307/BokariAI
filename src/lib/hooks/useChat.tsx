'use client';

import { Block } from '@/lib/types';
import type { Message, Widget } from '@/lib/types/window';
import type { Section } from '@/lib/types/section';
import type { Attachment } from '@/lib/types/multimodal';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import crypto from 'crypto';
import { useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { authFetch } from '@/lib/supabase/fetch';
import { getSuggestions } from '../actions';
import { MinimalProvider } from '../models/types';
import { getAutoMediaSearch } from '../config/clientRegistry';
import { applyPatch } from 'rfc6902';
import { truncateHistory } from '../utils/chatHistory';
import { withTimeout } from '../utils/streamTimeout';

/** SSE stream budgets on the client.  These guard the user against
 *  a stalled backend — if no chunk arrives within these windows,
 *  we surface a clean error rather than spinning forever. */
const SSE_FIRST_CHUNK_MS = 60_000;
const SSE_IDLE_MS = 45_000;

export type { Section } from '@/lib/types/section';

type ChatContext = {
  messages: Message[];
  sections: Section[];
  chatHistory: [string, string][];
  files: File[];
  fileIds: string[];
  sources: string[];
  chatId: string | undefined;
  optimizationMode: string;
  isMessagesLoaded: boolean;
  loading: boolean;
  notFound: boolean;
  messageAppeared: boolean;
  isReady: boolean;
  hasError: boolean;
  chatModelProvider: ChatModelProvider;
  embeddingModelProvider: EmbeddingModelProvider;
  researchEnded: boolean;
  setResearchEnded: (ended: boolean) => void;
  setOptimizationMode: (mode: string) => void;
  setSources: (sources: string[]) => void;
  setFiles: (files: File[]) => void;
  setFileIds: (fileIds: string[]) => void;
  pendingAttachments: Attachment[];
  addAttachment: (att: Attachment) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  sendMessage: (
    message: string,
    messageId?: string,
    rewrite?: boolean,
  ) => Promise<void>;
  rewrite: (messageId: string) => void;
  setChatModelProvider: (provider: ChatModelProvider) => void;
  setEmbeddingModelProvider: (provider: EmbeddingModelProvider) => void;
};

export interface File {
  fileName: string;
  fileExtension: string;
  fileId: string;
}

interface ChatModelProvider {
  key: string;
  providerId: string;
}

interface EmbeddingModelProvider {
  key: string;
  providerId: string;
}

const checkConfig = async (
  setChatModelProvider: (provider: ChatModelProvider) => void,
  setEmbeddingModelProvider: (provider: EmbeddingModelProvider) => void,
  setIsConfigReady: (ready: boolean) => void,
  setHasError: (hasError: boolean) => void,
) => {
  try {
    let chatModelKey = localStorage.getItem('chatModelKey');
    let chatModelProviderId = localStorage.getItem('chatModelProviderId');
    let embeddingModelKey = localStorage.getItem('embeddingModelKey');
    let embeddingModelProviderId = localStorage.getItem(
      'embeddingModelProviderId',
    );

    const res = await fetch(`/api/providers`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(
        `Provider fetching failed with status code ${res.status}`,
      );
    }

    const data = await res.json();
    const providers: MinimalProvider[] = data.providers;

    if (providers.length === 0) {
      throw new Error(
        'No chat model providers found, please configure them in the settings page.',
      );
    }

    const chatModelProvider =
      providers.find((p) => p.id === chatModelProviderId) ??
      providers.find((p) => p.chatModels.length > 0);

    if (!chatModelProvider) {
      throw new Error(
        'No chat models found, pleae configure them in the settings page.',
      );
    }

    chatModelProviderId = chatModelProvider.id;

    const chatModel =
      chatModelProvider.chatModels.find((m) => m.key === chatModelKey) ??
      chatModelProvider.chatModels[0];
    chatModelKey = chatModel.key;

    const embeddingModelProvider =
      providers.find((p) => p.id === embeddingModelProviderId) ??
      providers.find((p) => p.embeddingModels.length > 0);

    if (!embeddingModelProvider) {
      throw new Error(
        'No embedding models found, pleae configure them in the settings page.',
      );
    }

    embeddingModelProviderId = embeddingModelProvider.id;

    const embeddingModel =
      embeddingModelProvider.embeddingModels.find(
        (m) => m.key === embeddingModelKey,
      ) ?? embeddingModelProvider.embeddingModels[0];
    embeddingModelKey = embeddingModel.key;

    localStorage.setItem('chatModelKey', chatModelKey);
    localStorage.setItem('chatModelProviderId', chatModelProviderId);
    localStorage.setItem('embeddingModelKey', embeddingModelKey);
    localStorage.setItem('embeddingModelProviderId', embeddingModelProviderId);

    setChatModelProvider({
      key: chatModelKey,
      providerId: chatModelProviderId,
    });

    setEmbeddingModelProvider({
      key: embeddingModelKey,
      providerId: embeddingModelProviderId,
    });

    setIsConfigReady(true);
  } catch (err: any) {
    console.error('An error occurred while checking the configuration:', err);
    toast.error(err.message);
    setIsConfigReady(false);
    setHasError(true);
  }
};

const loadMessages = async (
  chatId: string,
  setMessages: (messages: Message[]) => void,
  setIsMessagesLoaded: (loaded: boolean) => void,
  chatHistory: React.MutableRefObject<[string, string][]>,
  setSources: (sources: string[]) => void,
  setNotFound: (notFound: boolean) => void,
  setFiles: (files: File[]) => void,
  setFileIds: (fileIds: string[]) => void,
) => {
  const res = await authFetch(`/api/chats/${chatId}`, {
    method: 'GET',
  });

  if (res.status === 404) {
    setNotFound(true);
    setIsMessagesLoaded(true);
    return;
  }

  const data = await res.json();

  const messages = ((data.messages || []) as Message[]).map((msg) => ({
    ...msg,
    responseBlocks: msg.responseBlocks || [],
  }));

  setMessages(messages);

  const history: [string, string][] = [];
  messages.forEach((msg) => {
    history.push(['human', msg.query]);

    const textBlocks = (msg.responseBlocks || [])
      .filter(
        (block): block is Block & { type: 'text' } => block.type === 'text',
      )
      .map((block) => block.data)
      .join('\n');

    if (textBlocks) {
      history.push(['assistant', textBlocks]);
    }
  });

  console.debug(new Date(), 'app:messages_loaded');

  if (messages.length > 0) {
    document.title = messages[0].query;
  }

  const rawFiles = Array.isArray(data.chat?.files) ? data.chat.files : [];
  const files = rawFiles.map((file: any) => ({
    fileName: file.name,
    fileExtension: file.name?.split('.').pop() || '',
    fileId: file.fileId,
  }));

  setFiles(files);
  setFileIds(files.map((file: File) => file.fileId));

  chatHistory.current = history;
  setSources(Array.isArray(data.chat?.sources) ? data.chat.sources : []);
  setIsMessagesLoaded(true);
};

export const chatContext = createContext<ChatContext>({
  chatHistory: [],
  chatId: '',
  fileIds: [],
  files: [],
  sources: [],
  hasError: false,
  isMessagesLoaded: false,
  isReady: false,
  loading: false,
  messageAppeared: false,
  messages: [],
  sections: [],
  notFound: false,
  optimizationMode: '',
  chatModelProvider: { key: '', providerId: '' },
  embeddingModelProvider: { key: '', providerId: '' },
  researchEnded: false,
  rewrite: () => {},
  sendMessage: async () => {},
  setFileIds: () => {},
  setFiles: () => {},
  setSources: () => {},
  setOptimizationMode: () => {},
  setChatModelProvider: () => {},
  setEmbeddingModelProvider: () => {},
  setResearchEnded: () => {},
  pendingAttachments: [],
  addAttachment: () => {},
  removeAttachment: () => {},
  clearAttachments: () => {},
});

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const params: { chatId: string } = useParams();

  const searchParams = useSearchParams();
  const initialMessage = searchParams.get('q');

  const [chatId, setChatId] = useState<string | undefined>(params.chatId);
  const [newChatCreated, setNewChatCreated] = useState(false);

  const [loading, setLoading] = useState(false);
  const [messageAppeared, setMessageAppeared] = useState(false);

  const [researchEnded, setResearchEnded] = useState(false);

  const chatHistory = useRef<[string, string][]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  const [files, setFiles] = useState<File[]>([]);
  const [fileIds, setFileIds] = useState<string[]>([]);

  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>(
    [],
  );
  const addAttachment = useCallback((att: Attachment) => {
    setPendingAttachments((prev) => [...prev, att]);
  }, []);
  const removeAttachment = useCallback((id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);
  const clearAttachments = useCallback(() => {
    setPendingAttachments([]);
  }, []);

  const [sources, setSources] = useState<string[]>(['web']);
  const [optimizationMode, setOptimizationMode] = useState('speed');

  const [isMessagesLoaded, setIsMessagesLoaded] = useState(false);

  const [notFound, setNotFound] = useState(false);

  const [chatModelProvider, setChatModelProvider] = useState<ChatModelProvider>(
    {
      key: '',
      providerId: '',
    },
  );

  const [embeddingModelProvider, setEmbeddingModelProvider] =
    useState<EmbeddingModelProvider>({
      key: '',
      providerId: '',
    });

  const [isConfigReady, setIsConfigReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const messagesRef = useRef<Message[]>([]);

  const sections = useMemo<Section[]>(() => {
    return messages.map((msg) => {
      const textBlocks: string[] = [];
      let speechMessage = '';
      let thinkingEnded = false;
      let suggestions: string[] = [];

      const blocks = msg.responseBlocks || [];
      const sourceBlocks = blocks.filter(
        (block): block is Block & { type: 'source' } => block.type === 'source',
      );
      const sources = sourceBlocks.flatMap((block) => block.data);

      const widgetBlocks = blocks
        .filter((b) => b.type === 'widget')
        .map((b) => b.data) as Widget[];

      blocks.forEach((block) => {
        if (block.type === 'text') {
          let processedText = block.data;
          // Only match [number] or [1,2,3] — NOT markdown links [text](url)
          const citationRegex = /\[(\d+(?:\s*,\s*\d+)*)\](?!\()/g;
          const regex = /\[(\d+)\](?!\()/g;

          if (processedText.includes('<think>')) {
            const openThinkTag = processedText.match(/<think>/g)?.length || 0;
            const closeThinkTag =
              processedText.match(/<\/think>/g)?.length || 0;

            if (openThinkTag && !closeThinkTag) {
              processedText += '</think> <a> </a>';
            }
          }

          if (block.data.includes('</think>')) {
            thinkingEnded = true;
          }

          if (sources.length > 0) {
            processedText = processedText.replace(
              citationRegex,
              (_, capturedContent: string) => {
                const numbers = capturedContent
                  .split(',')
                  .map((numStr) => numStr.trim());

                const linksHtml = numbers
                  .map((numStr) => {
                    const number = parseInt(numStr);

                    if (isNaN(number) || number <= 0) {
                      return `[${numStr}]`;
                    }

                    const source = sources[number - 1];
                    const url = source?.metadata?.url;

                    if (url) {
                      // Short name: use domain like "Reuters", "BBC", "Le Monde"
                      let shortName = '';
                      try {
                        const hostname = new URL(url).hostname.replace('www.', '');
                        // Extract brand name from domain (e.g. "bbc.com" -> "BBC", "lemonde.fr" -> "Le Monde")
                        const domainParts = hostname.split('.');
                        const brand = domainParts[0];
                        shortName = brand.length <= 4
                          ? brand.toUpperCase()
                          : brand.charAt(0).toUpperCase() + brand.slice(1);
                      } catch {
                        shortName = `Source ${number}`;
                      }
                      const fullTitle = source?.metadata?.title || shortName;
                      return `<citation href="${url}" title="${fullTitle}">${shortName}</citation>`;
                    } else {
                      return ``;
                    }
                  })
                  .join('');

                return linksHtml;
              },
            );
            speechMessage += block.data.replace(regex, '');
          } else {
            processedText = processedText.replace(regex, '');
            speechMessage += block.data.replace(regex, '');
          }

          textBlocks.push(processedText);
        } else if (block.type === 'suggestion') {
          suggestions = block.data;
        }
      });

      return {
        message: msg,
        parsedTextBlocks: textBlocks,
        speechMessage,
        thinkingEnded,
        suggestions,
        widgets: widgetBlocks,
      };
    });
  }, [messages]);

  const isReconnectingRef = useRef(false);
  const handledMessageEndRef = useRef<Set<string>>(new Set());

  const checkReconnect = async () => {
    if (isReconnectingRef.current) return;

    setIsReady(true);
    console.debug(new Date(), 'app:ready');

    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];

      if (lastMsg.status === 'answering') {
        setLoading(true);
        setResearchEnded(false);
        setMessageAppeared(false);

        isReconnectingRef.current = true;

        const res = await authFetch(`/api/reconnect/${lastMsg.backendId}`, {
          method: 'POST',
        });

        if (!res.body) throw new Error('No response body');

        const reader = res.body?.getReader();
        const decoder = new TextDecoder('utf-8');

        let partialChunk = '';

        const messageHandler = getMessageHandler(lastMsg);

        const safeRead = withTimeout(
          (async function* () {
            while (true) {
              const { value, done } = await reader.read();
              if (done) return;
              yield value;
            }
          })(),
          {
            // Tighter on reconnect — the backend already has
            // buffered events, so a healthy reconnect emits within
            // a couple of seconds.  If not, the session is gone.
            firstChunkMs: 5_000,
            idleMs: 5_000,
            label: 'sse/reconnect',
          },
        );

        try {
          for await (const value of safeRead) {
            partialChunk += decoder.decode(value, { stream: true });

            try {
              const messages = partialChunk.split('\n');
              for (const msg of messages) {
                if (!msg.trim()) continue;
                const json = JSON.parse(msg);
                messageHandler(json);
              }
              partialChunk = '';
            } catch (error) {
              console.warn('Incomplete JSON, waiting for next chunk...');
            }
          }
        } finally {
          isReconnectingRef.current = false;
        }
      }
    }
  };

  useEffect(() => {
    checkConfig(
      setChatModelProvider,
      setEmbeddingModelProvider,
      setIsConfigReady,
      setHasError,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (params.chatId && params.chatId !== chatId) {
      setChatId(params.chatId);
      setMessages([]);
      chatHistory.current = [];
      setFiles([]);
      setFileIds([]);
      setIsMessagesLoaded(false);
      setNotFound(false);
      setNewChatCreated(false);
    }
  }, [params.chatId, chatId]);

  useEffect(() => {
    if (
      chatId &&
      !newChatCreated &&
      !isMessagesLoaded &&
      messages.length === 0
    ) {
      loadMessages(
        chatId,
        setMessages,
        setIsMessagesLoaded,
        chatHistory,
        setSources,
        setNotFound,
        setFiles,
        setFileIds,
      );
    } else if (!chatId) {
      setNewChatCreated(true);
      setIsMessagesLoaded(true);
      setChatId(crypto.randomBytes(20).toString('hex'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, isMessagesLoaded, newChatCreated, messages.length]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (isMessagesLoaded && isConfigReady && newChatCreated) {
      setIsReady(true);
      console.debug(new Date(), 'app:ready');
    } else if (isMessagesLoaded && isConfigReady && !newChatCreated) {
      checkReconnect();
    } else {
      setIsReady(false);
    }
  }, [isMessagesLoaded, isConfigReady, newChatCreated]);

  const rewrite = (messageId: string) => {
    const index = messages.findIndex((msg) => msg.messageId === messageId);

    if (index === -1) return;

    setMessages((prev) => prev.slice(0, index));

    chatHistory.current = chatHistory.current.slice(0, index * 2);

    const messageToRewrite = messages[index];
    sendMessage(messageToRewrite.query, messageToRewrite.messageId, true);
  };

  useEffect(() => {
    if (isReady && initialMessage && isConfigReady) {
      if (!isConfigReady) {
        toast.error('Cannot send message before the configuration is ready');
        return;
      }
      sendMessage(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfigReady, isReady, initialMessage]);

  const getMessageHandler = (message: Message) => {
    const messageId = message.messageId;

    return async (data: any) => {
      if (data.type === 'error') {
        toast.error(data.data);
        setLoading(false);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === messageId
              ? { ...msg, status: 'error' as const }
              : msg,
          ),
        );
        return;
      }

      if (data.type === 'researchComplete') {
        setResearchEnded(true);
        if (
          (message.responseBlocks || []).find(
            (b) => b.type === 'source' && b.data.length > 0,
          )
        ) {
          setMessageAppeared(true);
        }
      }

      if (data.type === 'block') {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.messageId === messageId) {
              const exists = (msg.responseBlocks || []).findIndex(
                (b) => b.id === data.block.id,
              );

              if (exists !== -1) {
                const existingBlocks = [...(msg.responseBlocks || [])];
                existingBlocks[exists] = data.block;

                return {
                  ...msg,
                  responseBlocks: existingBlocks,
                };
              }

              return {
                ...msg,
                responseBlocks: [...(msg.responseBlocks || []), data.block],
              };
            }
            return msg;
          }),
        );

        if (
          (data.block.type === 'source' && data.block.data.length > 0) ||
          data.block.type === 'text'
        ) {
          setMessageAppeared(true);
        }
      }

      if (data.type === 'chart' && data.chart) {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.messageId === messageId) {
              const existing = msg.charts ?? [];
              return { ...msg, charts: [...existing, data.chart] };
            }
            return msg;
          }),
        );
      }

      if (data.type === 'updateBlock') {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.messageId === messageId) {
              const updatedBlocks = (msg.responseBlocks || []).map((block) => {
                if (block.id === data.blockId) {
                  const updatedBlock = { ...block };
                  applyPatch(updatedBlock, data.patch);
                  return updatedBlock;
                }
                return block;
              });
              return { ...msg, responseBlocks: updatedBlocks };
            }
            return msg;
          }),
        );
      }

      if (data.type === 'messageEnd') {
        if (handledMessageEndRef.current.has(messageId)) {
          return;
        }

        handledMessageEndRef.current.add(messageId);

        const currentMsg = messagesRef.current.find(
          (msg) => msg.messageId === messageId,
        );

        const newHistory: [string, string][] = truncateHistory([
          ...chatHistory.current,
          ['human', message.query],
          [
            'assistant',
            (currentMsg?.responseBlocks || []).find((b) => b.type === 'text')?.data ||
              '',
          ],
        ]);

        chatHistory.current = newHistory;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === messageId
              ? { ...msg, status: 'completed' as const }
              : msg,
          ),
        );

        setLoading(false);

        const lastMsg = messagesRef.current[messagesRef.current.length - 1];

        const autoMediaSearch = getAutoMediaSearch();

        if (autoMediaSearch) {
          setTimeout(() => {
            document
              .getElementById(`search-images-${lastMsg.messageId}`)
              ?.click();

            document
              .getElementById(`search-videos-${lastMsg.messageId}`)
              ?.click();
          }, 200);
        }

        // Check if there are sources and no suggestions

        const hasSourceBlocks = (currentMsg?.responseBlocks || []).some(
          (block) => block.type === 'source' && block.data.length > 0,
        );
        const hasSuggestions = (currentMsg?.responseBlocks || []).some(
          (block) => block.type === 'suggestion',
        );

        if (hasSourceBlocks && !hasSuggestions) {
          const suggestions = await getSuggestions(newHistory);
          const suggestionBlock: Block = {
            id: crypto.randomBytes(7).toString('hex'),
            type: 'suggestion',
            data: suggestions,
          };

          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.messageId === messageId) {
                return {
                  ...msg,
                  responseBlocks: [...(msg.responseBlocks || []), suggestionBlock],
                };
              }
              return msg;
            }),
          );
        }
      }
    };
  };

  const sendMessage: ChatContext['sendMessage'] = async (
    message,
    messageId,
    rewrite = false,
  ) => {
    if (loading || !message) return;
    setLoading(true);
    setResearchEnded(false);
    setMessageAppeared(false);

    if (messages.length <= 1) {
      window.history.replaceState(null, '', `/c/${chatId}`);
    }

    messageId = messageId ?? crypto.randomBytes(7).toString('hex');
    const backendId = crypto.randomBytes(20).toString('hex');

    const newMessage: Message = {
      messageId,
      chatId: chatId!,
      backendId,
      query: message,
      responseBlocks: [],
      status: 'answering',
      createdAt: new Date(),
    };

    setMessages((prevMessages) => [...prevMessages, newMessage]);

    const attachmentsToSend = pendingAttachments;
    const attachmentsForMessage: Attachment[] = [];
    const visionResultsForMessage: import('@/lib/types/multimodal').VisionResult[] = [];

    if (attachmentsToSend.length > 0 && !rewrite) {
      try {
        for (const att of attachmentsToSend) {
          const fd = new FormData();
          fd.append('file', dataUrlToBlob(att));
          fd.append('prompt', message);
          const mmRes = await authFetch('/api/multimodal', {
            method: 'POST',
            body: fd,
          });
          if (mmRes.ok) {
            const mmData = await mmRes.json();
            if (mmData.attachment) attachmentsForMessage.push(mmData.attachment);
            if (mmData.vision) visionResultsForMessage.push(mmData.vision);
          }
        }
        if (attachmentsForMessage.length > 0) {
          newMessage.attachments = attachmentsForMessage;
          newMessage.visionResults = visionResultsForMessage;
          setMessages((prev) =>
            prev.map((m) =>
              m.messageId === newMessage.messageId
                ? {
                    ...m,
                    attachments: attachmentsForMessage,
                    visionResults: visionResultsForMessage,
                  }
                : m,
            ),
          );
        }
      } catch (err) {
        toast.error('Erreur analyse image');
      } finally {
        clearAttachments();
      }
    }

    const messageIndex = messages.findIndex((m) => m.messageId === messageId);

    const res = await authFetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        content: message,
        message: {
          messageId: messageId,
          chatId: chatId!,
          content: message,
        },
        chatId: chatId!,
        files: fileIds,
        sources: sources,
        optimizationMode: optimizationMode,
        history: rewrite
          ? truncateHistory(
              chatHistory.current.slice(
                0,
                messageIndex === -1 ? undefined : messageIndex,
              ),
            )
          : truncateHistory(chatHistory.current),
        chatModel: {
          key: chatModelProvider.key,
          providerId: chatModelProvider.providerId,
        },
        embeddingModel: {
          key: embeddingModelProvider.key,
          providerId: embeddingModelProvider.providerId,
        },
        systemInstructions: localStorage.getItem('systemInstructions'),
      }),
    });

    if (!res.body) throw new Error('No response body');

    const reader = res.body?.getReader();
    const decoder = new TextDecoder('utf-8');

    let partialChunk = '';

    const messageHandler = getMessageHandler(newMessage);

    // Wrap the raw reader in a timeout so a stalled backend does
    // not pin the UI forever.  See Bug #2 in
    // docs/bugs/2026-06-02-bokari-12-20-slowdown.md.
    const safeRead = withTimeout(
      (async function* () {
        while (true) {
          const { value, done } = await reader.read();
          if (done) return;
          yield value;
        }
      })(),
      {
        firstChunkMs: SSE_FIRST_CHUNK_MS,
        idleMs: SSE_IDLE_MS,
        label: 'sse/chat',
      },
    );

    try {
      for await (const value of safeRead) {
        partialChunk += decoder.decode(value, { stream: true });

        try {
          const messages = partialChunk.split('\n');
          for (const msg of messages) {
            if (!msg.trim()) continue;
            const json = JSON.parse(msg);
            messageHandler(json);
          }
          partialChunk = '';
        } catch (error) {
          console.warn('Incomplete JSON, waiting for next chunk...');
        }
      }
    } catch (err: any) {
      // Stream stalled.  Mark the message as errored so the UI
      // does not stay in the 'answering' state.  The user can
      // retry from the message actions.
      console.error('[Bokari] SSE stream stalled:', err?.message);
      try {
        await reader.cancel();
      } catch {
        /* noop */
      }
      throw err;
    }
  };

  return (
    <chatContext.Provider
      value={{
        messages,
        sections,
        chatHistory: chatHistory.current,
        files,
        fileIds,
        sources,
        chatId,
        hasError,
        isMessagesLoaded,
        isReady,
        loading,
        messageAppeared,
        notFound,
        optimizationMode,
        setFileIds,
        setFiles,
        setSources,
        setOptimizationMode,
        rewrite,
        sendMessage,
        setChatModelProvider,
        chatModelProvider,
        embeddingModelProvider,
        pendingAttachments,
        addAttachment,
        removeAttachment,
        clearAttachments,
        setEmbeddingModelProvider,
        researchEnded,
        setResearchEnded,
      }}
    >
      {children}
    </chatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(chatContext);
  return ctx;
};

function dataUrlToBlob(att: Attachment): Blob {
  const [meta, b64] = att.dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(meta)?.[1] ?? att.mimeType;
  const binary = atob(b64 ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
