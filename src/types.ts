export type ReflectionMode = 'reflect' | 'summary' | 'brainstorm' | 'chat';

export type MemoryPolicy = 'ALLOWED' | 'TEMPORARY' | 'BLOCKED' | 'REVOKED';

export interface InfluencedByItem {
  memoryId: string;
  category: string;
  summary: string;
}

export interface StoredMemory {
  id: string;
  userId: string;
  summary: string;
  category: string;
  policy: MemoryPolicy;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number | null;
  sourceEntryId?: string;
}

export interface MemorySuggestion {
  summary: string;
  category: string;
}

export interface InteractionMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  mode?: ReflectionMode;
  modelUsed?: string;
  influencedBy?: InfluencedByItem[];
  redactionApplied?: boolean;
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
