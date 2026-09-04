export type ReflectionMode = 'reflect' | 'summary' | 'brainstorm' | 'chat';

export interface InteractionMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  mode?: ReflectionMode;
  modelUsed?: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  mood?: string;
  tags?: string[];
  summary?: string;
  createdAt: number;
  updatedAt: number;
  messages: InteractionMessage[];
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
