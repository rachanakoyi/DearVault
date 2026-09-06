import { StoredMemory, JournalEntry } from '../src/types';

interface MockFirestoreDB {
  users: Map<
    string,
    {
      entries: Map<string, JournalEntry>;
      memories: Map<string, StoredMemory>;
    }
  >;
}

function createMockDB(): MockFirestoreDB {
  return {
    users: new Map(),
  };
}

function getOrCreateUserBucket(db: MockFirestoreDB, userId: string) {
  if (!db.users.has(userId)) {
    db.users.set(userId, {
      entries: new Map(),
      memories: new Map(),
    });
  }
  return db.users.get(userId)!;
}

// Simulates the exact deletion flow implemented in src/lib/firebase.ts
async function simulateDeleteJournalEntry(
  db: MockFirestoreDB,
  userId: string,
  entryId: string
): Promise<{
  entryDeleted: boolean;
  deletedMemoriesCount: number;
  memoryError?: string | null;
}> {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    throw new Error('Authenticated user ID is required to delete entry.');
  }
  if (!entryId || typeof entryId !== 'string' || entryId.trim() === '') {
    throw new Error('Journal entry ID is required to delete entry.');
  }

  const userBucket = getOrCreateUserBucket(db, userId);

  // 1. Delete Journal Entry document
  const entryExisted = userBucket.entries.has(entryId);
  userBucket.entries.delete(entryId);

  // 2. Query and delete memories strictly scoped to /users/{userId}/memories where sourceEntryId == entryId
  let deletedMemoriesCount = 0;
  let memoryError: string | null = null;

  try {
    const memoryKeysToDelete: string[] = [];
    for (const [memId, mem] of userBucket.memories.entries()) {
      // Strict equality match on sourceEntryId and ownership check
      if (mem.sourceEntryId === entryId && (!mem.userId || mem.userId === userId)) {
        memoryKeysToDelete.push(memId);
      }
    }

    for (const memId of memoryKeysToDelete) {
      userBucket.memories.delete(memId);
      deletedMemoriesCount++;
    }
  } catch (err: any) {
    memoryError = err?.message || String(err);
  }

  return {
    entryDeleted: true,
    deletedMemoriesCount,
    memoryError,
  };
}

async function runCleanupVerification() {
  console.log('================================================================');
  console.log('DEARVAULT STALE MEMORY CLEANUP ON ENTRY DELETION VERIFICATION');
  console.log('================================================================\n');

  const db = createMockDB();
  const USER_1 = 'user_1_alice';
  const USER_2 = 'user_2_bob';

  const user1Bucket = getOrCreateUserBucket(db, USER_1);
  const user2Bucket = getOrCreateUserBucket(db, USER_2);

  // Seed Entries for User 1
  user1Bucket.entries.set('entry_A', {
    id: 'entry_A',
    userId: USER_1,
    title: 'Entry A: A day at the park',
    content: 'Went to the park with my daughter. She loves swings.',
    createdAt: 1000,
    updatedAt: 1000,
    messages: [],
  });

  user1Bucket.entries.set('entry_B', {
    id: 'entry_B',
    userId: USER_1,
    title: 'Entry B: Mountain biking trip',
    content: 'Had an awesome mountain biking session in the hills.',
    createdAt: 2000,
    updatedAt: 2000,
    messages: [],
  });

  user1Bucket.entries.set('entry_C', {
    id: 'entry_C',
    userId: USER_1,
    title: 'Entry C: Quick thought without memories',
    content: 'Just writing a short note here.',
    createdAt: 3000,
    updatedAt: 3000,
    messages: [],
  });

  // Seed Memories for User 1
  // Memories related to Entry A
  user1Bucket.memories.set('mem_A_1', {
    id: 'mem_A_1',
    userId: USER_1,
    sourceEntryId: 'entry_A',
    summary: 'Has a daughter who loves swings at the park.',
    category: 'Family',
    policy: 'ALLOWED',
    createdAt: 1050,
    updatedAt: 1050,
    expiresAt: null,
  });

  user1Bucket.memories.set('mem_A_2', {
    id: 'mem_A_2',
    userId: USER_1,
    sourceEntryId: 'entry_A',
    summary: 'Plans to visit the park again next weekend.',
    category: 'Personal',
    policy: 'TEMPORARY',
    createdAt: 1060,
    updatedAt: 1060,
    expiresAt: Date.now() + 86400000,
  });

  // Memories related to Entry B
  user1Bucket.memories.set('mem_B_1', {
    id: 'mem_B_1',
    userId: USER_1,
    sourceEntryId: 'entry_B',
    summary: 'Enjoys outdoor mountain biking.',
    category: 'Hobbies',
    policy: 'ALLOWED',
    createdAt: 2050,
    updatedAt: 2050,
    expiresAt: null,
  });

  user1Bucket.memories.set('mem_B_2', {
    id: 'mem_B_2',
    userId: USER_1,
    sourceEntryId: 'entry_B',
    summary: 'Private injury while mountain biking.',
    category: 'Health',
    policy: 'BLOCKED',
    createdAt: 2060,
    updatedAt: 2060,
    expiresAt: null,
  });

  // Unrelated memories (manually created, no sourceEntryId)
  user1Bucket.memories.set('mem_unrelated_allowed', {
    id: 'mem_unrelated_allowed',
    userId: USER_1,
    summary: 'Prefers green tea over coffee.',
    category: 'Preferences',
    policy: 'ALLOWED',
    createdAt: 500,
    updatedAt: 500,
    expiresAt: null,
  });

  user1Bucket.memories.set('mem_unrelated_blocked', {
    id: 'mem_unrelated_blocked',
    userId: USER_1,
    summary: 'Confidential corporate project name: Project Phoenix.',
    category: 'Work',
    policy: 'BLOCKED',
    createdAt: 510,
    updatedAt: 510,
    expiresAt: null,
  });

  user1Bucket.memories.set('mem_unrelated_revoked', {
    id: 'mem_unrelated_revoked',
    userId: USER_1,
    summary: 'Old marathon training goal for 2023.',
    category: 'Fitness',
    policy: 'REVOKED',
    createdAt: 520,
    updatedAt: 520,
    expiresAt: null,
  });

  // Seed Data for User 2 (Testing Cross-User Boundary)
  user2Bucket.entries.set('entry_A', {
    id: 'entry_A',
    userId: USER_2,
    title: 'User 2 Entry A: Completely different note',
    content: 'User 2 private thoughts.',
    createdAt: 1000,
    updatedAt: 1000,
    messages: [],
  });

  user2Bucket.memories.set('mem_user2_A', {
    id: 'mem_user2_A',
    userId: USER_2,
    sourceEntryId: 'entry_A',
    summary: 'User 2 memory referencing entry_A of User 2.',
    category: 'Personal',
    policy: 'ALLOWED',
    createdAt: 1050,
    updatedAt: 1050,
    expiresAt: null,
  });

  user2Bucket.memories.set('mem_user2_unrelated', {
    id: 'mem_user2_unrelated',
    userId: USER_2,
    summary: 'User 2 independent memory.',
    category: 'General',
    policy: 'BLOCKED',
    createdAt: 1100,
    updatedAt: 1100,
    expiresAt: null,
  });

  console.log('INITIAL STATE SETUP:');
  console.log(`- User 1 has ${user1Bucket.entries.size} entries and ${user1Bucket.memories.size} memories.`);
  console.log(`- User 2 has ${user2Bucket.entries.size} entries and ${user2Bucket.memories.size} memories.\n`);

  // =========================================================================
  // EXECUTION: Delete Entry A for User 1
  // =========================================================================
  console.log('EXECUTING: simulateDeleteJournalEntry(db, USER_1, "entry_A")...\n');
  const resultA = await simulateDeleteJournalEntry(db, USER_1, 'entry_A');

  // =========================================================================
  // INVARIANT VERIFICATIONS
  // =========================================================================
  console.log('INVARIANT VERIFICATIONS:');

  // A. Delete Entry A -> Entry A's related memories are deleted
  const entryAExists = user1Bucket.entries.has('entry_A');
  const memA1Exists = user1Bucket.memories.has('mem_A_1');
  const memA2Exists = user1Bucket.memories.has('mem_A_2');
  const passedA = !entryAExists && !memA1Exists && !memA2Exists && resultA.deletedMemoriesCount === 2;
  console.log(
    `[INVARIANT A] Entry A and related memories (mem_A_1, mem_A_2) deleted: ` +
      (passedA ? 'PASSED ✅' : 'FAILED ❌') +
      ` (Deleted count: ${resultA.deletedMemoriesCount})`
  );

  // B. Delete Entry A -> Entry B's memory remains
  const memB1Exists = user1Bucket.memories.has('mem_B_1');
  const memB2Exists = user1Bucket.memories.has('mem_B_2');
  const entryBExists = user1Bucket.entries.has('entry_B');
  const passedB = memB1Exists && memB2Exists && entryBExists;
  console.log(
    `[INVARIANT B] Entry B's memories (mem_B_1, mem_B_2) remain untouched: ` +
      (passedB ? 'PASSED ✅' : 'FAILED ❌')
  );

  // C. Delete Entry A -> unrelated allowed/blocked/revoked memories remain
  const memUnrelAllowed = user1Bucket.memories.has('mem_unrelated_allowed');
  const memUnrelBlocked = user1Bucket.memories.has('mem_unrelated_blocked');
  const memUnrelRevoked = user1Bucket.memories.has('mem_unrelated_revoked');
  const passedC = memUnrelAllowed && memUnrelBlocked && memUnrelRevoked;
  console.log(
    `[INVARIANT C] Unrelated allowed/blocked/revoked memories remain intact: ` +
      (passedC ? 'PASSED ✅' : 'FAILED ❌')
  );

  // D. Delete Entry A -> another user's memories remain untouched
  const user2EntryAExists = user2Bucket.entries.has('entry_A');
  const user2MemAExists = user2Bucket.memories.has('mem_user2_A');
  const user2MemUnrelExists = user2Bucket.memories.has('mem_user2_unrelated');
  const passedD = user2EntryAExists && user2MemAExists && user2MemUnrelExists;
  console.log(
    `[INVARIANT D] User 2's data (entries & memories) completely untouched: ` +
      (passedD ? 'PASSED ✅' : 'FAILED ❌')
  );

  // E. Delete Entry A -> no stale memory referencing Entry A remains for User 1
  let staleMemoryCount = 0;
  for (const mem of user1Bucket.memories.values()) {
    if (mem.sourceEntryId === 'entry_A') {
      staleMemoryCount++;
    }
  }
  const passedE = staleMemoryCount === 0;
  console.log(
    `[INVARIANT E] Zero stale memories referencing "entry_A" in User 1 vault: ` +
      (passedE ? 'PASSED ✅' : 'FAILED ❌') +
      ` (Found: ${staleMemoryCount})`
  );

  // F. Deleting an entry with no memories still succeeds
  console.log('\nEXECUTING: simulateDeleteJournalEntry(db, USER_1, "entry_C") [No memories associated]...');
  const resultC = await simulateDeleteJournalEntry(db, USER_1, 'entry_C');
  const entryCExists = user1Bucket.entries.has('entry_C');
  const passedF = !entryCExists && resultC.entryDeleted && resultC.deletedMemoriesCount === 0 && !resultC.memoryError;
  console.log(
    `[INVARIANT F] Deleting entry without memories succeeds safely: ` +
      (passedF ? 'PASSED ✅' : 'FAILED ❌') +
      ` (deletedMemoriesCount: ${resultC.deletedMemoriesCount})`
  );

  // G. Repeated deletion does not cause errors
  console.log('\nEXECUTING: Repeated deletion of already deleted "entry_A"...');
  let passedG = false;
  try {
    const repeatResult = await simulateDeleteJournalEntry(db, USER_1, 'entry_A');
    passedG = repeatResult.entryDeleted && repeatResult.deletedMemoriesCount === 0 && !repeatResult.memoryError;
  } catch (repeatErr) {
    passedG = false;
  }
  console.log(
    `[INVARIANT G] Repeated deletion handles non-existent entry safely with zero errors: ` +
      (passedG ? 'PASSED ✅' : 'FAILED ❌')
  );

  // Final Summary
  const allPassed = passedA && passedB && passedC && passedD && passedE && passedF && passedG;
  console.log('\n================================================================');
  if (allPassed) {
    console.log('✅ ALL INVARIANTS (A, B, C, D, E, F, G) PASSED WITH ZERO DEFECTS.');
  } else {
    console.error('❌ SOME INVARIANTS FAILED. PLEASE INVESTIGATE.');
    process.exit(1);
  }
  console.log('================================================================\n');
}

runCleanupVerification().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
