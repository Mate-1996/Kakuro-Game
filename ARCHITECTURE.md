# Architecture Overview

## Project Structure After Implementation

```
Kakuro-Game/
├── app/
│   ├── api/
│   │   ├── puzzle/              (existing)
│   │   ├── validate/            (existing)
│   │   ├── check-cell/          (existing)
│   │   ├── solution/            (existing)
│   │   ├── hint/                (existing)
│   │   ├── session/             ✨ NEW - Session management
│   │   │   └── route.ts         (login/verify/refresh/logout)
│   │   └── cache/               ✨ NEW - Static data caching
│   │       └── route.ts         (difficulty/templates/config)
│   │
│   ├── components/
│   │   ├── Achievements.tsx     (existing)
│   │   ├── Authform.tsx         (UPDATED - uses PasswordInput)
│   │   ├── CompetitiveMode.tsx  (existing)
│   │   ├── Dashboard.tsx        (existing)
│   │   ├── FriendsList.tsx      (existing)
│   │   └── Kakurogame.tsx       (existing - ready for integration)
│   │
│   ├── context/
│   │   └── AuthContext.tsx      (existing)
│   │
│   └── layout.tsx               (existing)
│
├── backend/                     (existing)
│   ├── types.ts
│   ├── puzzleParser.ts
│   ├── constraintChecker.ts
│   ├── solver.ts
│   ├── hintSystem.ts
│   └── puzzleGenerator.ts
│
├── components/
│   ├── theme-toggle.tsx         (existing)
│   ├── ui/                      (existing)
│   └── PasswordInput.tsx        ✨ NEW - Password visibility toggle
│
├── lib/
│   ├── firebase.js              (existing)
│   ├── Kakuroutils.ts           (existing - re-export shim)
│   ├── utils.ts                 (existing)
│   │
│   ├── storage.ts               ✨ NEW - localStorage management
│   ├── sessionManager.ts        ✨ NEW - Client-side session logic
│   │
│   └── hooks/
│       ├── useSession.ts        ✨ NEW - Session React hook
│       └── usePuzzleStorage.ts  ✨ NEW - Storage React hook
│
├── public/                      (existing)
│
├── middleware.ts                ✨ NEW - Route protection middleware
│
├── STORAGE_CACHING_SECURITY.md  ✨ NEW - Complete documentation
├── INTEGRATION_GUIDE.md         ✨ NEW - Integration examples
├── IMPLEMENTATION_SUMMARY.md    ✨ NEW - This implementation summary
│
└── [other config files]         (existing)
```

---

## Data Flow Diagrams

### 1. Authentication & Session Flow

```
┌────────────────────────────────────────────────────────────────┐
│                          User Browser                          │
└────────────────────────────────────────────────────────────────┘
       │
       │ 1. Fill email & password
       │ (with eye toggle visibility)
       ↓
┌────────────────────────────────────────────────────────────────┐
│          Authform.tsx (uses PasswordInput)                      │
└────────────────────────────────────────────────────────────────┘
       │
       │ 2. Click "Sign In"
       ↓
┌────────────────────────────────────────────────────────────────┐
│        Firebase Authentication                                  │
│  signInWithEmailAndPassword(auth, email, password)             │
└────────────────────────────────────────────────────────────────┘
       │ ✓ Auth succeeds
       ↓ userId obtained
┌────────────────────────────────────────────────────────────────┐
│        initializeSession(userId)                               │
│  lib/sessionManager.ts                                         │
└────────────────────────────────────────────────────────────────┘
       │
       │ POST /api/session/login
       ↓
┌────────────────────────────────────────────────────────────────┐
│        Backend Session Handler (Route /api/session)            │
│  ├─ Generate sessionId                                         │
│  ├─ Create token                                               │
│  ├─ Store in Redis:session:{userId}:{sessionId}              │
│  └─ TTL: 7 days                                               │
└────────────────────────────────────────────────────────────────┘
       │
       │ Set HTTP-only cookie
       ↓
┌────────────────────────────────────────────────────────────────┐
│        Browser Cookie                                          │
│  Name: kakuro_session                                          │
│  Value: {sessionId}                                            │
│  Flags: HttpOnly, Secure, SameSite=Strict                     │
│  Max-Age: 604800000ms (7 days)                                │
└────────────────────────────────────────────────────────────────┘
       │
       │ 3. Start background verification
       │ (every 60 seconds)
       ↓
┌────────────────────────────────────────────────────────────────┐
│        Periodic Session Verification                           │
│  POST /api/session/verify                                      │
│  ├─ Check session exists in Redis                            │
│  ├─ Check not expired (< 7 days)                             │
│  ├─ Check inactivity (< 24 hours)                            │
│  └─ Return: is_valid: boolean                                │
└────────────────────────────────────────────────────────────────┘
       │
       │ 4. Activity monitoring
       │ (mouse/key/scroll/touch events)
       ↓
┌────────────────────────────────────────────────────────────────┐
│        setupInactivityLogout(userId)                           │
│  ├─ If 20 min no activity → warn toast                       │
│  ├─ If 24 h no activity → auto logout                        │
│  └─ Any activity → reset timer                               │
└────────────────────────────────────────────────────────────────┘
```

### 2. Puzzle Progress Save & Load Flow

```
┌────────────────────────────────────────────────────────────────┐
│                     Playing Puzzle                             │
│                  (Kakurogame.tsx)                              │
└────────────────────────────────────────────────────────────────┘
       │
       │ Every 10 seconds:
       │ ├─ gridValues (numbers in cells)
       │ ├─ pencilMarks (candidate digits)
       │ ├─ puzzleId, difficulty, size
       │ ├─ elm elapsed time
       │ └─ timestamp
       ↓
┌────────────────────────────────────────────────────────────────┐
│        usePuzzleStorage() Hook                                 │
│  lib/hooks/usePuzzleStorage.ts                                │
└────────────────────────────────────────────────────────────────┘
       │
       │ savePuzzleProgress(...)
       ↓
┌────────────────────────────────────────────────────────────────┐
│        localStorage Management                                 │
│  lib/storage.ts                                               │
└────────────────────────────────────────────────────────────────┘
       │
       │ localStorage.setItem(
       │   'kakuro_puzzle_abc123',
       │   JSON.stringify({
       │     puzzleId: 'abc123',
       │     gridValues: [...]
       │     pencilMarks: {...}
       │     difficulty: 'medium'
       │     size: 8
       │     elapsedSeconds: 125
       │     lastSavedAt: 1710100000000
       │   })
       │ )
       ↓
┌────────────────────────────────────────────────────────────────┐
│        Browser localStorage                                    │
│  Key: kakuro_puzzle_abc123                                    │
│  Value: JSON string (game state)                              │
│  Persistence: Until manually cleared                          │
└────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════

[Later: User returns to site]

┌────────────────────────────────────────────────────────────────┐
│                    Resume Puzzle                              │
│           Load saved progress on mount                        │
└────────────────────────────────────────────────────────────────┘
       │
       │ usePuzzleStorage()
       │ getCurrentPuzzleId()
       ↓
┌────────────────────────────────────────────────────────────────┐
│        Get most recent puzzle ID                               │
│  localStorage.getItem('kakuro_current_puzzle_id')             │
│  → 'abc123'                                                    │
└────────────────────────────────────────────────────────────────┘
       │
       │ loadPuzzleProgress('abc123')
       ↓
┌────────────────────────────────────────────────────────────────┐
│        Retrieve saved puzzle state                             │
│  localStorage.getItem('kakuro_puzzle_abc123')                 │
│  → JSON.parse() → SavedPuzzleProgress object                  │
└────────────────────────────────────────────────────────────────┘
       │
       │ Restore:
       │ ├─ gridValues → cell placeholders
       │ ├─ pencilMarks → candidate digits
       │ ├─ elapsedSeconds → timer
       │ └─ settings → theme, sound, highlighting
       ↓
┌────────────────────────────────────────────────────────────────┐
│                 Puzzle Resumed! 🎮                            │
│  User can continue where they left off                        │
└────────────────────────────────────────────────────────────────┘
```

### 3. Cache Flow

```
┌────────────────────────────────────────────────────────────────┐
│                     Game Startup                              │
│            (PuzzleSelector or Settings Component)             │
└────────────────────────────────────────────────────────────────┘
       │
       │ fetch('/api/cache/difficulty-settings')
       │ fetch('/api/cache/puzzle-templates')
       │ fetch('/api/cache/game-config')
       ↓
┌────────────────────────────────────────────────────────────────┐
│              Backend Cache Handler                            │
│  app/api/cache/route.ts → GET request                         │
└────────────────────────────────────────────────────────────────┘
       │
       │ Check in-memory cache (or Redis)
       │ Key: 'cache:config:difficulty_settings'
       ↓
       ├─ CACHE HIT (< 24h old)
       │  └─ Return cached data immediately
       │
       └─ CACHE MISS
          ├─ Compute/load fresh data
          ├─ Store in cache with 24h TTL
          └─ Return to client
       ↓
┌────────────────────────────────────────────────────────────────┐
│     Client receives difficulty configurations                  │
│  [{difficulty: 'easy', timeLimitSeconds: 120, ...}           │
│   {difficulty: 'medium', timeLimitSeconds: 300, ...}         │
│   {difficulty: 'hard', timeLimitSeconds: 600, ...}]          │
└────────────────────────────────────────────────────────────────┘
       │
       │ Populate UI dropdowns/buttons
       ↓
┌────────────────────────────────────────────────────────────────┐
│      User selects difficulty → Generates puzzle               │
│  GET /api/puzzle?size=8&difficulty=medium                    │
└────────────────────────────────────────────────────────────────┘
```

### 4. Protected Routes Flow

```
┌────────────────────────────────────────────────────────────────┐
│                  User accesses URL                            │
│        e.g., http://localhost:3000/play                      │
└────────────────────────────────────────────────────────────────┘
       │
       │ Browser makes request
       ↓
┌────────────────────────────────────────────────────────────────┐
│        Next.js Middleware (middleware.ts)                     │
│  Runs BEFORE client/server render                             │
└────────────────────────────────────────────────────────────────┘
       │
       │ Check:
       │ ├─ Is /play a protected route? YES
       │ ├─ Does request have kakuro_session cookie? 
       │ │  ├─ YES → Continue to page
       │ │  └─ NO  → Redirect to /auth
       │ │
       │ └─ Alternative: Check /auth route
       │    ├─ Has session cookie?
       │    │  ├─ YES → Redirect to /dashboard
       │    │  └─ NO  → Show login/signup form
       │
       ↓
┌─────────────────────────────────────────────────────────────┐
│  Scenario 1: User session valid                            │
│  ✓ Request has kakuro_session cookie                      │
│  ✓ Session verified in Redis                              │
│  → Render /play page                                       │
└─────────────────────────────────────────────────────────────┘

       OR

┌─────────────────────────────────────────────────────────────┐
│  Scenario 2: User session invalid                          │
│  ✗ No kakuro_session cookie found                          │
│  → Redirect to /auth                                        │
│  → Show login form                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Integration Map

```
AuthContext.tsx
    ├─ useSession()
    │   ├─ initializeSession() → POST /api/session/login
    │   ├─ verifySession()     → POST /api/session/verify
    │   ├─ refreshActivity()   → POST /api/session/refresh
    │   └─ logout()            → POST /api/session/logout
    │
    └─ useAuth()
        └─ Firebase Auth state

PasswordInput.tsx
    ├─ Show/hide password toggle
    └─ Used in Authform.tsx

Authform.tsx
    ├─ Uses PasswordInput for passwords
    ├─ Calls Firebase auth
    └─ Triggers useSession on success

Kakurogame.tsx (ready for enhancement)
    ├─ usePuzzleStorage()
    │   ├─ savePuzzleProgress()    → localStorage
    │   ├─ loadPuzzleProgress()    → localStorage
    │   ├─ settings / updateSettings
    │   └─ theme / updateTheme
    │
    └─ Auto-save every 10 seconds

PuzzleSelector / ResumePuzzle (examples in INTEGRATION_GUIDE.md)
    ├─ fetch('/api/cache/difficulty-settings')
    ├─ loadCurrentPuzzleId()
    └─ loadPuzzleProgress(id)
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19 | UI components |
| **Styling** | Tailwind CSS v4 | Responsive design |
| **State** | React Hooks | Local state management |
| **Storage** | Browser localStorage | Client-side persistence |
| **Backend** | Next.js 16 | API routes & middleware |
| **Session** | Redis (or in-memory) | Session store |
| **Auth** | Firebase Auth | User authentication |
| **Database** | Firestore | User profiles & stats |
| **HTTP** | Standard cookies | Session transport |

---

## Security Layers

```
┌─────────────────────────────────────────┐
│         Layer 1: Browser                │
├─────────────────────────────────────────┤
│ localStorage (client-side)              │
│ ├─ Puzzle progress                      │
│ ├─ Settings                             │
│ └─ Theme                                │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│    Layer 2: HTTP Cookies (Request)      │
├─────────────────────────────────────────┤
│ kakuro_session cookie                   │
│ ├─ HttpOnly (JS cannot access)         │
│ ├─ Secure (HTTPS only in prod)         │
│ ├─ SameSite=Strict (CSRF protection)   │
│ └─ Max-Age: 7 days                      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Layer 3: Middleware (Route Guards)     │
├─────────────────────────────────────────┤
│ middleware.ts                           │
│ ├─ Verify session cookie present        │
│ ├─ Protect routes: /play, /dashboard   │
│ └─ Redirect to /auth if not logged in   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Layer 4: Backend Verification          │
├─────────────────────────────────────────┤
│ /api/session/verify                     │
│ ├─ Check Redis session exists          │
│ ├─ Verify expiration (< 7 days)        │
│ ├─ Check inactivity (< 24 hours)       │
│ └─ Verify userAgent matches            │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│   Layer 5: Inactivity Monitoring        │
├─────────────────────────────────────────┤
│ sessionManager.ts                       │
│ ├─ Track user interactions              │
│ ├─ Warn at 4 min before logout         │
│ └─ Auto-logout after 24 hours           │
└─────────────────────────────────────────┘
```

---

## File Dependencies

```
Authform.tsx
    ├─── PasswordInput.tsx
    ├─── Firebase Auth
    └─── Firestore (user profiles)

Kakurogame.tsx
    ├─── usePuzzleStorage()
    │    └─── storage.ts
    ├─── useSession()
    │    └─── sessionManager.ts
    └─── @/backend/* (puzzle logic)

Layout.tsx (or App Wrapper)
    └─── useSession()
         ├─── sessionManager.ts
         │    ├─── /api/session/login
         │    ├─── /api/session/verify
         │    ├─── /api/session/refresh
         │    └─── /api/session/logout
         └─── Event listeners
              ├─── onSessionExpired()
              └─── onInactivityWarning()

middleware.ts
    ├─── Cookies (request)
    └─── Route matchers

/api/session/route.ts
    ├─── Redis (or in-memory store)
    └─── Crypto (JWT/token generation)

/api/cache/route.ts
    └─── Redis (or in-memory cache)
```
