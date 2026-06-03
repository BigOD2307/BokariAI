import { ArrowRight, Mic, Loader2, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import Optimization from './MessageInputActions/Optimization';
import Attach from './MessageInputActions/Attach';
import MultimodalButton from './MessageInput/MultimodalButton';
import AttachmentPreview from './MessageInput/AttachmentPreview';
import { useChat } from '@/lib/hooks/useChat';
import { useElevenLabsSTT } from '@/lib/hooks/useElevenLabsSTT';
import { useAuth } from '@/lib/hooks/useAuth';

const EmptyChatMessageInput = () => {
  const {
    sendMessage,
    pendingAttachments,
    addAttachment,
    removeAttachment,
  } = useChat();
  const { isRecording, isTranscribing, startRecording, stopRecording } = useElevenLabsSTT();
  const { requireAuth } = useAuth();

  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.hasAttribute('contenteditable');

      if (e.key === '/' && !isInputFocused) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    inputRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleMicClick = async () => {
    if (isRecording) {
      const text = await stopRecording();
      if (text) {
        setMessage((prev) => (prev ? prev + ' ' + text : text));
        inputRef.current?.focus();
      }
    } else {
      await startRecording();
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (message.trim().length === 0) return;
        if (!requireAuth()) return;
        sendMessage(message);
        setMessage('');
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (message.trim().length === 0) return;
          if (!requireAuth()) return;
          sendMessage(message);
          setMessage('');
        }
      }}
      className="w-full"
    >
      <div
        className={`w-full bg-white dark:bg-dark-200 rounded-2xl flex flex-col transition-all duration-300 border ${
          isFocused
            ? 'border-bokari-500/30 dark:border-bokari-500/25 shadow-elevated shadow-bokari-500/[0.04]'
            : 'border-black/[0.08] dark:border-white/[0.08] shadow-medium'
        }`}
      >
        {/* Textarea */}
        <div className="px-5 pt-4 pb-2">
          <TextareaAutosize
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            minRows={1}
            maxRows={8}
            className="w-full bg-transparent text-black/90 dark:text-white/90 placeholder-black/30 dark:placeholder-white/25 text-[15px] outline-none resize-none leading-relaxed"
            placeholder="Rechercher n'importe quel sujet..."
          />
        </div>

        {/* Attachment previews */}
        {pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-5 pb-2">
            {pendingAttachments.map((att) => (
              <AttachmentPreview
                key={att.id}
                attachment={att}
                onRemove={() => removeAttachment(att.id)}
              />
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 pb-3">
          {/* Left tools */}
          <div className="flex items-center gap-0.5">
            <Optimization />
            <Attach />
            <MultimodalButton onAttach={addAttachment} />
          </div>

          {/* Right tools */}
          <div className="flex items-center gap-1.5">
            {/* Microphone */}
            <button
              type="button"
              onClick={handleMicClick}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 ${
                isRecording
                  ? 'bg-red-500/10 text-red-500 animate-pulse'
                  : isTranscribing
                    ? 'bg-bokari-500/10 text-bokari-500'
                    : 'text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/50 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
              }`}
              title={isRecording ? 'Arreter' : isTranscribing ? 'Transcription...' : 'Dicter'}
            >
              {isTranscribing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Mic size={16} />
              )}
            </button>

            {/* Submit */}
            <button
              disabled={message.trim().length === 0}
              className="h-8 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all duration-200 disabled:bg-black/[0.04] dark:disabled:bg-white/[0.04] disabled:text-black/20 dark:disabled:text-white/15 disabled:cursor-not-allowed bg-bokari-500 text-white hover:bg-bokari-600 shadow-sm hover:shadow-md"
            >
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default EmptyChatMessageInput;
