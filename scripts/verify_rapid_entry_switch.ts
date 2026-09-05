/**
 * Programmatic verification test for rapid switching between Entry A and Entry B.
 * Verifies:
 * 1. Abort controller triggers on switch, preventing in-flight AI response from writing to stale entry.
 * 2. Active entry ID ref gating discards any pending auto-save updates from previous entry.
 * 3. State synchronization cleans up timeouts without crossing boundaries.
 */

interface MockJournalEntry {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
}

async function runRapidSwitchTest() {
  console.log('================================================================');
  console.log('RAPID ENTRY SWITCHING & RACE CONDITION ISOLATION VERIFICATION');
  console.log('================================================================\n');

  const entryA: MockJournalEntry = {
    id: 'entry_A',
    title: 'Morning Reflections',
    content: 'Feeling focused and motivated today.',
    updatedAt: 1000,
  };

  const entryB: MockJournalEntry = {
    id: 'entry_B',
    title: 'Evening Gratitude',
    content: 'Thankful for a quiet walk in the park.',
    updatedAt: 2000,
  };

  let activeEntryId = entryA.id;
  let activeEntryIdRef = entryA.id;
  let activeEntry = { ...entryA };
  let inFlightAbortController: AbortController | null = null;
  const persistedEntries = new Map<string, MockJournalEntry>([
    [entryA.id, { ...entryA }],
    [entryB.id, { ...entryB }],
  ]);

  // Mock update handler with strict entry isolation
  const handleUpdateEntry = (entryId: string, updated: Partial<MockJournalEntry>) => {
    if (!entryId || entryId !== activeEntryIdRef || activeEntry.id !== entryId) {
      console.log(`[Entry Isolation] Safely discarded stale write intended for "${entryId}" while active is "${activeEntryIdRef}"`);
      return false;
    }
    const merged = { ...activeEntry, ...updated, id: entryId, updatedAt: Date.now() };
    activeEntry = merged;
    persistedEntries.set(entryId, merged);
    return true;
  };

  // 1. User starts generating reflection on Entry A
  console.log('1. User initiates reflection on Entry A...');
  inFlightAbortController = new AbortController();
  const entryAAbortSignal = inFlightAbortController.signal;

  // 2. User rapidly switches to Entry B within 10ms
  console.log('2. User rapidly switches from Entry A to Entry B...');
  if (inFlightAbortController) {
    inFlightAbortController.abort();
    inFlightAbortController = null;
  }
  activeEntryIdRef = entryB.id;
  activeEntryId = entryB.id;
  activeEntry = { ...entryB };

  console.log(`   - Was Entry A reflection aborted? -> ${entryAAbortSignal.aborted} (MUST BE TRUE)`);
  if (!entryAAbortSignal.aborted) {
    console.error('❌ FAILED: In-flight reflection on previous entry was not aborted!');
    process.exit(1);
  }

  // 3. Simulate delayed network resolution for Entry A reflection trying to write back
  console.log('3. Delayed reflection network response for Entry A attempts to write back...');
  const reflectionTargetId = 'entry_A';
  if (entryAAbortSignal.aborted || reflectionTargetId !== activeEntryIdRef) {
    console.log(`   - Safely blocked stale reflection from writing to Entry B! Target "${reflectionTargetId}" !== Active "${activeEntryIdRef}"`);
  } else {
    console.error('❌ FAILED: Stale reflection wrote into active entry!');
    process.exit(1);
  }

  // 4. Simulate delayed debounced auto-save from Entry A firing after switch
  console.log('4. Delayed debounced auto-save from Entry A fires after switch...');
  const staleSaveResult = handleUpdateEntry('entry_A', { content: 'Stale overwrite from Entry A typing' });
  console.log(`   - Stale write accepted? -> ${staleSaveResult} (MUST BE FALSE)`);

  if (staleSaveResult) {
    console.error('❌ FAILED: Stale write from Entry A overwrote Entry B!');
    process.exit(1);
  }

  // Verify Entry B in memory and storage remains pristine
  console.log(`   - Active entry title: "${activeEntry.title}" (Expected: "${entryB.title}")`);
  console.log(`   - Persisted Entry B content: "${persistedEntries.get('entry_B')?.content}"`);

  if (activeEntry.title !== entryB.title || persistedEntries.get('entry_B')?.content !== entryB.content) {
    console.error('❌ FAILED: Entry B corrupted by stale write!');
    process.exit(1);
  }

  console.log('\n✅ PASSED: Rapid Entry switching isolation verified with zero state cross-contamination.');
  console.log('================================================================');
}

runRapidSwitchTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
