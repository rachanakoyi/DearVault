# DearVault — User-Authenticated AI Journal & Reflection Studio

DearVault is a full-stack, user-authenticated journaling and personal reflection studio powered by the **Gemini 3.6 Flash API**, **Firebase Authentication (Google Sign-In)**, and **Cloud Firestore**. Every interaction, journal entry, and multi-turn AI reflection is strictly isolated per authenticated user using owner-bound Firestore security rules.

---

## 1. Architectural Threat Model (5 Threat Zones)

| Threat Zone | Specific Risk Vectors | Enforced Mitigation & Countermeasures |
| :--- | :--- | :--- |
| **1. Input Surfaces** | Malicious prompt injection, payload tampering, oversized bodies | Strict Express body limits (`4mb`), typed interfaces, defensive payload ingestion, input sanitization before rendering. |
| **2. Planning & Reasoning** | System prompt bypass, persona hijacking, hallucinatory answers | Explicit system instructions, separated user context roles, temperature bounds (0.65 - 0.85). |
| **3. Tool Execution & APIs** | API key exfiltration, SSRF, client-side token exposure | Gemini API key is accessed exclusively server-side (`process.env.GEMINI_API_KEY`) via Express proxy. Automated 4-tier model fallback ladder (`gemini-3.6-flash` -> `gemini-3.1-flash-lite` -> `gemini-flash-latest` -> `gemini-3.7-flash`). |
| **4. Memory & State** | Cross-tenant data leakage, unauthenticated document reads, undefined-value crashes | Owner-bound Firestore Security Rules (`request.auth.uid == userId`). Strict `undefined`-stripping utility before every database write. |
| **5. Inter-System Comm** | Session hijacking, insecure credential transport, OAuth spoofing | Google Sign-In via Firebase Auth (Federated OAuth), zero plaintext password storage, secure HTTPS transport. |

---

## 2. Prerequisites & Environment Setup

### 2.1 Required Google Cloud APIs
Enable the required services in your Google Cloud Project:
```bash
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  aiplatform.googleapis.com
```

### 2.2 Local Environment Variables
Create a `.env` file (see `.env.example`):
```env
GEMINI_API_KEY="your-gemini-api-key"
PORT=3000
```

---

## 3. Secret Management Configuration

Store your Gemini API key in Google Cloud Secret Manager and grant access to the Cloud Run runtime service account:

```bash
# 1. Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 2. Grant the default Cloud Run service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 4. Cloud Firestore Security Configuration

Deploy the owner-bound security rules to enforce authenticated user isolation:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      match /interactions/{interactionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      match /entries/{entryId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      // Strict owner-bound memory firewall isolation
      match /memories/{memoryId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /{allSubcollections=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

To deploy rules via Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 5. Google Cloud Run Deployment Flow

Build and deploy the application container to Cloud Run:

```bash
# Deploy to Google Cloud Run with Secret Manager binding
gcloud run deploy dearvault-app \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --port 3000
```

### Mandatory Campaign Labeling
Register the service for automated challenge verification:
```bash
gcloud run services update dearvault-app \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 6. Functional Verification & Complete QA Test Walkthrough

Every user interaction, security firewall boundary, and background process is broken down into structured, testable cases that can be directly converted into automated test scripts.

### Test Suite 1: Authentication & Session Integrity
- **TC-1.1: Unauthenticated Visitor Redirection & Value Showcase**
  - *Action*: Navigate to `/` without active session credentials.
  - *Expected*: Unauthenticated landing view renders instantly. Navigation shows `#nav-signin-btn` and `#hero-signin-btn`. No private Firestore queries or user states are initialized.
- **TC-1.2: Federated Google Sign-In via Firebase Auth**
  - *Action*: Click `#hero-signin-btn`. Complete standard Google OAuth popup flow.
  - *Expected*: Firebase Auth listener verifies user token. Dashboard view mounts displaying authenticated user's name and avatar. No plaintext credentials are stored or handled by application code.
- **TC-1.3: Session Preservation Across Page Reloads**
  - *Action*: Refresh the browser window (`F5` / `Cmd+R`) while logged in.
  - *Expected*: `onAuthStateChanged` hook restores session state without flashing unauthenticated screens; real-time Firestore listeners re-bind to the authenticated UID.
- **TC-1.4: Safe Session Sign-Out**
  - *Action*: Click `#signout-btn` in header.
  - *Expected*: Session terminates via `fbSignOut(auth)`. Active journal entries, in-memory firewall state, and chat threads are cleared from client state; UI reverts cleanly to landing view.

### Test Suite 2: Journal CRUD & Real-Time Persistence
- **TC-2.1: Blank Entry Initialization**
  - *Action*: Click `#new-entry-btn` in the history sidebar.
  - *Expected*: A unique `id` is generated (`entry_<timestamp>_<rand>`); editor displays empty title, empty content, default "Calm" mood, and zero tags; sidebar entry highlights as active.
- **TC-2.2: Debounced Real-Time Auto-Save**
  - *Action*: Type title into `#journal-title-input` and reflection narrative into `#journal-content-textarea`.
  - *Expected*: After 650ms of typing inactivity, auto-save triggers; status indicator displays "Saving to Firestore..." and resolves to "Saved to Firestore"; payload is sanitized with `undefined`-stripping.
- **TC-2.3: Manual Explicit Save Trigger**
  - *Action*: Click `#explicit-save-btn` in editor header.
  - *Expected*: Immediate Firestore write triggers bypassing debounce; indicator confirms "Saved to Firestore"; updated timestamp reflects in sidebar item.
- **TC-2.4: Save Failure Recovery & Retry Mechanism**
  - *Action*: Simulate network loss or permissions error during save.
  - *Expected*: Non-intrusive red banner renders with error message and `#retry-save-btn`; user input buffer is preserved with zero data loss; clicking retry attempts save again.

### Test Suite 3: Core Journal Features (Mood, Tags, Favorites, Date/Time, Word Count)
- **TC-3.1: Mood Selector & Dynamic Color Association**
  - *Action*: Click different mood buttons in the mood selector bar ("Joyful", "Calm", "Reflective", "Grateful", "Anxious", "Heavy", "Energized").
  - *Expected*: Active mood pill updates with tailored color styles; entry updates in state and persists to Firestore; sidebar list updates corresponding mood badge.
- **TC-3.2: Tag Addition & Removal**
  - *Action*: Type `#growth` into `#tag-input` and press `Enter` (or click `Add`); then click `#remove-tag-btn` on the newly created tag chip.
  - *Expected*: Tag is formatted and added to entry's `tags` array; duplicates are prevented; chip renders with remove button; clicking remove deletes tag and updates Firestore.
- **TC-3.3: Favorite Toggle from Editor & Sidebar**
  - *Action*: Click the star icon in `#toggle-favorite-btn` on the active editor, and star icon on an inactive entry in the sidebar.
  - *Expected*: Favorite state toggles optimistically (filled amber star vs outline star); persists to Firestore `isFavorite` boolean; rollback occurs gracefully if write fails.
- **TC-3.4: Date & Time Picker**
  - *Action*: Click the date/time picker button `#edit-datetime-btn`, pick a custom date and time, and click "Set".
  - *Expected*: Date picker popover allows selecting custom date and time; formatted date string updates (e.g. "Sat, Sep 5, 2026, 09:15 AM"); persists to `createdAt` in Firestore.
- **TC-3.5: Word and Character Count Calculations**
  - *Action*: Type 5 words with mixed spacing and punctuation into `#journal-content-textarea`.
  - *Expected*: Counter display shows "5 words • X chars" matching exact whitespace-delimited word tokens in real-time.

### Test Suite 4: Sidebar Search, Filtering & Navigation
- **TC-4.1: Real-Time Keyword Search**
  - *Action*: Type search query into `#search-entries-input`.
  - *Expected*: Entries list dynamically filters matching query against title, content, and tags; matching count is displayed.
- **TC-4.2: Mood Pill Filter**
  - *Action*: Click a mood chip in the sidebar filter carousel (e.g. "Grateful").
  - *Expected*: List displays only entries tagged with "Grateful"; clicking the chip again or "All" resets filter.
- **TC-4.3: Favorites-Only Filter**
  - *Action*: Click `#filter-favorites-btn` star button in the sidebar header.
  - *Expected*: List displays only entries where `isFavorite === true`; empty state appears if no favorites exist.
- **TC-4.4: Entry Switching & Isolation**
  - *Action*: Select a past entry in the sidebar list while editing another entry.
  - *Expected*: Active entry switches seamlessly; previous in-flight reflection or debounced timer is cancelled via `AbortController`; editor loads target entry without stale bleed.

### Test Suite 5: Memory Detection & Suggestion Scanner
- **TC-5.1: Memory Scan Trigger**
  - *Action*: Write a journal entry containing enduring facts (e.g. "I adopted a golden retriever named Buster. I prefer drinking black coffee in the morning.") and click `#scan-memories-btn`.
  - *Expected*: Backend invokes `/api/memories/detect`; candidate facts are returned with categories; Memory Scanner Card renders with detected items.
- **TC-5.2: Zero-Auto-Authorization Guarantee**
  - *Action*: Inspect Firestore memory collection immediately after scanning before user clicks any policy button.
  - *Expected*: Zero detected memories are persisted to Firestore automatically. No policies are assigned without explicit user click.
- **TC-5.3: Explicit User Approval (ALLOWED Policy)**
  - *Action*: In the Scanner Card, click the "Allow" button on a suggested memory.
  - *Expected*: Memory is assigned policy `ALLOWED`; persisted to `/users/{userId}/memories/{memoryId}` with `sourceEntryId` referencing active entry; Scanner updates status.
- **TC-5.4: Explicit User Assignment (TEMPORARY Policy with Expiration)**
  - *Action*: Click "Temporary" button on a candidate memory, and select "7 Days" or "30 Days".
  - *Expected*: Memory is saved with policy `TEMPORARY` and calculated `expiresAt` epoch timestamp.
- **TC-5.5: Explicit User Assignment (BLOCKED & REVOKED Policies)**
  - *Action*: Click "Block" on a candidate memory in scanner card, or change an existing allowed memory to "Revoked" in the Memory Firewall modal.
  - *Expected*: Stored memory policy updates to `BLOCKED` or `REVOKED`; instantly excluded from all future Gemini contexts.

### Test Suite 6: Pre-LLM Context Memory Firewall (Privacy Boundaries)
- **TC-6.1: Physical Pre-LLM Exclusion of Blocked Memories**
  - *Action*: Store one memory as `ALLOWED` and one as `BLOCKED`. Trigger reflection.
  - *Expected*: Pre-LLM Firewall filters candidate memories BEFORE prompt construction. Serialized outbound payload sent to Gemini contains 0 characters of the `BLOCKED` memory.
- **TC-6.2: Physical Pre-LLM Exclusion of Revoked Memories**
  - *Action*: Change previously `ALLOWED` memory to `REVOKED`. Trigger reflection.
  - *Expected*: Pre-LLM Firewall excludes revoked memory; outbound payload audit confirms 0 references.
- **TC-6.3: Temporary Memory Expiration Filter**
  - *Action*: Evaluate memory with policy `TEMPORARY` where `now() >= expiresAt`.
  - *Expected*: Pre-LLM Firewall treats expired memory as strictly blocked; excludes it completely from LLM context.
- **TC-6.4: Fail-Closed Behavior on Ambiguity or Owner Mismatch**
  - *Action*: Provide memory with missing user ID, corrupt policy string, or invalid schema.
  - *Expected*: Memory is omitted from Gemini context. Security takes precedence over personalization.

### Test Suite 7: Pre-LLM Content Privacy Firewall & Credential Redaction
- **TC-7.1: Protected Data & PII Redaction**
  - *Action*: Include `[PRIVATE: secret passkey 12345]` or `Private: medical diagnosis ABC` in journal body. Trigger reflection.
  - *Expected*: Pre-LLM Content Privacy Firewall strips the secret and replaces it with `[REDACTED BY DEARVAULT FIREWALL]`; outbound payload contains 0 instances of the secret; Gemini responds without seeing the secret.
- **TC-7.2: API Key & High-Entropy Credential Scrubbing**
  - *Action*: Paste a simulated token (e.g. `AIzaSyD-mockKey1234567890`) into entry.
  - *Expected*: Credential regex scrubs token into redaction marker prior to dispatching to Gemini API.

### Test Suite 8: Gemini Multi-Turn Reflection & Relevance Attribution
- **TC-8.1: Mode-Specific Reflections (Reflect, Summary, Brainstorm)**
  - *Action*: Click `#trigger-reflection-btn`, `#trigger-summary-btn`, or `#trigger-brainstorm-btn`.
  - *Expected*: Gemini generates mode-focused response using resilient model fallback ladder (`gemini-3.6-flash` -> `gemini-3.1-flash-lite` -> `gemini-flash-latest` -> `gemini-3.7-flash`).
- **TC-8.2: Conversational Multi-Turn Follow-Up**
  - *Action*: Type follow-up query into `#chat-turn-input` and submit.
  - *Expected*: Previous turns are passed in sanitized history; Gemini responds in context with model badge; all turns persist to `/entries/{entryId}` and `/interactions/{interactionId}`.
- **TC-8.3: Explainable Memory Attribution (`influencedBy`)**
  - *Action*: Inspect reflection response when an authorized background memory was relevant.
  - *Expected*: Response includes `influencedBy` array with `memoryId`, `category`, and `summary`; UI renders "Influenced by Authorized Memories" collapsible card. If no memories used, array is empty. Never discloses blocked/revoked memories.

### Test Suite 9: Output Guard Defense-in-Depth
- **TC-9.1: Defense-in-Depth Sensitive Keyword Scrubbing**
  - *Action*: Test model output containing a phrase matching a `BLOCKED` memory.
  - *Expected*: Output Guard scans response text; redacts matches with `[REDACTED BY DEARVAULT FIREWALL]`; flags `redactionApplied = true`.

### Test Suite 10: Lifecycle & Stale Memory Cleanup on Entry Deletion
- **TC-10.1: Stale Memory Cleanup on Entry Deletion**
  - *Action*: Delete an entry that had associated memories created via the Scanner.
  - *Expected*: `deleteJournalEntry` deletes the entry document AND queries `/users/{userId}/memories` for `sourceEntryId == entryId`, deleting all associated memories via batched write; memories belonging to other entries remain untouched.
- **TC-10.2: Cross-User Memory Isolation**
  - *Action*: Attempt to delete or access memories with a different user's UID.
  - *Expected*: Scoped queries and Firestore rules reject the operation with `permission-denied`.

### Test Suite 11: Concurrency & Rapid Entry Switching
- **TC-11.1: Rapid Entry Switching In-Flight Request Cancellation**
  - *Action*: Trigger reflection on Entry A, then immediately click Entry B in sidebar before response returns.
  - *Expected*: `reflectionAbortControllerRef` aborts HTTP request for Entry A; when response arrives, originating entry check (`originatingEntryId === activeEntryIdRef.current`) discards the response; Entry B is not corrupted with Entry A's reflection.
- **TC-11.2: Stale Auto-Save Write Discarding**
  - *Action*: Edit Entry A, immediately switch to Entry B while Entry A debounce timer is ticking.
  - *Expected*: `handleUpdateEntry` validates `entryId === activeEntryIdRef.current` and discards any late-firing write for Entry A, maintaining strict entry state boundaries.
