import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import { JournalEntry, InteractionMessage, StoredMemory } from "../types";

// Initialize Firebase App
const app: FirebaseApp = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApps()[0];

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account",
});

// Initialize Firestore with databaseId support and undefined property sanitization
export const db: Firestore = firebaseConfig.firestoreDatabaseId
  ? initializeFirestore(app, { ignoreUndefinedProperties: true }, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Zero-crash payload sanitizer stripping all undefined values
export function sanitizePayload<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_key, value) => (value === undefined ? null : value))
  );
}

// Auth Helpers
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Firebase Google sign-in failed:", error);
    throw error;
  }
}

export async function logOut(): Promise<void> {
  await fbSignOut(auth);
}

// Firestore operations isolated strictly to current authenticated user
export function getUserEntriesRef(userId: string) {
  return collection(db, "users", userId, "entries");
}

export function getUserEntryDocRef(userId: string, entryId: string) {
  return doc(db, "users", userId, "entries", entryId);
}

export function getUserInteractionsRef(userId: string) {
  return collection(db, "users", userId, "interactions");
}

export function getUserInteractionDocRef(userId: string, interactionId: string) {
  return doc(db, "users", userId, "interactions", interactionId);
}

// Save or Update Journal Entry with guaranteed undefined-stripping
export async function saveJournalEntry(
  userId: string,
  entry: Partial<JournalEntry> & { id: string }
): Promise<void> {
  if (!userId) throw new Error("Authenticated user ID is required to save entry.");
  const docRef = getUserEntryDocRef(userId, entry.id);
  const sanitized = sanitizePayload({
    ...entry,
    userId,
    updatedAt: Date.now(),
  });
  await setDoc(docRef, sanitized, { merge: true });

  // Also log to interactions collection for audit & multi-surface retrieval
  if (entry.messages && entry.messages.length > 0) {
    const latestMessage = entry.messages[entry.messages.length - 1];
    const interactionRef = getUserInteractionDocRef(userId, `${entry.id}_${latestMessage.id}`);
    await setDoc(
      interactionRef,
      sanitizePayload({
        entryId: entry.id,
        entryTitle: entry.title || "Untitled Entry",
        interactionId: latestMessage.id,
        role: latestMessage.role,
        text: latestMessage.text,
        mode: latestMessage.mode || "reflect",
        modelUsed: latestMessage.modelUsed || null,
        timestamp: latestMessage.timestamp || Date.now(),
        serverTimestamp: serverTimestamp(),
      }),
      { merge: true }
    );
  }
}

// Delete Journal Entry and its associated memories safely
export interface DeleteJournalEntryResult {
  entryDeleted: boolean;
  deletedMemoriesCount: number;
  memoryError?: string | null;
}

/**
 * Deletes all memories associated with a specific journal entry for the authenticated user.
 * Strictly scoped to /users/{userId}/memories where sourceEntryId == entryId.
 * Never touches memories belonging to other entries or other users.
 */
export async function deleteUserMemoriesByEntryId(
  userId: string,
  entryId: string
): Promise<{ deletedCount: number }> {
  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    throw new Error("Authenticated user ID is required to clean up memories.");
  }
  if (!entryId || typeof entryId !== "string" || entryId.trim() === "") {
    throw new Error("Journal entry ID is required to clean up memories.");
  }

  const memoriesRef = getUserMemoriesRef(userId);
  const q = query(memoriesRef, where("sourceEntryId", "==", entryId));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return { deletedCount: 0 };
  }

  let deletedCount = 0;
  // Safety filter: ensure document belongs strictly to this user and sourceEntryId matches
  const targetDocs = snapshot.docs.filter((docSnap) => {
    const data = docSnap.data();
    return data && data.sourceEntryId === entryId && (!data.userId || data.userId === userId);
  });

  const chunkSize = 400;
  for (let i = 0; i < targetDocs.length; i += chunkSize) {
    const chunk = targetDocs.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const docSnap of chunk) {
      batch.delete(docSnap.ref);
      deletedCount++;
    }
    await batch.commit();
  }

  return { deletedCount };
}

// Delete Journal Entry
export async function deleteJournalEntry(
  userId: string,
  entryId: string
): Promise<DeleteJournalEntryResult> {
  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    throw new Error("Authenticated user ID is required to delete entry.");
  }
  if (!entryId || typeof entryId !== "string" || entryId.trim() === "") {
    throw new Error("Journal entry ID is required to delete entry.");
  }

  // 1. Delete Journal Entry document first
  const docRef = getUserEntryDocRef(userId, entryId);
  await deleteDoc(docRef);

  // 2. Safely clean up memories associated with this entry
  let deletedMemoriesCount = 0;
  let memoryError: string | null = null;
  try {
    const cleanupResult = await deleteUserMemoriesByEntryId(userId, entryId);
    deletedMemoriesCount = cleanupResult.deletedCount;
    if (deletedMemoriesCount > 0) {
      console.log(
        `[Memory Cleanup] Successfully deleted ${deletedMemoriesCount} memories associated with entry "${entryId}" for user "${userId}".`
      );
    }
  } catch (memErr: any) {
    memoryError = memErr?.message || String(memErr);
    console.error(
      `[Memory Cleanup Failure] Journal entry "${entryId}" was deleted, but failed to delete associated memories:`,
      memErr
    );
  }

  return {
    entryDeleted: true,
    deletedMemoriesCount,
    memoryError,
  };
}

// Real-time subscription to user's journal entries
export function subscribeToUserEntries(
  userId: string,
  callback: (entries: JournalEntry[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const entriesRef = getUserEntriesRef(userId);
  const q = query(entriesRef, orderBy("updatedAt", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: JournalEntry[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as JournalEntry;
        items.push({
          ...data,
          id: doc.id,
        });
      });
      callback(items);
    },
    (err) => {
      console.error("Firestore entries subscription error:", err);
      if (onError) onError(err);
    }
  );
}

// Memory Firewall: Firestore paths strictly scoped to /users/{userId}/memories/{memoryId}
export function getUserMemoriesRef(userId: string) {
  return collection(db, "users", userId, "memories");
}

export function getUserMemoryDocRef(userId: string, memoryId: string) {
  return doc(db, "users", userId, "memories", memoryId);
}

export async function saveUserMemory(
  userId: string,
  memory: Partial<StoredMemory> & { id: string }
): Promise<void> {
  if (!userId) throw new Error("Authenticated user ID is required to manage memories.");
  const docRef = getUserMemoryDocRef(userId, memory.id);
  const sanitized = sanitizePayload({
    ...memory,
    userId,
    updatedAt: Date.now(),
  });
  await setDoc(docRef, sanitized, { merge: true });
}

export async function deleteUserMemory(userId: string, memoryId: string): Promise<void> {
  if (!userId) throw new Error("Authenticated user ID is required to delete memory.");
  const docRef = getUserMemoryDocRef(userId, memoryId);
  await deleteDoc(docRef);
}

export function subscribeToUserMemories(
  userId: string,
  callback: (memories: StoredMemory[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!userId) {
    callback([]);
    return () => {};
  }

  const memoriesRef = getUserMemoriesRef(userId);
  const q = query(memoriesRef, orderBy("updatedAt", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: StoredMemory[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as StoredMemory;
        items.push({
          ...data,
          id: doc.id,
        });
      });
      callback(items);
    },
    (err) => {
      console.error("Firestore memories subscription error:", err);
      if (onError) onError(err);
    }
  );
}

export { onAuthStateChanged };
