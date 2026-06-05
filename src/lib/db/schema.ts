import { sql } from 'drizzle-orm';
import { text, integer, real, sqliteTable } from 'drizzle-orm/sqlite-core';
import { Block } from '../types';
import { SearchSources } from '../agents/search/types';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('passwordHash').notNull(),
  createdAt: text('createdAt').notNull(),
  plan: text('plan').default('free'),
  questionsToday: integer('questionsToday').default(0),
  lastQuestionDate: text('lastQuestionDate'),
  phoneWhatsapp: text('phoneWhatsapp'),
  phoneVerifiedAt: text('phoneVerifiedAt'),
  authProvider: text('authProvider', { enum: ['email', 'whatsapp'] }).default('email'),
});

export const phoneOtps = sqliteTable('phone_otps', {
  phone: text('phone').primaryKey(),
  codeHash: text('codeHash').notNull(),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: text('expiresAt').notNull(),
  lastSentAt: text('lastSentAt').notNull(),
  verifiedAt: text('verifiedAt'),
  createdAt: text('createdAt').notNull(),
});

export const guestSessions = sqliteTable('guest_sessions', {
  id: text('id').primaryKey(),
  queriesCount: integer('queriesCount').notNull().default(0),
  lastResetAt: text('lastResetAt').notNull(),
  createdAt: text('createdAt').notNull(),
});

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey(),
  messageId: text('messageId').notNull(),
  chatId: text('chatId').notNull(),
  backendId: text('backendId').notNull(),
  query: text('query').notNull(),
  createdAt: text('createdAt').notNull(),
  responseBlocks: text('responseBlocks', { mode: 'json' })
    .$type<Block[]>()
    .default(sql`'[]'`),
  status: text({ enum: ['answering', 'completed', 'error'] }).default(
    'answering',
  ),
});

interface DBFile {
  name: string;
  fileId: string;
}

export const chats = sqliteTable('chats', {
  id: text('id').primaryKey(),
  userId: text('userId'),
  title: text('title').notNull(),
  createdAt: text('createdAt').notNull(),
  sources: text('sources', {
    mode: 'json',
  })
    .$type<SearchSources[]>()
    .default(sql`'[]'`),
  files: text('files', { mode: 'json' })
    .$type<DBFile[]>()
    .default(sql`'[]'`),
});

export const flashcardDecks = sqliteTable('flashcard_decks', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  sourceQuery: text('sourceQuery').notNull(),
  subject: text('subject'),
  createdAt: text('createdAt').notNull(),
});

export const flashcards = sqliteTable('flashcards', {
  id: text('id').primaryKey(),
  deckId: text('deckId').notNull().references(() => flashcardDecks.id, { onDelete: 'cascade' }),
  front: text('front').notNull(),
  back: text('back').notNull(),
  easeFactor: real('easeFactor').notNull().default(2.5),
  interval: integer('interval').notNull().default(0),
  repetitions: integer('repetitions').notNull().default(0),
  dueAt: text('dueAt').notNull(),
  lastReviewedAt: text(),
});

