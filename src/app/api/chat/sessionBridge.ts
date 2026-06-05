/**
 * @module app/api/chat/sessionBridge
 * @description Wire a SessionManager's events to the SSE writer.
 *
 * The search agent emits events through `SessionManager.emit(...)`.
 * This module subscribes once, converts each event to the SSE
 * JSON format the client expects, and writes it to the stream.
 *
 * Preserved event names (don't break the client protocol):
 *   open, block, updateBlock, researchComplete, analyzing,
 *   messageEnd, error.
 */
import { startTimer, logStage } from '@/lib/observability/latence';
import { recordTiming } from '@/lib/observability/ttfb';
import SessionManager from '@/lib/session';

type Writer = (line: string) => Promise<void>;

export type SessionBridge = {
  disconnect: () => void;
  onFirstBlock: () => void;
};

/**
 * Subscribe to the session and write each event to the stream.
 * Returns a `SessionBridge` with cleanup hooks.  `onFirstBlock`
 * is called exactly once — when the very first text/source
 * block hits the client.  This is the "TTFB on the server" stage.
 */
export const wireSessionToWriter = (
  session: SessionManager,
  safeWrite: Writer,
  onFirstBlock: () => void,
  onEnd?: (cache: boolean) => void | Promise<void>,
): SessionBridge => {
  let firstBlock = false;
  const disconnect = session.subscribe((event: string, data: any) => {
    void (async () => {
      if (event === 'data') {
        if (data.type === 'block') {
          if (!firstBlock) {
            firstBlock = true;
            const t = startTimer();
            const ms = t();
            logStage('chat.first_block', ms);
            recordTiming('chat.first_block', ms);
            onFirstBlock();
          }
          await safeWrite(JSON.stringify({ type: 'block', block: data.block }));
        } else if (data.type === 'updateBlock') {
          await safeWrite(
            JSON.stringify({
              type: 'updateBlock',
              blockId: data.blockId,
              patch: data.patch,
            }),
          );
        } else if (data.type === 'researchComplete') {
          await safeWrite(JSON.stringify({ type: 'researchComplete' }));
        }
      } else if (event === 'analyzing') {
        await safeWrite(
          JSON.stringify({
            type: 'analyzing',
            step: data.step,
            message: data.message,
          }),
        );
      } else if (event === 'end') {
        // Send the terminal event FIRST, while the stream is still open.
        // `onEnd` closes the writer (cache write → onClose → writer.close), so
        // writing messageEnd AFTER it hits the `closed` guard in safeWrite and
        // is silently DROPPED — leaving the client stuck "thinking" forever on
        // every live (non-cached) answer. messageEnd → THEN cache + close.
        await safeWrite(JSON.stringify({ type: 'messageEnd' }));
        if (onEnd) await onEnd(true);
        session.removeAllListeners();
      } else if (event === 'error') {
        // Emit the error AND close the stream (don't cache a broken answer,
        // don't leave the connection dangling).
        await safeWrite(JSON.stringify({ type: 'error', data: data.data }));
        if (onEnd) await onEnd(false);
        session.removeAllListeners();
      }
    })();
  });
  return { disconnect, onFirstBlock: () => undefined };
};
