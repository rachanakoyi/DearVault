# DearVault — User-Authenticated AI Journal & Reflection Studio

DearVault is a full-stack, user-authenticated journaling and personal reflection studio powered by the **Gemini 3.6 Flash API**, **Firebase Authentication (Google Sign-In)**, and **Cloud Firestore**. Every interaction, journal entry, and multi-turn AI reflection is strictly isolated per authenticated user using owner-bound Firestore security rules.

---

## 1. Architectural Threat Model (5 Threat Zones)

| Threat Zone | Specific Risk Vectors | Enforced Mitigation & Countermeasures |
| :--- | :--- | :--- |
| **1. Input Surfaces** | Malicious prompt injection, payload tampering, oversized bodies | Strict Express body limits (`4mb`), typed interfaces, defensive payload ingestion, input sanitization before rendering. |
| **2. Planning & Reasoning** | System prompt bypass, persona hijacking, hallucinatory answers | Explicit system instructions, separated user context roles, temperature bounds (0.65 - 0.85). |
| **3. Tool Execution & APIs** | API key exfiltration, SSRF, client-side token exposure | Gemini API key is accessed exclusively server-side (`process.env.GEMINI_API_KEY`) via Express proxy. Automated 4-tier model fallback ladder (`gemini-3.6-flash` -> `gemini-3.1-flash-lite` -> `gemini-flash-latest` -> `gemini-3.7-flash`). |
| **4. Memory & State** | Cross-tenant data leakage, unauthenticated document reads, undefined-value crashes | Cryptographically owner-bound Firestore Security Rules (`request.auth.uid == userId`). Strict `undefined`-stripping utility before every database write. |
| **5. Inter-System Comm** | Session hijacking, insecure credential transport, OAuth spoofing | Google Sign-In via Firebase Auth (OAuth 2.0 PKCE flow), zero plaintext password storage, secure HTTPS transport. |

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

Deploy the owner-bound security rules to ensure complete data isolation:

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
gcloud run deploy mindecho-app \
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
gcloud run services update mindecho-app \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 6. Functional Verification & Test Walkthrough

Every user interaction is testable through the following functional steps:

### Test Suite 1: Authentication & Landing Flow
- **TC-1.1: Landing View Display**
  - *Action*: Navigate to `/` as an unauthenticated visitor.
  - *Expected*: The landing page loads displaying value pillars, security badges, and "Sign in with Google" buttons (`#nav-signin-btn`, `#hero-signin-btn`).
- **TC-1.2: Google Sign-In Execution**
  - *Action*: Click `#hero-signin-btn`. Complete the Google OAuth popup.
  - *Expected*: User authentication succeeds; Firebase Auth listener fires; application automatically transitions to private Dashboard with user name and avatar.
- **TC-1.3: Sign-Out Transition**
  - *Action*: In Dashboard, click `#signout-btn`.
  - *Expected*: User session terminates; application returns to landing page.

### Test Suite 2: Journal Creation & Auto-Save
- **TC-2.1: Initialize Blank Reflection**
  - *Action*: Click `#new-entry-btn` in the sidebar.
  - *Expected*: A fresh entry is created with timestamp, blank title, and default "Reflective" mood.
- **TC-2.2: Title & Content Input**
  - *Action*: Type title into `#journal-title-input` and reflection text into `#journal-content-textarea`.
  - *Expected*: Word and character counters update live; status displays "Saving to Firestore..." and settles to "Saved to Firestore" within 1 second.
- **TC-2.3: Mood & Tag Association**
  - *Action*: Click a mood pill (e.g. "Grateful") and enter `#clarity` into tag input.
  - *Expected*: Mood pill highlights; tag badge renders with remove button; entry updates in Firestore.
- **TC-2.4: Explicit Save**
  - *Action*: Click `#explicit-save-btn`.
  - *Expected*: Immediate Firestore `setDoc` executes with verified undefined-stripping; "Saved to Firestore" indicator confirms write.

### Test Suite 3: Gemini 3.6 Flash Multi-Turn Reflections
- **TC-3.1: Empathetic Reflection Trigger**
  - *Action*: Click `#trigger-reflection-btn` ("Empathetic Reflection").
  - *Expected*: Loading state activates with spinner; backend invokes fallback ladder (`gemini-3.6-flash`); markdown response appears with empathetic questions; entry is updated in Firestore.
- **TC-3.2: Synthesis & Summary Trigger**
  - *Action*: Click `#trigger-summary-btn` ("Synthesize & Summarize").
  - *Expected*: Gemini generates structured executive takeaways, emotional tone, and next steps; summary badge reflects in sidebar list.
- **TC-3.3: Brainstorming Next Steps**
  - *Action*: Click `#trigger-brainstorm-btn` ("Brainstorm Ideas").
  - *Expected*: Gemini delivers 3-5 creative angles and actionable experiments.
- **TC-3.4: Multi-Turn Conversational Follow-Up**
  - *Action*: Type a follow-up query into `#chat-turn-input` and click `#send-chat-turn-btn`.
  - *Expected*: The user turn appears right-aligned; Gemini responds in context with model badge; all turns persist to Firestore.

### Test Suite 4: History, Search & Lifecycle Management
- **TC-4.1: Real-Time History Listing**
  - *Action*: Observe `#search-entries-input` and the entries list in the sidebar.
  - *Expected*: All past entries appear ordered by last updated date with mood badges and message counts.
- **TC-4.2: Real-Time Filter & Search**
  - *Action*: Type a keyword into `#search-entries-input` or click a mood filter.
  - *Expected*: List filters dynamically to matching entries.
- **TC-4.3: Entry Switching**
  - *Action*: Click a different past entry in the sidebar.
  - *Expected*: Active editor and conversation thread populate with the selected entry's content and historical messages.
- **TC-4.4: Entry Deletion**
  - *Action*: Hover over an entry, click the trash icon, and confirm `#confirm-delete-entry-btn`.
  - *Expected*: Entry is permanently deleted from Firestore subcollection; UI seamlessly switches to the next entry or initializes a fresh draft.

### Test Suite 5: Security Architecture Inspection
- **TC-5.1: Threat Model Modal**
  - *Action*: Click `#open-threat-model-btn` in the dashboard header.
  - *Expected*: Modal opens displaying the 5 Threat Zones table, OWASP mitigations, and Firestore isolation rules.
