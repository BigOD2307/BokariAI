import { describe, it, expect } from 'vitest';
import SessionManager from '@/lib/session';

describe('SessionManager', () => {
  it('creates sessions with a random id', () => {
    const s = SessionManager.createSession();
    expect(s.id).toBeTruthy();
    expect(typeof s.id).toBe('string');
  });

  it('retrieves a session by id', () => {
    const s = SessionManager.createSession();
    const found = SessionManager.getSession(s.id);
    expect(found).toBe(s);
  });

  it('emit() and subscribe() delivers data events to a listener', () => {
    const s = SessionManager.createSession();
    const received: any[] = [];
    s.subscribe((event, data) => {
      if (event === 'data') received.push(data);
    });
    s.emit('data', { type: 'block', block: { id: 'a' } });
    s.emit('data', { type: 'block', block: { id: 'b' } });
    expect(received).toEqual([
      { type: 'block', block: { id: 'a' } },
      { type: 'block', block: { id: 'b' } },
    ]);
  });

  it('replays past events to a late subscriber', () => {
    const s = SessionManager.createSession();
    s.emit('data', { type: 'block', block: { id: 'a' } });
    s.emit('data', { type: 'block', block: { id: 'b' } });
    const received: any[] = [];
    s.subscribe((event, data) => {
      if (event === 'data') received.push(data);
    });
    expect(received).toEqual([
      { type: 'block', block: { id: 'a' } },
      { type: 'block', block: { id: 'b' } },
    ]);
  });

  it('caps the event buffer (FIFO) to keep memory bounded', () => {
    const s = SessionManager.createSession();
    for (let i = 0; i < 200; i++) {
      s.emit('data', { type: 'block', block: { id: `b${i}` } });
    }
    // We rely on the implementation detail that the events array
    // is exposed via `getAllBlocks` and via replay — check that
    // a late subscriber does NOT receive all 200 blocks.
    const received: any[] = [];
    s.subscribe((event, data) => {
      if (event === 'data') received.push(data);
    });
    expect(received.length).toBeLessThan(200);
    expect(received.length).toBeGreaterThan(0);
    // The first replayed event should be a recent one, not b0.
    expect(received[0].block.id).not.toBe('b0');
  });

  it('never trims the trailing end/error event from the buffer', () => {
    const s = SessionManager.createSession();
    for (let i = 0; i < 200; i++) {
      s.emit('data', { type: 'block', block: { id: `b${i}` } });
    }
    s.emit('end', {});
    // Subscribe AFTER end — the replay should still include the
    // end event so the client knows the stream terminated.
    const received: string[] = [];
    s.subscribe((event) => {
      received.push(event);
    });
    expect(received).toContain('end');
  });

  it('removeAllListeners stops delivery to existing subscribers', () => {
    const s = SessionManager.createSession();
    const received: any[] = [];
    s.subscribe((event) => {
      if (event === 'data') received.push(event);
    });
    s.emit('data', { type: 'block', block: { id: 'a' } });
    s.removeAllListeners();
    s.emit('data', { type: 'block', block: { id: 'b' } });
    expect(received).toHaveLength(1);
  });

  it('emitBlock + updateBlock mutates the block state', () => {
    const s = SessionManager.createSession();
    s.emitBlock({ id: 'x', type: 'text', data: 'hello' });
    s.updateBlock('x', [{ op: 'replace', path: '/data', value: 'hello world' }]);
    const blk = s.getBlock('x') as any;
    expect(blk.data).toBe('hello world');
  });
});
