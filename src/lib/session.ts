import { EventEmitter } from 'stream';
import { applyPatch } from 'rfc6902';
import { Block } from './types';

const sessions =
  (global as any)._sessionManagerSessions || new Map<string, SessionManager>();
if (process.env.NODE_ENV !== 'production') {
  (global as any)._sessionManagerSessions = sessions;
}

/** Cap on the number of events we keep in the per-session buffer.
 *  The buffer is used to replay history to *new* subscribers (e.g. a
 *  reconnect from the browser).  Unbounded growth was a memory leak
 *  for deep-search sessions that emit 100+ block events.  The cap
 *  is intentionally generous — a reconnect within the first 50
 *  events will see the full stream; later reconnects see a truncated
 *  stream (the message in the DB is the source of truth). */
const MAX_SESSION_EVENTS = 50;

class SessionManager {
  private static sessions: Map<string, SessionManager> = sessions;
  readonly id: string;
  private blocks = new Map<string, Block>();
  private events: { event: string; data: any }[] = [];
  private emitter = new EventEmitter();
  private TTL_MS = 30 * 60 * 1000;

  constructor(id?: string) {
    this.id = id ?? crypto.randomUUID();

    setTimeout(() => {
      SessionManager.sessions.delete(this.id);
    }, this.TTL_MS);
  }

  static getSession(id: string): SessionManager | undefined {
    return this.sessions.get(id);
  }

  static getAllSessions(): SessionManager[] {
    return Array.from(this.sessions.values());
  }

  static createSession(): SessionManager {
    const session = new SessionManager();
    this.sessions.set(session.id, session);
    return session;
  }

  removeAllListeners() {
    this.emitter.removeAllListeners();
  }

  emit(event: string, data: any) {
    this.emitter.emit(event, data);
    this.events.push({ event, data });
    // FIFO cap — drop the oldest event when we exceed the limit.
    // 'end' and 'error' are never trimmed (they're at the end of
    // the stream and a late subscriber needs to see them).
    if (this.events.length > MAX_SESSION_EVENTS) {
      // Find the first non-terminal event to drop.
      const dropIdx = this.events.findIndex(
        (e) => e.event !== 'end' && e.event !== 'error',
      );
      if (dropIdx !== -1) {
        this.events.splice(dropIdx, 1);
      } else {
        // All remaining events are terminal — just drop the oldest.
        this.events.shift();
      }
    }
  }

  emitBlock(block: Block) {
    this.blocks.set(block.id, block);
    this.emit('data', {
      type: 'block',
      block: block,
    });
  }

  getBlock(blockId: string): Block | undefined {
    return this.blocks.get(blockId);
  }

  updateBlock(blockId: string, patch: any[]) {
    const block = this.blocks.get(blockId);

    if (block) {
      applyPatch(block, patch);
      this.blocks.set(blockId, block);
      this.emit('data', {
        type: 'updateBlock',
        blockId: blockId,
        patch: patch,
      });
    }
  }

  getAllBlocks() {
    return Array.from(this.blocks.values());
  }

  subscribe(listener: (event: string, data: any) => void): () => void {
    const currentEventsLength = this.events.length;

    const handler = (event: string) => (data: any) => listener(event, data);
    const dataHandler = handler('data');
    const endHandler = handler('end');
    const errorHandler = handler('error');

    this.emitter.on('data', dataHandler);
    this.emitter.on('end', endHandler);
    this.emitter.on('error', errorHandler);

    for (let i = 0; i < currentEventsLength; i++) {
      const { event, data } = this.events[i];
      listener(event, data);
    }

    return () => {
      this.emitter.off('data', dataHandler);
      this.emitter.off('end', endHandler);
      this.emitter.off('error', errorHandler);
    };
  }
}

export default SessionManager;
