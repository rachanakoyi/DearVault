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
  serverTimestamp,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import { JournalEntry, InteractionMessage } from "../types";

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

// Delete Journal Entry
export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  if (!userId) throw new Error("Authenticated user ID is required to delete entry.");
  const docRef = getUserEntryDocRef(userId, entryId);
  await deleteDoc(docRef);
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

export { onAuthStateChanged };
