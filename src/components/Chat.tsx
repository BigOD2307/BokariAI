'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import MessageInput from './MessageInput';
import MessageBox from './MessageBox';
import MessageBoxLoading from './MessageBoxLoading';
import { useChat } from '@/lib/hooks/useChat';
import { useAutoTitle } from '@/lib/hooks/useAutoTitle';

const Chat = () => {
  const { sections, loading, messageAppeared, messages, chatId } = useChat();
  const firstHuman = messages[0];
  useAutoTitle({
    chatId: chatId ?? null,
    firstMessage: firstHuman?.query ?? null,
    enabled: Boolean(chatId && firstHuman?.query && firstHuman.query.length >= 6),
  });

  const [dividerWidth, setDividerWidth] = useState(0);
  const dividerRef = useRef<HTMLDivElement | null>(null);
  const messageEnd = useRef<HTMLDivElement | null>(null);
  const lastScrolledRef = useRef<number>(0);
  // On mobile the composer is position:fixed, so the on-screen keyboard would
  // cover it. Track the visual viewport and lift the composer by the keyboard
  // height so it stays just above the keyboard. 0 on desktop / keyboard closed.
  const [kbInset, setKbInset] = useState(0);

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const onViewport = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKbInset(inset);
    };
    vv.addEventListener('resize', onViewport);
    vv.addEventListener('scroll', onViewport);
    onViewport();
    return () => {
      vv.removeEventListener('resize', onViewport);
      vv.removeEventListener('scroll', onViewport);
    };
  }, []);

  useEffect(() => {
    const updateDividerWidth = () => {
      if (dividerRef.current) {
        setDividerWidth(dividerRef.current.offsetWidth);
      }
    };

    updateDividerWidth();

    const resizeObserver = new ResizeObserver(() => {
      updateDividerWidth();
    });

    const currentRef = dividerRef.current;
    if (currentRef) {
      resizeObserver.observe(currentRef);
    }

    window.addEventListener('resize', updateDividerWidth);

    return () => {
      if (currentRef) {
        resizeObserver.unobserve(currentRef);
      }
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDividerWidth);
    };
  }, [sections.length]);

  useEffect(() => {
    const scroll = () => {
      messageEnd.current?.scrollIntoView({ behavior: 'auto' });
    };

    if (messages.length === 1) {
      document.title = `${messages[0].query.substring(0, 30)} - Bokari`;
    }

    if (sections.length > lastScrolledRef.current) {
      scroll();
      lastScrolledRef.current = sections.length;
    }
  }, [messages]);

  return (
    <div className="flex flex-col pt-6 pb-32 lg:pb-28 sm:mx-2 md:mx-4">
      {sections.map((section, i) => {
        const isLast = i === sections.length - 1;

        return (
          <Fragment key={section.message.messageId}>
            <MessageBox
              section={section}
              sectionIndex={i}
              dividerRef={isLast ? dividerRef : undefined}
              isLast={isLast}
            />
            {!isLast && (
              <div className="h-px w-full bg-black/[0.04] dark:bg-white/[0.04] my-6" />
            )}
          </Fragment>
        );
      })}
      {loading && !messageAppeared && <MessageBoxLoading />}
      <div ref={messageEnd} className="h-0" />
      {dividerWidth > 0 && (
        <div
          className="fixed z-40 bottom-3 lg:bottom-6"
          style={{
            width: dividerWidth,
            transform: kbInset > 0 ? `translateY(-${kbInset}px)` : undefined,
            transition: 'transform 0.15s ease-out',
          }}
        >
          {/* Fade gradient - light */}
          <div
            className="pointer-events-none absolute -bottom-6 left-0 right-0 h-[calc(100%+48px)] dark:hidden"
            style={{
              background:
                'linear-gradient(to top, #ffffff 0%, #ffffff 30%, rgba(255,255,255,0.97) 40%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.75) 65%, rgba(255,255,255,0.5) 78%, rgba(255,255,255,0.2) 90%, transparent 100%)',
            }}
          />
          {/* Fade gradient - dark */}
          <div
            className="pointer-events-none absolute -bottom-6 left-0 right-0 h-[calc(100%+48px)] hidden dark:block"
            style={{
              background:
                'linear-gradient(to top, #0a0a0a 0%, #0a0a0a 30%, rgba(10,10,10,0.97) 40%, rgba(10,10,10,0.9) 50%, rgba(10,10,10,0.75) 65%, rgba(10,10,10,0.5) 78%, rgba(10,10,10,0.2) 90%, transparent 100%)',
            }}
          />
          <MessageInput />
        </div>
      )}
    </div>
  );
};

export default Chat;
