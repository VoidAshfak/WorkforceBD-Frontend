# WorkforceBD API Guidelines

Local Base URL: `http://localhost:3000/api/v1`
Cloud Base URL: `https://workforcebd.onrender.com/api/v1`
---

## General

### Request Headers

| Header | Value | Required |
|---|---|---|
| `Content-Type` | `application/json` | All POST/PUT/PATCH |
| `Authorization` | `Bearer <access_token>` | Protected routes |

### Response Format

All responses follow this structure:

**Success**
```json
{
  "success": true,
  "message": "Human readable message",
  "data": { }
}
```

**Error**
```json
{
  "success": false,
  "message": "Human readable error message",
  "errors": [ ]
}
```

### HTTP Status Codes

| Code | Meaning |
|---|---|
| `200` | OK |
| `201` | Created |
| `400` | Bad request / business logic error |
| `401` | Unauthenticated |
| `403` | Forbidden / insufficient role |
| `404` | Not found |
| `422` | Validation failed |
| `500` | Server error |

---

## Roles & Access

Every user has a `roles` array. Possible values: `worker`, `business`, `admin`.

- One account can hold multiple roles (e.g. a user can be both `worker` and `business`)
- Most features require admin verification of the profile before access is granted
- `admin` role is provisioned server-side (`npm run admin:create`) — not available via registration. Admins sign in with username + password + email 2FA ([POST `/auth/admin/login`](#post-authadminlogin)), never the phone OTP flow.

| Role | Can do |
|---|---|
| `worker` | Browse shifts, apply, track earnings |
| `business` | Post shifts, manage applications, hire workers |
| `admin` | Verify profiles, moderate content, resolve disputes, block users, tune platform settings, monitor the platform |

---

## Auth

## Authentication Flow

A single passwordless, role-first flow handles both first-time signup and returning login. The user picks a role on the first screen, enters their phone, and verifies an OTP. The server creates the account on first use or logs the user in. Account access stays restrictive (look-only) until an admin verifies the profile.

### Visual Diagram

```mermaid
flowchart TD
    A[Screen 1: pick role<br/>worker / business / admin] --> B[Enter phone]
    B --> C["POST /auth/send-otp { phone }"]
    C --> D[Enter OTP]
    D --> E["POST /auth/verify-otp<br/>{ phone, otp_code, role }"]

    E -->|Invalid / expired OTP| E1[400 — retry]
    E -->|New phone, no role| E2[400 — role required]
    E -->|Account deactivated| E3[403 — blocked]
    E -->|OK| F[Store accessToken + refreshToken]

    F --> G{active_role}
    G -->|admin| ADM[Admin console]
    G -->|business| BIZ{"profile.exists?"}
    G -->|worker| H{verification_status}

    BIZ -->|false| BON[Create business profile<br/>then onboarding] --> H
    BIZ -->|true| H

    H -->|verified| FULL[Full access<br/>browse + apply / post]
    H -->|unverified / rejected| REST[Restrictive view +<br/>resume onboarding at next_step]
    H -->|pending| PEND[Restrictive view +<br/>'under admin review']

    REST --> DOCS[Submit docs<br/>status → pending] --> PEND
    PEND -->|admin approves| NOTE[Notification: verified] --> FULL
```



### GET `/auth/me`

Returns the authenticated user's data plus a per-role profile summary. Call this on app open to validate the session, decide between full and restrictive (look-only) access, and resume onboarding.

**Headers**
```
Authorization: Bearer <access_token>
```

**Response `200`**
```json
{
  "success": true,
  "message": "Authenticated",
  "data": {
    "id": "uuid",
    "phone": "+8801712345678",
    "email": null,
    "full_name": null,
    "roles": ["worker"],
    "is_phone_verified": true,
    "profiles": {
      "worker": {
        "exists": true,
        "verification_status": "unverified",
        "profile_completion": 25,
        "next_step": "skills"
      },
      "business": null
    }
  }
}
```

When `roles` holds **both** `worker` and `business`, show the "Switch account" button (both `profiles.*` are non-null) and call [`/auth/switch-role`](#post-authswitch-role) to flip context.

A role's `profiles.<role>` is `null` when the user does not hold that role. For roles the user holds:

| Field | Meaning |
|---|---|
| `exists` | Whether a profile row exists (worker stub is auto-created at auth; business is not) |
| `verification_status` | `unverified` · `pending` · `verified` · `rejected` — drives full vs restrictive access |
| `profile_completion` | Worker only. Percent of onboarding steps done (0–100) |
| `next_step` | Next onboarding step to route to: `basic` · `skills` · `availability` · `documents` · `create_business` · `null` (done/verified) |

**Error `401`** — token missing, invalid, or expired → call `/auth/refresh` then retry.

---

### POST `/auth/send-otp`

Request an OTP to the given phone number. There is no login/register split — the same call serves both. Role is not needed here; it is chosen on the first screen and sent at verify time.

**Request Body**
```json
{
  "phone": "+8801712345678"
}
```

| Field | Type | Required | Values |
|---|---|---|---|
| `phone` | string | always | BD mobile, format `+8801XXXXXXXXX` |

**Response `200`**
```json
{
  "success": true,
  "message": "OTP sent successfully"
}
```

**Error `422`** — validation failed
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "msg": "Invalid phone number", "path": "phone" }
  ]
}
```

> **Rate limit:** 3 requests per phone per 10 minutes.
> **Note (dev only):** OTP is printed to the server console. SMS gateway not integrated yet. OTPs are stored hashed (SHA-256) at rest.

---

### POST `/auth/verify-otp`

Verify OTP. One unified path — the server creates the account on first use or logs the user in if the phone is already known. Returns tokens, user, and the active role's profile summary.

**Request Body**
```json
{
  "phone": "+8801712345678",
  "otp_code": "482910",
  "role": "worker"
}
```

| Field | Type | Required | Values |
|---|---|---|---|
| `phone` | string | always | Same phone used in send-otp |
| `otp_code` | string | always | 6-digit numeric |
| `role` | string | conditional | `worker` · `business`. **Required when the phone has no account yet** (account creation). Omit for admin login. |

**Behaviour by case**

| Case | Result |
|---|---|
| New phone + `role` | Account created with `[role]`. Worker gets a profile stub. |
| Known phone + new `role` | `role` appended to existing `roles`. Worker gets a profile stub. No duplicate account. |
| Known phone + held `role` (or no `role`) | Plain login. |
| New phone, no `role` | `400` — role required. |

**Response `200`**
```json
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "accessToken": "<jwt>",
    "refreshToken": "<token>",
    "user": {
      "id": "uuid",
      "phone": "+8801712345678",
      "email": null,
      "full_name": null,
      "roles": ["worker"],
      "is_phone_verified": true
    },
    "active_role": "worker",
    "profile": {
      "exists": true,
      "verification_status": "unverified",
      "profile_completion": 0,
      "next_step": "basic"
    }
  }
}
```

`active_role` is the account context the new token carries: the role passed in, or — for a returning user who omitted it — their first role (`null` only if the user somehow holds no worker/business role). It's enforced on role-specific endpoints (see [Account context](#account-context-active-role)). `profile` is that role's summary (same shape as in `/auth/me`) — use `verification_status` to decide full vs restrictive access and `next_step` to route into onboarding. For business, `profile.exists` is `false` until the business profile is created.

**Error `400`** — OTP invalid or expired
```json
{
  "success": false,
  "message": "Invalid or expired OTP"
}
```

**Error `400`** — new phone without a role
```json
{
  "success": false,
  "message": "Role is required to create an account"
}
```

**Error `403`** — account deactivated
```json
{
  "success": false,
  "message": "Account is deactivated"
}
```

> **Rate limit:** 5 verify attempts per IP per 15 minutes.
> Store `accessToken` and `refreshToken` securely. Access token expires in **15 minutes**. Refresh token expires in **30 days**.

---

### POST `/auth/switch-role`

Switches the active account context for a user who holds **both** roles (worker ⇄ business) — backs the "Switch account" button on the profile screen. Requires `Authorization: Bearer <access_token>`.

A user gains the second role through the normal login flow: sign in with the same number via [`/auth/verify-otp`](#post-authverify-otp) and pass the other `role` — it's added to the account. Once `roles` holds both, the app shows the switch button (derive from `/auth/me` → `roles`).

Returns a **new access token** carrying the new context (`active_role`). The app must replace its stored access token with this one — the old token keeps its old context until it expires, and role-specific endpoints are now **enforced by active context** (see [Account context](#account-context-active-role)). The refresh token is unchanged. The response also carries the target role's profile summary so the app can route to the full or onboarding view.

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `role` | enum | ✅ | `worker` \| `business` — must be a role the user already holds |

**Response `200`** — `"Switched to <role> account"`
```json
{
  "success": true,
  "message": "Switched to business account",
  "data": {
    "accessToken": "<new JWT — replace your stored token>",
    "active_role": "business",
    "user": { "id": "uuid", "phone": "+8801…", "email": null, "full_name": "…", "roles": ["worker", "business"], "is_phone_verified": true },
    "profile": { "exists": true, "verification_status": "verified", "next_step": null }
  }
}
```
`profile` is the target role's summary (same shape as `/auth/me` → `profiles.<role>`). For `business` with the role but no profile yet, `exists` is `false` and `next_step` is `create_business` — route to onboarding.

**Errors**

| Code | Message | Cause |
|---|---|---|
| `403` | `You don't have a <role> account. …` | `role` not in the user's `roles` |
| `401` | `Authorization token required` | Missing/invalid token |
| `422` | `Validation failed` | `role` missing or not `worker`/`business` |

---

### POST `/auth/refresh`

Get a new access token using a valid refresh token.

**Request Body**
```json
{
  "refresh_token": "<refresh_token>"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Token refreshed",
  "data": {
    "accessToken": "<new_jwt>",
    "refreshToken": "<new_refresh_token>"
  }
}
```

**Error `401`** — token unknown, expired, or session inactive
```json
{
  "success": false,
  "message": "Invalid or expired refresh token"
}
```

**Error `401`** — revoked token replayed (theft detection)
```json
{
  "success": false,
  "message": "Session has been terminated for security reasons"
}
```

**Error `403`** — account blocked by an admin
```json
{
  "success": false,
  "message": "Account is deactivated"
}
```

> Call this when any protected request returns `401`. **Replace both** stored `accessToken` and `refreshToken` — the old refresh token is invalidated on use (token rotation).
>
> **Reuse detection:** refresh tokens are single-use. Replaying a token that was already rotated revokes the **entire session** (treated as theft). Never reuse or share a refresh token across requests. Tokens are stored hashed at rest, so a token value cannot be recovered from the database.

---

### POST `/auth/logout`

Revokes the session tied to the refresh token.

**Request Body**
```json
{
  "refresh_token": "<refresh_token>"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

> Delete both tokens from client storage after this call.

---

### POST `/auth/admin/login`

Admin dashboard sign-in, **step 1 of 2**. Verifies username + password, then emails a 6-digit verification code to the admin's registered Gmail. No tokens are issued yet. Rate-limited: 5 attempts per IP per 15 minutes.

**Request Body**
```json
{
  "username": "admin",
  "password": "<password>"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `username` | string | yes | 3–50 chars |
| `password` | string | yes | 8–128 chars |

**Response `200`**
```json
{
  "success": true,
  "message": "Verification code sent to your email",
  "data": {
    "two_factor_required": true,
    "email_hint": "to***@gmail.com",
    "expires_in_minutes": 5
  }
}
```

**Errors**

| Code | Message | Cause |
|---|---|---|
| `401` | `Invalid credentials` | Unknown username, wrong password, non-admin account, or blocked account — always the same message (no username probing) |
| `429` | `Too many attempts. Try again in 15 minutes.` | Rate limit |

> Admin accounts are provisioned server-side with `npm run admin:create -- --phone +8801XXXXXXXXX --email you@gmail.com --username admin --password <password>` — never via signup. The email receives the 2FA codes, so it must be real. Mail is sent through Gmail SMTP (`GMAIL_USER` + `GMAIL_APP_PASSWORD` env vars — a Google App Password, not the account password); without creds the code is only logged to the server console (dev).

---

### POST `/auth/admin/verify-2fa`

Admin sign-in, **step 2 of 2**. Verifies the mailed code and issues an admin session. Codes are single-use and expire after 5 minutes. Same rate limit as step 1.

**Request Body**
```json
{
  "username": "admin",
  "code": "623234"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Admin authentication successful",
  "data": {
    "accessToken": "<jwt with active_role: admin>",
    "refreshToken": "<refresh_token>",
    "user": { "id": "uuid", "phone": "+8801...", "email": "admin@gmail.com", "username": "admin", "roles": ["admin"] },
    "active_role": "admin"
  }
}
```

**Errors**

| Code | Message | Cause |
|---|---|---|
| `400` | `Invalid or expired code` | Wrong, expired, or already-used code |
| `401` | `Invalid credentials` | Username no longer resolves to an active admin |

> Token lifecycle uses the same `/auth/refresh` and `/auth/logout`, but admin sessions run a tighter policy:
> - **Access token lives 5 minutes** (worker/business: 15) — the dashboard must refresh on a ≤5-minute cadence while in use.
> - **10-minute sliding idle timeout, enforced server-side.** Every successful refresh pushes the session's idle deadline 10 minutes forward. A refresh attempted after the deadline returns `401 "Session expired due to inactivity"` and revokes the whole session — the admin signs in again with 2FA.
> - **Frontend storage:** keep both tokens in `sessionStorage` (see [Token Storage Recommendation](#token-storage-recommendation)) — the session then survives page refreshes but ends when the tab closes, matching the idle policy.

---


### Sign Up / Log In (unified)

```
1. User picks role (worker / business) on the first screen, then enters phone
        │
        ▼
   POST /auth/send-otp  { phone }
        │
        ▼
2. User enters OTP
        │
        ▼
   POST /auth/verify-otp  { phone, otp_code, role }
        │            (role required only when the phone has no account yet)
        │
        ├── success → store accessToken + refreshToken
        │            read data.active_role + data.profile.verification_status
        │              · verified            → full access
        │              · unverified/pending  → restrictive view, route to data.profile.next_step
        │            worker: profile stub auto-created on first use
        │            business: create business profile after auth (profile.exists = false)
        │
        ├── 400     → invalid OTP, or role missing for a new phone → show message / retry
        └── 403     → account deactivated
```

### Returning User (App Open)

```
App opens → read stored accessToken + refreshToken
        │
        ▼
GET /auth/me  (Authorization: Bearer <accessToken>)
        │
        ├── 200 → session valid, render app with returned user data
        │
        └── 401 → POST /auth/refresh { refresh_token }
                        │
                        ├── 200 → store new accessToken, retry GET /auth/me
                        └── 401 → tokens dead, clear storage, go to login
```

### Token Refresh

```
Protected request returns 401
        │
        ▼
POST /auth/refresh  { refresh_token: "..." }
        │
        ├── 200 → update stored accessToken + refreshToken, retry original request
        └── 401 → both tokens expired, redirect to login
```

---

## Verification Gate

After sign up, workers and businesses must be verified by an admin before using gated features. Until then the account has restrictive (look-only) access: it can authenticate, browse, and complete onboarding, but gated actions are blocked server-side.

| `verification_status` | Meaning |
|---|---|
| `unverified` | Signed up, no docs submitted |
| `pending` | Docs submitted, awaiting admin review |
| `verified` | Approved — full platform access |
| `rejected` | Rejected — user must re-submit docs |

**Server-side gate.** Gated endpoints are protected by a `requireVerifiedProfile(role)` guard, not just client checks. A non-verified user hitting one gets a `403`:

| Condition | `403` message |
|---|---|
| No profile for that role yet | `Complete your <role> profile to continue` |
| Profile exists but not `verified` | `Your <role> profile must be verified by an admin first` |

Currently gated:

| Endpoint | Required role + verified |
|---|---|
| `POST /applications` (apply to shift) | `worker`, verified |
| `POST /applications/:id/check-in` (shift check-in) | `worker`, verified |
| `POST /applications/:id/check-out` (shift check-out) | `worker`, verified |
| `POST /applications/:id/confirm-checkout` (handshake confirm) | `worker`, verified |
| `POST /payments/payouts` (request withdrawal) | `worker`, verified |
| `POST /payments/shifts/:shiftId/settle` (pay workers) | `business`, verified |
| `POST /business/assignments/:id/checkout` (stamp worker check-out) | `business`, verified |
| `POST /business/assignments/:id/confirm` (confirm + pay worker) | `business`, verified |
| `POST /business/assignments/:id/no-show` (mark absentee) | `business`, verified |

> Read `verification_status` from `/auth/verify-otp` or `/auth/me`, and route unverified users to onboarding (`profile.next_step`). Treat the client gate as UX only — the server is the source of truth.

---

## Account context (active role)

A user may hold both `worker` and `business` roles. The access token carries an **`active_role`** claim — the account context it's currently acting as — set at login (the role signed in with, else the user's first role) and changed via [`/auth/switch-role`](#post-authswitch-role). It's persisted on the session, so it survives `/auth/refresh`.

Role-specific endpoint groups are **enforced by active context**, not just membership:

| Context (`active_role`) | Allowed endpoint groups |
|---|---|
| `worker` | `/worker/*`, `/shifts/*`, `/applications/*`, worker `/payments/*` (wallet, payouts) |
| `business` | `/business/*`, business `/payments/*` (complete, settle) |

`/disputes` (raise, list mine) and `/ratings` are party-based, not context-gated: any authenticated worker or business who is a party to the assignment may use them. `/disputes/admin/*` requires the `admin` role.

A dual-role user in the **wrong context** gets `403 Switch to your <role> account to use this feature` — call `/auth/switch-role` (which returns a fresh token), then retry. Admin endpoints (`/admin/*`) are membership-based and unaffected. Context-neutral endpoints (notifications, chat, realtime, upload) are not gated by context.

> Tokens minted before this rollout have no `active_role` claim; they fall back to membership checks until refreshed (≤15 min). No re-login required.

---

## Categories

Shared reference data — used by businesses when creating shifts (`category_id` is required) and by workers as a discovery filter.

### GET `/categories`

Returns all active categories for selection dropdowns. Requires auth; readable by any active role (worker, business, admin).

**Response `200`**
```json
{
  "success": true,
  "message": "Categories fetched",
  "data": [
    { "id": "uuid", "name": "Event Staff", "icon_url": null },
    { "id": "uuid", "name": "Restaurant Staff", "icon_url": null }
  ]
}
```

---

## Worker Profile

All endpoints require:
- `Authorization: Bearer <access_token>`
- Active context must be `worker` (see [Account context](#account-context-active-role))

---

### GET `/worker/profile`

Returns full worker profile including skills and preferred zones.

**Response `200`**
```json
{
  "success": true,
  "message": "Profile fetched",
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "full_name": null,
    "gender": null,
    "date_of_birth": null,
    "profile_picture": null,
    "availability_days": [],
    "availability_slots": [],
    "verification_status": "unverified",
    "reliability_score": 0,
    "worker_skills": [
      { "skill_id": "uuid", "skills": { "id": "uuid", "name": "Bartender" } }
    ],
    "worker_preferred_zones": [
      { "zone_id": "uuid", "zones": { "id": "uuid", "name": "Gulshan" } }
    ]
  }
}
```

---

### GET `/worker/skills`

Returns all active skills for onboarding selection dropdowns. Requires auth + `worker` role.

**Response `200`**
```json
{
  "success": true,
  "message": "Skills fetched",
  "data": [
    { "id": "uuid", "name": "Bartender", "category_id": "uuid" },
    { "id": "uuid", "name": "Waiter / Food Runner", "category_id": "uuid" }
  ]
}
```

---

### GET `/worker/zones`

Returns all active zones (with their city) for onboarding selection dropdowns. Requires auth + `worker` role.

**Query Params**

| Param | Type | Required | Notes |
|---|---|---|---|
| `city_id` | UUID | no | Scopes results to a single city |

**Response `200`**
```json
{
  "success": true,
  "message": "Zones fetched",
  "data": [
    { "id": "uuid", "name": "Gulshan", "city_id": "uuid", "cities": { "id": "uuid", "name": "Dhaka" } }
  ]
}
```

---

### PATCH `/worker/profile/basic` — Step 1 of 5 (20%)

Saves personal info and preferred work zones.

**Request Body**
```json
{
  "full_name": "Rahim Hossain",
  "gender": "male",
  "date_of_birth": "2000-05-15",
  "profile_picture": "https://cdn.example.com/avatars/rahim.jpg",
  "zone_ids": ["uuid-gulshan", "uuid-banani"]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `full_name` | string | yes | max 100 chars |
| `gender` | string | no | `male` · `female` · `other` · `prefer_not_to_say` |
| `date_of_birth` | string | no | `YYYY-MM-DD` format |
| `profile_picture` | string | no | URL — upload to cloud first, send URL here |
| `zone_ids` | UUID[] | no | IDs from zones table (Banani, Gulshan, Dhanmondi, Baridhara, Bashundhara, DOHS, Uttara, Mohakhali) |

**Response `200`**
```json
{
  "success": true,
  "message": "Basic info saved",
  "data": { "...updated worker_profile fields" }
}
```

**Error `400`** — invalid zone IDs
```json
{
  "success": false,
  "message": "One or more zone IDs are invalid"
}
```

---

### PATCH `/worker/profile/skills` — Step 2 of 5 (40%)

Replaces all worker skills. Send the full desired set each time.

**Request Body**
```json
{
  "skill_ids": ["uuid-waiter-food-runner", "uuid-cleaning-support"]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `skill_ids` | UUID[] | yes | Min 1. Replaces all previous skills. |

Available skills (fetch IDs from `GET /worker/skills`):

| Skill name |
|---|
| Waiter / Food Runner |
| Bartender |
| Promoter / Activation Crew |
| Event Support Staff |
| Production Assistant |
| Cleaning & Support Helper |
| Security Staff |
| Receptionist / Host |

**Response `200`**
```json
{
  "success": true,
  "message": "Skills saved",
  "data": { "...worker_profile with updated skills" }
}
```

**Error `400`** — invalid skill IDs
```json
{
  "success": false,
  "message": "One or more skill IDs are invalid"
}
```

---

### PATCH `/worker/profile/availability` — Step 3 of 5 (60%)

Saves availability schedule and refines preferred zones.

**Request Body**
```json
{
  "availability_days": ["weekdays"],
  "availability_slots": ["morning", "evening"],
  "zone_ids": ["uuid-gulshan", "uuid-bashundhara"]
}
```

| Field | Type | Required | Values |
|---|---|---|---|
| `availability_days` | string[] | yes | `weekdays` (Mon–Fri) · `weekends` (Sat–Sun) |
| `availability_slots` | string[] | yes | `morning` (6am–12pm) · `evening` (12pm–8pm) · `night` (8pm–2am) |
| `zone_ids` | UUID[] | no | Replaces preferred zones if provided |

**Response `200`**
```json
{
  "success": true,
  "message": "Availability saved",
  "data": { "...updated worker_profile fields" }
}
```

---

### PATCH `/worker/profile/documents` — Step 4 of 5 (80%)

Submits document URLs for admin KYC review. Sets `verification_status` to `pending`.

> **Upload flow:** Upload images directly to cloud storage from the frontend. Send the resulting URLs to this endpoint. Server stores URLs only.

**Request Body**
```json
{
  "nid_front_url": "https://cdn.example.com/docs/nid-front.jpg",
  "nid_back_url": "https://cdn.example.com/docs/nid-back.jpg",
  "selfie_url": "https://cdn.example.com/docs/selfie.jpg",
  "student_id_url": "https://cdn.example.com/docs/student-id.jpg"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `nid_front_url` | string | yes | URL to NID front photo |
| `nid_back_url` | string | yes | URL to NID back photo |
| `selfie_url` | string | yes | URL to live selfie photo |
| `student_id_url` | string | no | Optional — boosts credibility score |

**Response `200`**
```json
{
  "success": true,
  "message": "Documents submitted. Pending admin verification.",
  "data": { "...worker_profile with verification_status: 'pending'" }
}
```

**Error `400`** — already verified
```json
{
  "success": false,
  "message": "Profile already verified"
}
```

---

### Worker Onboarding Flow

```
Sign up (auth) → worker_profile stub auto-created
        │
        ▼
PATCH /worker/profile/basic        (Step 1 — name, gender, DOB, zones)
        │
        ▼
PATCH /worker/profile/skills       (Step 2 — select skills)
        │
        ▼
PATCH /worker/profile/availability (Step 3 — days, time slots, zones)
        │
        ▼
PATCH /worker/profile/documents    (Step 4 — NID + selfie URLs)
        │
        ▼
verification_status → "pending"
        │
        ▼ (admin approves)
verification_status → "verified"
reliability_score   → 5.0 (Beginner)
XP Earned          → 250 (Level 1)
        │
        ▼
Worker can now browse and apply for shifts
```

---

## Shifts (Discovery)

Worker-facing shift discovery feed and detail. All endpoints require:
- `Authorization: Bearer <access_token>`
- Active context must be `worker` (see [Account context](#account-context-active-role))

A shift appears in discovery while `shift_date` is today or later **and** it can still take workers: status `published`/`applications_open`, **or** status `worker_selected`/`worker_confirmed`/`checked_in`/`active` with open capacity (`hired_count < workers_needed`) — so a partially-staffed shift stays visible even after hiring started or the shift went live. A worker's **own business's** shifts are excluded from the feed, the dashboard counters, and cannot be applied to (a single user may hold both a worker and a business profile — same identity — but can't work their own posts; see the self-dealing `403` on [POST `/applications`](#post-applications)). Each shift carries computed slot counters:

| Field | Meaning |
|---|---|
| `filled` | Count of `accepted` applications |
| `capacity` | `workers_needed` |
| `is_full` | `filled >= capacity` |

---

### GET `/shifts/dashboard`

Personalized counters for the home screen.

**Response `200`**
```json
{
  "success": true,
  "message": "Dashboard fetched",
  "data": {
    "shifts_today": 4,
    "nearby": 7,
    "urgent": 2
  }
}
```

| Counter | Definition |
|---|---|
| `shifts_today` | Open shifts dated today |
| `nearby` | Open shifts in the worker's preferred zones (0 if none set) |
| `urgent` | Open shifts that are `instant` type or start within the next 2 days |

---

### GET `/shifts`

Paginated, filtered discovery feed.

**Query Parameters**

| Param | Type | Default | Values / Notes |
|---|---|---|---|
| `filter` | string | `all` | `all` · `nearby` · `urgent` · `high_pay` |
| `zone_id` | UUID | — | Restrict to a single zone |
| `category_id` | UUID | — | Restrict to a single category |
| `page` | int | `1` | ≥ 1 |
| `limit` | int | `10` | 1–50 |

Filter semantics:

| `filter` | Returns |
|---|---|
| `all` | All open shifts, soonest first |
| `nearby` | Shifts in the worker's preferred zones (empty result if the worker has none) |
| `urgent` | `instant` shifts or those starting within 2 days |
| `high_pay` | `pay_amount` ≥ ৳1000, highest pay first |

**Example**
```
GET /api/v1/shifts?filter=high_pay&page=1&limit=10
```

**Response `200`**
```json
{
  "success": true,
  "message": "Shifts fetched",
  "data": {
    "items": [
      {
        "id": "uuid",
        "title": "Waiter for Corporate Event",
        "description": "Evening banquet service",
        "role_type": "Waiter",
        "shift_type": "scheduled",
        "shift_date": "2026-06-20",
        "start_time": "1970-01-01T12:00:00.000Z",
        "end_time": "1970-01-01T20:00:00.000Z",
        "pay_amount": "1500",
        "currency": "BDT",
        "workers_needed": 8,
        "meal_included": true,
        "transport_support": false,
        "address": "Banani, Road 11",
        "landmark": "Next to the bank",
        "coordinates": { "latitude": 23.7937, "longitude": 90.4066 },
        "zone_id": "uuid",
        "status": "published",
        "business_profiles": { "id": "uuid", "business_name": "Sky Lounge", "logo_url": null },
        "categories": { "id": "uuid", "name": "Waiter" },
        "zones": { "id": "uuid", "name": "Banani" },
        "filled": 3,
        "capacity": 8,
        "is_full": false,
        "has_applied": false,
        "my_application": null
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 23, "total_pages": 3 }
  }
}
```

> `start_time` / `end_time` are time-only values returned as ISO timestamps on the `1970-01-01` epoch date — read the time portion only.
>
> **Timezone:** all shift dates/times are **Bangladesh local wall-clock (UTC+6)**. A shift saved as `18:18` means 6:18 PM BDT. The server converts these to real UTC when it checks the check-in/out window, cancellation timing, and expiry — so send/read them as local time, not UTC.
>
> `coordinates` is `{ latitude, longitude }` (WGS84) decoded from the PostGIS point, or `null` when the shift has no location set. Present on both the list and detail responses. On detail, the nested `business_profiles` carries its own `coordinates` in the same shape.
>
> `has_applied` / `my_application` reflect the **requesting worker's** own application on the shift. `my_application` is `{ id, status }` (status is any of the [application lifecycle](#applications) values, e.g. `pending`, `accepted`, `withdrawn`) or `null` if the worker never applied. When `has_applied` is `true` the apply button should be disabled — re-apply is rejected server-side (`409`), including after a withdrawal. Present on both list and detail.

**Error `422`** — invalid query param
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "msg": "Invalid filter", "path": "filter" }]
}
```

---

### GET `/shifts/:id`

Single shift detail. Includes richer business info (reliability + verification).

| Path param | Type | Notes |
|---|---|---|
| `id` | UUID | Shift ID |

**Errors:** `404 Shift not found` (unknown/deleted), `403 You can't view a shift posted by your own business account` (self-dealing — one identity may hold both profiles).

**Response `200`**
```json
{
  "success": true,
  "message": "Shift fetched",
  "data": {
    "id": "uuid",
    "title": "Waiter for Corporate Event",
    "description": "Evening banquet service",
    "shift_date": "2026-06-20",
    "start_time": "1970-01-01T12:00:00.000Z",
    "end_time": "1970-01-01T20:00:00.000Z",
    "pay_amount": "1500",
    "currency": "BDT",
    "workers_needed": 8,
    "meal_included": true,
    "transport_support": false,
    "coordinates": { "latitude": 23.7937, "longitude": 90.4066 },
    "status": "published",
    "business_profiles": {
      "id": "uuid",
      "business_name": "Sky Lounge",
      "logo_url": null,
      "reliability_score": "0",
      "verification_status": "verified",
      "coordinates": { "latitude": 23.7925, "longitude": 90.4078 }
    },
    "categories": { "id": "uuid", "name": "Waiter" },
    "zones": { "id": "uuid", "name": "Banani" },
    "filled": 3,
    "capacity": 8,
    "is_full": false,
    "has_applied": true,
    "my_application": { "id": "uuid", "status": "pending" }
  }
}
```

**Error `404`** — not found
```json
{
  "success": false,
  "message": "Shift not found"
}
```

---

## Applications

Worker applies to shifts and tracks application state. All endpoints require:
- `Authorization: Bearer <access_token>`
- Active context must be `worker` (see [Account context](#account-context-active-role))

`POST /applications` additionally requires an **admin-verified** worker profile (see [Verification Gate](#verification-gate)). Listing and withdrawing do not.

**Application status lifecycle**

| Status | Meaning |
|---|---|
| `pending` | Applied; awaiting business decision |
| `shortlisted` | Business is considering the worker |
| `accepted` | Selected — occupies a slot |
| `rejected` | Not selected |
| `withdrawn` | Worker pulled out — terminal, cannot re-apply to this shift |
| `no_show` | Accepted but did not attend |

---

### POST `/applications`

Apply to a shift. Requires a verified worker profile. A shift stays applyable until its end time as long as a slot is open — including after hiring started or the shift went live (a business may need to fill a spot mid-shift). On success the owning business is notified instantly (`notification:new`, `data.kind = "new_applicant"` with `shift_id` + `application_id`).

**Request Body**
```json
{
  "shift_id": "uuid",
  "note": "Available from 4pm, have my own black formal."
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `shift_id` | UUID | yes | Target shift |
| `note` | string | no | Optional message, ≤ 500 chars |

**Response `201`**
```json
{
  "success": true,
  "message": "Applied successfully",
  "data": {
    "id": "uuid",
    "shift_id": "uuid",
    "worker_profile_id": "uuid",
    "status": "pending",
    "note": "Available from 4pm, have my own black formal.",
    "applied_at": "2026-06-16T10:00:00.000Z"
  }
}
```

> Withdrawal is **terminal** — once a worker withdraws from a shift they cannot apply to it again.

**Errors**

| Code | Message | Cause |
|---|---|---|
| `403` | `Your worker profile must be verified by an admin first` | Profile not verified |
| `403` | `Complete your worker profile to continue` | No worker profile yet |
| `403` | `You can't apply to a shift posted by your own business account` | Self-dealing — the shift's owning user is you (one identity may hold both profiles) |
| `404` | `Shift not found` | Unknown/deleted shift |
| `409` | `This shift is not accepting applications` | Shift not in an applyable state (`published`/`applications_open`/`worker_selected`/`worker_confirmed`/`checked_in`/`active`) |
| `409` | `This shift has already ended` | The shift's end time has passed |
| `409` | `This shift is already full` | All slots accepted |
| `409` | `You have already applied to this shift` | Active application exists |
| `409` | `You have withdrawn from this shift and cannot apply again` | Prior withdrawal (terminal) |

---

### GET `/applications`

The worker's application tracker (Activity tab → Applications), newest first. Each item is enriched for the activity card: a derived `activity_status`, a contextual `message`, a `next_action`, and the shift's status `roadmap`.

**Query Parameters**

| Param | Type | Default | Values |
|---|---|---|---|
| `status` | string | — | `pending` · `shortlisted` · `accepted` · `rejected` · `withdrawn` · `no_show` (filters on the raw application status) |
| `page` | int | `1` | ≥ 1 |
| `limit` | int | `10` | 1–50 |

**Item fields (in addition to the raw application/shift):**

| Field | Notes |
|---|---|
| `activity_status` | Worker-facing state blending application + shift + handshake: `pending` · `shortlisted` · `upcoming` (hired, not yet checked in) · `in_progress` (checked in) · `awaiting_confirmation` (checked out, business confirm window open) · `confirm_needed` (business checked you out — confirm or dispute) · `disputed` (payment frozen for admin) · `no_show` (marked absent) · `completed` (handshake done / paid) · `not_selected` (rejected) · `withdrawn` · `cancelled` |
| `message` | Contextual copy for the card, e.g. `"Checked out — waiting for the business to confirm your payment."` |
| `next_action` | `check_in` · `check_out` · `confirm_checkout` · `raise_dispute` · `null` |
| `roadmap` | Shift status journey — `{ current, is_cancelled, is_draft, steps: [{ key, label, reached, current }] }` |

**Response `200`**
```json
{
  "success": true,
  "message": "Applications fetched",
  "data": {
    "items": [
      {
        "id": "uuid",
        "status": "accepted",
        "note": null,
        "applied_at": "2026-06-16T10:00:00.000Z",
        "activity_status": "upcoming",
        "message": "You got this shift! Get there on time for check-in.",
        "next_action": "check_in",
        "roadmap": {
          "current": "worker_confirmed",
          "is_cancelled": false,
          "is_draft": false,
          "steps": [{ "key": "published", "label": "Published", "reached": true, "current": false }]
        },
        "shifts": {
          "id": "uuid",
          "title": "Waiter for Corporate Event",
          "shift_date": "2026-06-20",
          "start_time": "1970-01-01T12:00:00.000Z",
          "end_time": "1970-01-01T20:00:00.000Z",
          "pay_amount": "1500",
          "status": "worker_confirmed",
          "business_profiles": { "business_name": "Sky Lounge", "logo_url": null },
          "zones": { "name": "Banani" }
        }
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 5, "total_pages": 1 }
  }
}
```

---

### GET `/applications/summary`

Activity-tab header counts. Role: `worker`.

**Response `200`**
```json
{
  "success": true,
  "message": "Activity summary fetched",
  "data": {
    "applications": {
      "total": 5,
      "active": 3,
      "by_status": { "pending": 1, "shortlisted": 1, "accepted": 1, "rejected": 1, "withdrawn": 1 }
    },
    "unread_notifications": 2
  }
}
```

`active` = `pending` + `shortlisted` + `accepted`. `404 Worker profile not found` if none.

---

### PATCH `/applications/:id/withdraw`

Withdraw an application. Allowed only while `pending` or `shortlisted`.

| Path param | Type | Notes |
|---|---|---|
| `id` | UUID | Application ID (must belong to the worker) |

**Response `200`**
```json
{
  "success": true,
  "message": "Application withdrawn",
  "data": { "id": "uuid", "status": "withdrawn" }
}
```

**Errors**

| Code | Message | Cause |
|---|---|---|
| `404` | `Application not found` | Not found or not owned by this worker |
| `409` | `Cannot withdraw an application in '<state>' state` | Already accepted/rejected/etc. |

---

### POST `/applications/:id/check-in`

Worker checks in to an **accepted** shift (live attendance). Requires an admin-verified worker profile. A `worker_assignments` row is created when the business accepts the applicant; check-in stamps it.

**Presence is always proven by the GPS geofence** — `coordinates` are required for every method and the worker must be within **200 m** of the shift location (PostGIS geofence). The methods differ only in the extra proof layered on top:
- **GPS** — geofence only.
- **QR** — geofence **plus** a live `qr_token`. The business displays a rotating on-site code (`checkin_code` from the [roster](#get-businessshiftsidroster)) which the worker scans. The code rotates every ~30 s, so a screenshotted/shared code expires almost immediately, and the geofence still blocks any off-site relay.

> `manual` is **not** worker-selectable — it is reserved as a business/admin override and rejected from this endpoint.

Allowed only within the shift window: from **30 min before** `start_time` until `end_time` (overnight shifts roll the end over a day).

| Path param | Type | Notes |
|---|---|---|
| `id` | UUID | Application ID (must belong to the worker) |

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `method` | string | yes | `gps` · `qr` |
| `coordinates` | object | always | `{ "latitude": number, "longitude": number, "accuracy"?: number }` |
| `coordinates.accuracy` | number | no | GPS accuracy in metres; rejected if worse than **100 m** |
| `qr_token` | string | if `qr` | Rotating code scanned from the business's roster screen |

```json
{ "method": "qr", "qr_token": "a1b2c3d4e5", "coordinates": { "latitude": 23.8103, "longitude": 90.4125, "accuracy": 12 } }
```

**Response `200`**
```json
{
  "success": true,
  "message": "Checked in",
  "data": { "id": "uuid", "checked_in_at": "2026-06-22T12:00:00.000Z", "checkin_method": "qr" }
}
```

**Errors**

| Code | Message | Cause |
|---|---|---|
| `404` | `Application not found` | Not found or not owned by this worker |
| `409` | `Only an accepted application can be checked in` | Application not in `accepted` |
| `409` | `No roster assignment found for this application` | Assignment row missing |
| `409` | `Cannot check in to a '<state>' shift` | Shift `cancelled`/`closed` |
| `409` | `You have already checked in` | Already checked in |
| `422` | `Check-in is only allowed within the shift's time window` | Outside [start − 30 min, end] |
| `422` | `You must be within 200m of the shift location` | Outside geofence |
| `422` | `Location accuracy is too low (±<n>m). Move to open sky and retry` | GPS accuracy worse than 100 m |
| `422` | `Invalid or expired check-in QR code` | `qr_token` does not match the current rotating code |
| `422` | `coordinates are required to check in` / `qr_token is required for QR check-in` | Missing method payload |

> On check-in the owning business is notified in real time with a `{ kind: "checkin" }` payload carrying the live `checked_in`/`needed` counts.

---

### POST `/applications/:id/check-out`

Worker checks out of a shift they previously checked into. Requires an admin-verified worker profile.

This is the **worker's half of the completion handshake**: the assignment moves to `worker_done` and the business gets a confirm window (`auto_confirm_at`, **12h**) to confirm or dispute. If the business does nothing, the handshake **auto-confirms at the deadline and the worker is paid** — nobody has to be on-site or online (the unsupervised path). The business is notified in real time (`{ kind: "worker_checkout" }`).

| Path param | Type | Notes |
|---|---|---|
| `id` | UUID | Application ID (must belong to the worker) |

**Response `200`**
```json
{
  "success": true,
  "message": "Checked out — awaiting business confirmation",
  "data": {
    "id": "uuid",
    "checked_out_at": "2026-06-22T20:00:00.000Z",
    "completion_status": "worker_done",
    "auto_confirm_at": "2026-06-23T08:00:00.000Z"
  }
}
```

**Errors**

| Code | Message | Cause |
|---|---|---|
| `404` | `Application not found` | Not found or not owned by this worker |
| `409` | `You have not checked in yet` | No prior check-in |
| `409` | `You have already checked out` | Already checked out |
| `409` | `This assignment is already '<status>'` | Handshake already past checkout (e.g. `disputed`) |

---

### POST `/applications/:id/confirm-checkout`

Worker confirms a **business-stamped** check-out (`business_done` → `confirmed`) — the worker's confirmation half when the business checked them out (forgotten checkout / early leave). Completes the handshake and **releases payment immediately**. Requires an admin-verified worker profile.

If the worker instead believes the check-out is wrong (e.g. checked out too early), they should raise a dispute (see [Disputes](#disputes)) — otherwise the handshake auto-confirms at `auto_confirm_at`.

| Path param | Type | Notes |
|---|---|---|
| `id` | UUID | Application ID (must belong to the worker) |

**Response `200`**
```json
{
  "success": true,
  "message": "Check-out confirmed — payment released",
  "data": {
    "id": "uuid",
    "completion_status": "confirmed",
    "paid_amount": "1500",
    "paid_at": "2026-06-22T20:05:00.000Z",
    "payment_status": "received"
  }
}
```

**Errors**

| Code | Message | Cause |
|---|---|---|
| `404` | `No roster assignment found for this application` | Not found / not owned |
| `409` | `There is no business check-out waiting for your confirmation` | Assignment is not in `business_done` |
| `409` | `This shift is under dispute — an admin will resolve it` | Frozen by a dispute |

> On confirmation the worker's wallet is credited the flat `pay_amount`, the shift's escrow slice is released, and the business is notified (`{ kind: "handshake_confirmed" }`).

---

## Business

Business-side endpoints: profile onboarding, shift management, applicant screening, and the home dashboard. All endpoints require:
- `Authorization: Bearer <access_token>`
- Active context must be `business` (see [Account context](#account-context-active-role)) — the `business` role is chosen on the role-select screen, added on first `business` OTP login

Base path: `/api/v1/business`. Onboarding and read endpoints do **not** require a verified profile — a business builds its profile and browses here. **Impactful actions require an admin-verified profile** (see the verification gate below).

> **Verification gate:** Onboarding (`POST/PATCH /business/profile*`) and all reads (`GET` profile, wallet, dashboard, shifts, applicants, roster) are open to an `unverified` business so it can complete its profile and submit documents. The following **require `verification_status = verified`** and otherwise return `403`:
> - `POST /business/wallet/topup`
> - `POST /business/shifts`, `PATCH /business/shifts/:id`, `PATCH /business/shifts/:id/publish`, `PATCH /business/shifts/:id/cancel`, `GET /business/shifts/:id/cancellation-preview`, `DELETE /business/shifts/:id`
> - `PATCH /business/applications/:id/{shortlist,accept,reject}`
> - `POST /payments/shifts/:shiftId/settle` (see [Payments](#payments))
>
> `403` body: `{ "success": false, "message": "Your business profile must be verified by an admin first" }` (or `"Complete your business profile to continue"` when no profile exists).

> **Shift moderation:** Submitting a shift does **not** make it instantly visible. It enters `pending_approval` and an admin must approve it (`pending_approval` → `published`) before workers can see/apply. Rejection returns it to `draft` for the business to edit and resubmit (see [Admin](#admin)).

### Shift status lifecycle
`draft` → `pending_approval` (submitted) → `published` (admin-approved, worker-visible) → `applications_open` → … On rejection a shift returns to `draft`.

### Verification states
`unverified` (default) → `pending` (documents submitted) → `verified` / `rejected` (admin decision). Mirrors the [Verification Gate](#verification-gate).

---

### GET `/business/profile`

Returns the full business profile (screen 17).

**Response `200`**
```json
{
  "success": true,
  "message": "Profile fetched",
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "business_name": "The Wedding Studio",
    "business_type": "Events & Wedding",
    "logo_url": "https://...",
    "manager_name": "Karim Ahmed",
    "manager_phone": "+8801712345678",
    "address": "House 12, Road 45, Gulshan-2",
    "landmark": "Near Gulshan Club",
    "coordinates": { "latitude": 23.7925, "longitude": 90.4078 },
    "zone_id": "uuid",
    "verification_status": "verified",
    "meal_included": true,
    "transport_support": true,
    "female_friendly": true,
    "uniform_required": false,
    "reliability_score": "0",
    "zones": { "id": "uuid", "name": "Gulshan" }
  }
}
```

> `coordinates` is `{ latitude, longitude }` (WGS84) decoded from the PostGIS point, or `null` when no location is set.

**Errors** — `404 Business profile not found`.

---

### POST `/business/profile`

Step 1 — creates the business profile (screen 3). One profile per user.

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `business_name` | string | ✅ | max 200 |
| `business_type` | string | — | max 100, e.g. `Restaurant & Cafe` |
| `manager_name` | string | — | max 100 |
| `manager_phone` | string | — | `+8801XXXXXXXXX` |
| `logo_url` | string (URL) | — | uploaded separately |

**Response `201`** — `"Business profile created"` with the created profile.

**Errors**

| Code | Message | Cause |
|---|---|---|
| `409` | `Business profile already exists` | Profile already created for this user |
| `422` | `Validation failed` | Invalid/missing fields |

---

### PATCH `/business/profile/location`

Step 2 — saves operating location and zone (screen 4).

**Body:** `zone_id` (UUID, optional), `address` (optional), `landmark` (optional).

**Response `200`** — `"Location saved"`. **Errors:** `400 Invalid zone`, `404`, `422`.

---

### PATCH `/business/profile/documents`

Step 3 — submits verification documents; moves `verification_status` to `pending` (screen 5). Required before the business can perform impactful actions (see the verification gate above).

Upload each file first via [`POST /upload/presign`](#post-uploadpresign) with `purpose` = `trade_license` or `business_doc`, push it to Cloudinary, then send the resulting `secure_url`(s) here.

**Body:** `trade_license_url` (URL), `business_doc_url` (URL) — at least one required.

**Response `200`** — `"Documents submitted. Pending admin verification."`

**Errors:** `400 Provide at least one verification document`, `400 Profile already verified`, `404`, `422`.

---

### PATCH `/business/profile/preferences`

Step 4 — perk/attire toggles shown to workers (screen 6).

**Body (all optional booleans):** `meal_included`, `transport_support`, `female_friendly`, `uniform_required`.

**Response `200`** — `"Preferences saved"`.

---

### GET `/business/wallet`

Business wallet snapshot — funds shift escrow. Auto-creates the wallet on first access (seeded ৳500). Role: `business`.

**Response `200`**
```json
{
  "success": true,
  "message": "Wallet fetched",
  "data": {
    "id": "uuid",
    "balance": "500.00",
    "held": "0.00",
    "total_spent": "0.00",
    "currency": "BDT"
  }
}
```
| Field | Meaning |
|---|---|
| `balance` | Spendable funds (can be escrowed into a new shift) |
| `held` | Currently escrowed across active/pending shifts |
| `total_spent` | Lifetime paid out to workers at settlement |

**Errors:** `404 Create your business profile first` (no profile yet).

---

### GET `/business/wallet/transactions`

Paginated business-wallet ledger (newest first) — the audit trail behind `balance`/`held`/`total_spent`. Every money move is recorded: top-up, escrow hold (shift submitted), escrow release at settlement (worker-payout spend + any remainder returned), escrow refund (cancel/reject), and cancellation-penalty spend. Role: `business` (read-only; verification not required).

**Query:** `page`, `limit` (≤50, default 20).

**Response `200`** (`data`):
```json
{
  "items": [
    {
      "id": "uuid",
      "type": "debit",
      "amount": "2400.00",
      "balance_after": "1100.00",
      "held_after": "2400.00",
      "description": "Escrow held: \"Evening waiter\"",
      "shift_id": "uuid",
      "reference_id": null,
      "created_at": "2026-07-07T10:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "total_pages": 1 }
}
```
| Field | Meaning |
|---|---|
| `type` | `credit` (funds in / returned) or `debit` (funds held or spent) |
| `balance_after` / `held_after` | Wallet spendable + escrowed balances **after** this entry |
| `shift_id` | The shift the move relates to (`null` for top-ups) |

**Errors:** `404 Create your business profile first` (no profile yet).

---

### POST `/business/wallet/topup`

Adds funds to the wallet's spendable `balance`. Role: `business`.

> **Placeholder funding.** The credit is applied **instantly** with no external capture. Real MFS corporate gateway authorization (bKash/Nagad) is wired in later; `method` is recorded for the log only.

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `amount` | number | ✅ | > 0, minimum **৳100** |
| `method` | enum | — | `bkash` \| `nagad` \| `bank_transfer` |

**Response `200`** — `"Wallet topped up"`, with the updated wallet (same shape as GET).

**Errors**

| Code | Message | Cause |
|---|---|---|
| `400` | `Minimum top-up is ৳100` | `amount` below minimum |
| `404` | `Create your business profile first` | No business profile yet |
| `422` | `Validation failed` | Invalid/missing fields |

---

### GET `/business/dashboard`

Home dashboard counters (screen 8).

**Response `200`**
```json
{
  "success": true,
  "message": "Dashboard fetched",
  "data": {
    "active_shifts": 3,
    "total_shifts": 12,
    "applicants_waiting": 5,
    "urgent_staffing": 2,
    "fill_rate": 87
  }
}
```
- `active_shifts` — shifts in `published`/`applications_open`.
- `total_shifts` — all non-deleted shifts.
- `applicants_waiting` — `pending` + `shortlisted` applicants across all shifts.
- `urgent_staffing` — active shifts not yet fully hired.
- `fill_rate` — hired ÷ needed across active shifts (percent).

---

> **Escrow gate (screen 7).** Submitting a shift for review reserves its **full cost — worker pay + 10% platform fee** (`pay_amount × workers_needed × 1.10`, i.e. `total_cost` in the breakdown) — from the business wallet: `balance` moves into `held`. The submit is rejected with `402` if the wallet can't cover it. Drafts hold nothing. The hold is **refunded in full** if the shift is cancelled, its post is rejected, or it expires with nobody hired. It is **released slice by slice** as each worker's completion handshake finishes: the worker payout plus the platform fee (proportional to what was actually paid — no work, no fee) become spend, the slot remainder returns to `balance`, and when the last handshake resolves the leftover (unfilled slots) is returned. A new business wallet is auto-created on first access/submit, seeded with a starting balance of **৳500**. Read it via [GET `/business/wallet`](#get-businesswallet) and add funds via [POST `/business/wallet/topup`](#post-businesswallettopup) — top-up is currently an **instant manual credit** (no external capture); real MFS corporate gateway authorization is wired in later.

### POST `/business/shifts`

Creates a shift (create-shift wizard, screens 9–11). Submits it for admin review (`pending_approval`) unless `draft: true`. A shift becomes worker-visible only after an admin approves it. Submitting (not `draft`) **escrows the shift cost** — see the note above.

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | ✅ | max 200 |
| `category_id` | UUID | ✅ | must be an active category |
| `shift_type` | enum | ✅ | `instant` \| `scheduled` \| `prebooked` |
| `shift_date` | date | ✅ | `YYYY-MM-DD`, not in the past |
| `start_time` | string | ✅ | `HH:MM` (24h) |
| `end_time` | string | ✅ | `HH:MM` (24h) |
| `pay_amount` | number | ✅ | flat pay per worker (BDT), > 0 |
| `workers_needed` | int | ✅ | ≥ 1 |
| `role_type` | string | — | max 100, e.g. `Waiter` |
| `description` | string | — | |
| `gender_preference` | enum | — | `male` \| `female` \| `other` \| `prefer_not_to_say` |
| `meal_included` | bool | — | benefit, default `false` |
| `transport_support` | bool | — | benefit, default `false` |
| `uniform_provided` | bool | — | benefit, default `false` |
| `tips_expected` | bool | — | benefit, default `false` |
| `experience_required` | bool | — | requirement, default `false` |
| `languages` | string[] | — | requirement; up to 10, each 1–50 chars |
| `customer_facing` | bool | — | requirement, default `false` |
| `reporting_details` | string | — | on-site instructions, max 1000 |
| `dress_code` | string | — | on-site instructions, max 500 |
| `manager_contact` | string | — | max 20; defaults to the business profile's `manager_phone` |
| `is_urgent` | bool | — | emergency staffing flag, default `false` |
| `zone_id` | UUID | — | defaults to the business profile's zone |
| `address` | string | — | defaults to the business profile address |
| `landmark` | string | — | defaults to the business profile landmark |
| `latitude` | number | — | map pin, −90..90; **must be sent with `longitude`**. Omitted → falls back to the business location |
| `longitude` | number | — | map pin, −180..180; must be sent with `latitude` |
| `draft` | bool | — | `true` saves as `draft` instead of submitting for review |
| `allow_duplicate` | bool | — | `true` bypasses the near-duplicate guard (see `409` below) |

**Response `201`** — `"Shift submitted for admin review"` (status `pending_approval`) or `"Shift saved as draft"` (status `draft`), with the created shift (including its `cost_breakdown`, see GET below).

**Errors**

| Code | Message | Cause |
|---|---|---|
| `400` | `Invalid category` / `Invalid zone` | Reference id not found/inactive |
| `400` | `Shift date cannot be in the past` | `shift_date` < today |
| `402` | `Insufficient wallet balance to publish this shift. …` | Wallet can't cover the escrow (only when not `draft`) |
| `404` | `Create your business profile first` | No business profile yet |
| `409` | `You already have a similar shift … Resubmit with allow_duplicate=true …` | Same category + date + start time as a live shift; resend with `allow_duplicate: true` |
| `422` | `Validation failed` (incl. `end_time must be after start_time`) | Invalid/missing fields, or `end_time` ≤ `start_time` |

---

### GET `/business/shifts`

Lists the business's own shifts, paginated, newest first.

**Query:** `status` (any shift status), `page` (default 1), `limit` (default 10, max 50).

**Response `200`** — `{ items: [...], pagination: {...} }`. Each item carries `filled`, `capacity`, `is_full`, `applicants_waiting`, `is_editable`, `is_large_request`, and `cost_breakdown`.

---

### GET `/business/shifts/:id`

Single owned-shift detail with staffing counters (screens 13–14). `404 Shift not found` if missing or not owned.

Counters on the returned shift:
- `filled` — workers hired (accepted) · `capacity` — `workers_needed` · `is_full`
- `applicants_waiting` — pending + shortlisted applicants
- `is_editable` — `true` only while the shift is `draft`/`published`/`applications_open` **and** nobody is hired yet. Use it to show/hide the edit button; the journey bar is driven by `status`.
- `is_large_request` — `true` when `workers_needed` exceeds the large-request threshold (20)
- `cost_breakdown` — `{ worker_pay, workers_needed, total_worker_pay, platform_fee, total_cost }` for the compensation screen. `platform_fee` is 10% of total worker pay; **`total_cost` (pay + fee) is what gets escrowed at submit**. The fee is captured per worker slot at payout time, proportional to what was actually paid — no-shows and denied disputes incur no fee.
- `coordinates` — `{ latitude, longitude }` map pin, or `null` if unset (detail only, not on the list).
- `roadmap` — status journey bar (detail only): `{ current, is_cancelled, is_draft, steps: [{ key, label, reached, current }] }`, built from the shift's status against `shift_status_enum`. Auto-advances as the shift progresses — see below.

#### Shift status lifecycle

`status` auto-advances (forward-only — never rewinds) as lifecycle events complete, so the detail page and the journey bar always reflect reality without a manual refresh of state:

| Event | `status` becomes |
|---|---|
| Business publishes | `pending_approval` |
| Admin approves | `published` |
| First applicant hired | `worker_selected` |
| Last open slot hired (fully staffed) | `worker_confirmed` |
| First worker checks in | `checked_in` |
| All hired workers checked in | `active` |
| Last checked-in worker checks out **after** the shift window ends (or the sweeper closes attendance on an ended shift) | `completed` |
| Settle/finalize hits open disputes | `payment_pending` (parks until the admin rules) |
| Every assignment's handshake resolved (paid / no-show / dispute ruled) | `closed` (leftover escrow returned) |
| Business cancels | `cancelled` (off-path) |
| Shift ends with **zero hires** (`pending_approval`/`published`/`applications_open`) | `cancelled` — auto-expired by the sweeper, full escrow refunded, business notified |

A transition only fires when it moves the shift **forward**, so skipped/duplicate/concurrent events are safe. `POST /payments/shifts/:id/complete` is a manual fallback for the `completed` step; the shift **closes automatically** once the last completion handshake resolves — the business does not have to call settle at all (see [Completion handshake](#completion-handshake--how-a-worker-gets-paid)).

---

### PATCH `/business/shifts/:id`

Edits an owned shift. Allowed only while `draft`/`published`/`applications_open` **and before any worker is hired** (mirrors `is_editable`). Body accepts the same (optional) fields as create except `draft` and `allow_duplicate`. Editing `pay_amount`/`workers_needed` recomputes `platform_fee` (the escrow hold is unchanged). Sending `latitude`+`longitude` moves the map pin.

**Errors:** `409 A '<state>' shift can no longer be edited`, `409 This shift can no longer be edited — a worker has already been hired`, `400` (invalid refs/date), `404`, `422` (incl. `end_time must be after start_time`).

---

### PATCH `/business/shifts/:id/publish`

Submits a draft shift for admin review (`draft` → `pending_approval`). It becomes worker-visible only after an admin approves it. **Escrows the shift cost** from the business wallet (see the escrow note above).

**Response `200`** — `"Shift submitted for admin review"`.

**Errors:** `409 Only draft shifts can be submitted`, `402 Insufficient wallet balance to publish this shift. …`, `404`.

---

### Deleting / cancelling a shift (with worker compensation)

Removing a posted shift is a **delete** (`DELETE /business/shifts/:id`); the frontend "swipe left" gesture first calls the **preview** to show a charge modal. Whether money moves depends on the shift state:

**Free** (full escrow refunded, shift soft-deleted) when any of:
- nobody is hired yet, **or**
- the shift has **expired** (its time window passed and nobody checked in), **or**
- it is a `scheduled`/`prebooked` shift cancelled **more than `CANCEL_FREE_NOTICE_HOURS` (24h)** before start.

**Penalty** (each hired worker is paid `pay_amount × rate` compensation from escrow, the remainder returns to the business) when a shift with hired workers is cancelled **inside** the 24h notice window, or an `instant` shift is cancelled at any time before it expires.

The per-worker **rate** ∈ `[0.10, 0.75]` is a timing base (how close to start; instant floors higher) plus four capped adjustments — hiring duration, worker reliability, business reliability, and demand (applicants ÷ slots). Every weight/bound is a constant in `src/constants.js`; the breakdown (`factors`) is returned so the modal can explain the charge. Compensation is credited to each worker's wallet with a ledger entry and a real-time notification, mirroring settlement.

#### GET `/business/shifts/:id/cancellation-preview`

Dry-run breakdown for the swipe-to-delete modal. Moves no money. Role: `business`, **verified**.

**Response `200`** (`data`):
```json
{
  "shift_id": "uuid",
  "title": "Evening waiter",
  "status": "worker_confirmed",
  "free": false,
  "penalty_applies": true,
  "reason": "penalty",
  "is_expired": false,
  "hours_to_start": 8.0,
  "hired_count": 2,
  "escrow_amount": "2400.00",
  "refund_to_business": "1000.00",
  "penalty": {
    "total_penalty": "1400.00",
    "shift_factors": { "base": 0.4333, "business_reliability": 0.04, "demand": 0.0333 },
    "workers": [
      {
        "worker_profile_id": "uuid",
        "full_name": "R12 A",
        "rate": 0.6367,
        "amount": "700.00",
        "factors": { "base": 0.4333, "duration": 0.05, "worker_reliability": 0.08, "business_reliability": 0.04, "demand": 0.0333 }
      }
    ]
  }
}
```
For a free delete, `penalty` is `null`, `free` is `true`, `reason` is one of `no_workers_hired` / `shift_expired` / `outside_notice_window`, and `refund_to_business` equals `escrow_amount`.

**Errors:** `409 A '<state>' shift cannot be cancelled` (from `completed`/`payment_pending`/`paid`/`closed`/`cancelled`), `404`, `422`.

#### DELETE `/business/shifts/:id`

Executes the delete/cancel. Role: `business`, **verified**. **Body:** `reason` (optional, max 500), `acknowledge_penalty` (boolean).

- Free case → refunds escrow, soft-deletes the shift, notifies any workers. Response `200` `"Shift deleted"`.
- Penalty case → **requires `acknowledge_penalty: true`**. Without it, returns **`409` `Cancellation penalty must be acknowledged before deleting this shift`** with the full breakdown in `errors` (the same shape as the preview `data`) so the modal can confirm. With it, pays the workers, returns the remainder, soft-deletes, and responds `200` `"Shift cancelled and workers compensated"` with the applied breakdown.

**Errors:** `409` (penalty not acknowledged — carries the breakdown), `409 A '<state>' shift cannot be cancelled`, `404`, `422`.

### PATCH `/business/shifts/:id/cancel`

Legacy cancel path. **Body:** `reason` (required, max 500). Delegates to the delete flow with the penalty **pre-acknowledged** — so a hired shift now **compensates workers** (same engine as above) instead of refunding the business in full. Returns the breakdown `data`. Prefer `DELETE /business/shifts/:id` for new clients (it surfaces the charge for confirmation first).

**Errors:** `409 A '<state>' shift cannot be cancelled` (from `completed`/`payment_pending`/`paid`/`closed`/`cancelled`), `404`, `422`.

---

### GET `/business/shifts/:id/applicants`

Applicants for an owned shift, with worker reputation telemetry (screens 9, 15).

**Query:** `status` (any application status), `page`, `limit`.

**Response `200`**
```json
{
  "success": true,
  "message": "Applicants fetched",
  "data": {
    "items": [
      {
        "id": "uuid",
        "status": "pending",
        "applied_at": "2026-06-17T10:00:00.000Z",
        "note": null,
        "worker_profiles": {
          "id": "uuid",
          "full_name": "Rahim Hossain",
          "profile_picture": "https://...",
          "verification_status": "verified",
          "reliability_score": "94",
          "attendance_rate": "96",
          "completion_rate": "98",
          "no_show_count": 0,
          "completed_shift_count": 23
        }
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 3, "total_pages": 1 }
  }
}
```

**Errors:** `404 Shift not found`, `422`.

---

### PATCH `/business/applications/:id/shortlist`

Shortlists an applicant (`pending` → `shortlisted`). Notifies the worker.

### PATCH `/business/applications/:id/unshortlist`

Reverts a shortlisted applicant back to `pending` (un-shortlist toggle). No notification. `409` if the applicant is not currently `shortlisted`.

### PATCH `/business/applications/:id/accept`

Hires an applicant from `pending` **or** `shortlisted` (→ `accepted`). Enforces the shift's worker capacity. Notifies the worker. (This is also "promote a shortlisted applicant to hire".)

### PATCH `/business/applications/:id/reject`

Rejects an applicant (→ `rejected`). Notifies the worker.

**Applicant-decision errors (all four)**

| Code | Message | Cause |
|---|---|---|
| `404` | `Applicant not found` | Application missing or not on a shift owned by this business |
| `403` | `You can't hire or screen your own worker profile` | Self-dealing — the applicant is your own worker profile |
| `409` | `This applicant is already '<state>'` | Already `accepted`/`rejected`/`withdrawn`/etc. |
| `409` | `Only a shortlisted applicant can be moved back to pending …` | (unshortlist only) applicant is not `shortlisted` |
| `409` | `This shift is already fully staffed` | (accept only) hired count reached `workers_needed` |

---

### POST `/business/shifts/:id/applicants/bulk`

Bulk-shortlist or bulk-reject applicants on an owned shift in one call. Role: `business`, **admin-verified**. Only still-decidable (`pending`/`shortlisted`) applicants that belong to this shift are touched; already-decided or foreign ids — and the caller's **own** worker profile (self-dealing) — are silently skipped and counted. Notifies each affected worker. Hiring is intentionally **not** a bulk action (capacity is enforced per-slot via `accept`).

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `action` | enum | ✅ | `shortlist` \| `reject` |
| `application_ids` | UUID[] | ✅ | 1–100 ids |

**Response `200`** — `{ action, requested, updated, skipped }`.

**Errors:** `404 Shift not found`, `422` (bad `action`/ids).

> Accepting an applicant also creates their `worker_assignments` row, which is what the [live-attendance roster](#get-businessshiftsidroster) tracks.

---

### GET `/business/shifts/:id/roster`

Live-attendance roster for an owned shift — every hired worker with their derived check-in state, plus the rotating `checkin_code` the business renders as a QR on-site for worker check-in.

| Path param | Type | Notes |
|---|---|---|
| `id` | UUID | Shift ID (must be owned by this business) |

Per-worker `status` blends attendance and the completion handshake: `waiting` (hired, not yet arrived) → `checked_in` → `checked_out` → `awaiting_business_confirm` (worker checked out — confirm or dispute) / `awaiting_worker_confirm` (you stamped the check-out) → `paid`; off-path: `no_show`, `disputed`.

`next_action` tells the business what it can do on the row: `confirm_checkout` (pay the worker), `checkout` (stamp a forgotten check-out), `mark_no_show` (absentee), or `null`.

> `checkin_code` is a short-lived rotating code derived server-side from the shift's secret (the secret itself is never returned). It rotates every ~30 s; re-fetch the roster before `checkin_code_expires_in` (seconds) elapses to refresh the displayed QR.

**Response `200`**
```json
{
  "success": true,
  "message": "Roster fetched",
  "data": {
    "shift": {
      "id": "uuid",
      "title": "Waiter for Corporate Event",
      "status": "published",
      "shift_date": "2026-06-22",
      "start_time": "1970-01-01T12:00:00.000Z",
      "end_time": "1970-01-01T20:00:00.000Z",
      "workers_needed": 5
    },
    "checkin_code": "a1b2c3d4e5",
    "checkin_code_expires_in": 18,
    "summary": { "needed": 5, "assigned": 4, "checked_in": 2 },
    "roster": [
      {
        "assignment_id": "uuid",
        "application_id": "uuid",
        "worker": { "id": "uuid", "full_name": "Rahim Hossain", "profile_picture": "https://...", "reliability_score": "94" },
        "status": "awaiting_business_confirm",
        "checked_in_at": "2026-06-22T12:00:00.000Z",
        "checked_out_at": "2026-06-22T20:00:00.000Z",
        "checkin_method": "gps",
        "completion_status": "worker_done",
        "auto_confirm_at": "2026-06-23T08:00:00.000Z",
        "paid_amount": null,
        "paid_at": null,
        "next_action": "confirm_checkout"
      }
    ]
  }
}
```

**Errors:** `404 Shift not found` (missing or not owned), `422`.

---

### Completion handshake — how a worker gets paid

Every hired worker's payment goes through a **two-sided handshake** on their roster assignment. Money moves **per worker** the moment their handshake completes — not in one shift-level batch.

```
worker checks out ────────────► worker_done ──┐
                                              ├─ business confirms ─► confirmed → WORKER PAID
business stamps check-out ────► business_done─┤   worker confirms  ─► confirmed → WORKER PAID
                                              └─ 12h pass, no action ► auto-confirmed → WORKER PAID
either side objects at any point before payment ──► disputed (frozen) ─► admin rules → resolved
worker never arrives ─────────► no_show (escrow slice returned; worker may dispute)
```

- **Supervised:** worker checks out on-site → business taps **confirm** on the roster → paid instantly.
- **Unsupervised:** nobody has to act. A background sweeper (every 10 min) expires ended shifts nobody was hired for (full refund), auto-checks-out workers when the shift window ends, auto-confirms handshakes 12h after check-out, marks absentees no-show, and closes the shift — payment is guaranteed even if the business never opens the app.
- Each payment releases that worker's **escrow slice** (`pay_amount` + its platform fee): the worker payout and the fee (10%, proportional to what was paid) become business spend, any remainder returns to the business wallet. When the last handshake resolves the shift **auto-finalizes**: leftover escrow (unfilled slots) is returned and the shift closes.
- Completed handshakes unlock **ratings** in both directions (see [Ratings](#ratings)); both parties get a `rate_prompt` nudge.

### POST `/business/assignments/:id/checkout`

Business stamps a check-out for a worker who forgot to check out (or left early). Opens the **worker's** confirm window: the worker confirms (paid instantly), disputes, or the handshake auto-confirms after 12h. No money moves yet. Role: `business`, **admin-verified**.

| Path param | Type | Notes |
|---|---|---|
| `id` | UUID | Assignment ID (from the roster; shift must be owned) |

**Response `200`** — `"Worker checked out — awaiting worker confirmation"`, data: the updated assignment (`completion_status: "business_done"`, `auto_confirm_at`).

**Errors**

| Code | Message | Cause |
|---|---|---|
| `404` | `Assignment not found` | Missing / not on an owned shift |
| `409` | `This worker never checked in` | No check-in to close |
| `409` | `This worker has already checked out` | Check-out already stamped |
| `409` | `This assignment is already '<status>'` | Handshake already past checkout |
| `409` | `This shift was cancelled` | Cancelled shift |

### POST `/business/assignments/:id/confirm`

Business confirms a worker's check-out (`worker_done` → `confirmed`) — the business's half of the handshake. **Pays the worker the flat `pay_amount` immediately** and releases the escrow slice. Role: `business`, **admin-verified**.

**Response `200`** — `"Check-out confirmed — worker paid"`, data: the paid assignment (`completion_status: "confirmed"`, `paid_amount`, `paid_at`).

**Errors:** `404`; `409 There is no worker check-out waiting for your confirmation` (not `worker_done`); `409 This assignment is under dispute — an admin will resolve it`.

### POST `/business/assignments/:id/no-show`

Marks a hired worker who never checked in as absent, once the shift has started: application + assignment flip to `no_show`, the worker's `no_show_count` increments, and the slot's escrow slice returns to the business wallet. The worker is notified and **may dispute** (an admin ruling can overturn it and pay from the business balance). Role: `business`, **admin-verified**.

**Response `200`** — `"Worker marked as no-show"`.

**Errors:** `404`; `409 This worker has checked in — they are not a no-show`; `409 The shift has not started yet`; `409 This assignment is already '<status>'`.

---

## Real-time (Socket.IO)

A Socket.IO server shares the same host/port as the REST API (path `/socket.io`). It pushes notifications to users the moment they are created, so clients get a live badge/feed without polling.

### Connect

The socket does **not** accept the REST access token. Instead, mint a short-lived, single-purpose **socket ticket** via [`POST /realtime/ticket`](#post-realtimeticket) and pass it in the handshake `auth.token`. The access token stays in the BFF/cookie and never reaches the browser. Sockets without a valid ticket are rejected with `connect_error`.

```js
import { io } from "socket.io-client";

// BFF proxies POST /realtime/ticket with the user's Bearer access token
const { ticket } = await fetchSocketTicket();

const socket = io("https://api.workforce.bd", {
  auth: { token: ticket }, // socket ticket, NOT the access token
});

socket.on("connect", () => console.log("connected"));
socket.on("connect_error", (err) => console.error(err.message)); // "Invalid or expired ticket"
```

The ticket is valid for ~60s and is consumed at handshake only — once connected, the socket stays up independent of ticket expiry. Fetch a fresh ticket before every (re)connect.

#### POST `/realtime/ticket`

Mints a socket ticket for the authenticated caller. Requires `Authorization: Bearer <access_token>` (any role).

**Response `201`**
```json
{
  "success": true,
  "message": "Socket ticket issued",
  "data": { "ticket": "<jwt>", "expires_in": 60 }
}
```

The ticket is a JWT scoped to the `socket` audience — it cannot call REST endpoints and cannot be refreshed. `expires_in` is seconds. It also captures the caller's **active role** at mint time, so socket chat (`chat:send` / `chat:read`) stays scoped to the same side as REST. After switching role, mint a fresh ticket and reconnect to chat as the other side.

**Errors:** `401 Authorization token required` (missing/invalid access token).

On connect, the socket auto-joins a private room (`user:<id>`) — events are delivered to **all** of that user's open tabs/devices. There is nothing to subscribe to manually.

### Events (server → client)

| Event | Payload | When |
|---|---|---|
| `notification:new` | `{ notification, unread_count }` | Any new notification for this user (new applicant, verification decision, hire/reject, shift moderation, …) |
| `chat:message` | `{ conversation_id, message }` | The counterpart sent a new chat message in a conversation this user is in |
| `chat:read` | `{ conversation_id, reader_role, read_at, count }` | The counterpart opened/marked the thread read — update your sent-message read receipts |

`notification` matches the shape returned by `GET /notifications`. `unread_count` is the user's fresh total — bind it straight to the badge. `message` matches an item from `GET /chat/conversations/:id/messages`; see [Chat](#chat).

`chat:message` is delivered to **both** participants — the recipient sees it arrive, and the sender's other tabs/devices stay in sync. Dedupe by `message.id` (the originating client also has it from the REST response or socket ack).

```js
socket.on("notification:new", ({ notification, unread_count }) => {
  showToast(notification.title, notification.body);
  setBadge(unread_count);
});

socket.on("chat:message", ({ conversation_id, message }) => upsertMessage(conversation_id, message)); // dedupe by message.id
socket.on("chat:read", ({ conversation_id, read_at }) => markSentAsRead(conversation_id, read_at));
```

### Events (client → server)

Chat can also be **sent over the socket** (lower latency than REST, same service logic and auth). Each event takes an optional ack callback that resolves with the result.

| Event | Payload | Ack |
|---|---|---|
| `chat:send` | `{ conversation_id, body }` | `{ ok: true, message }` or `{ ok: false, error }` |
| `chat:read` | `{ conversation_id }` | `{ ok: true, updated }` or `{ ok: false, error }` |

```js
socket.emit("chat:send", { conversation_id, body: "On my way" }, (res) => {
  if (!res.ok) return showError(res.error);   // e.g. "Conversation not found", body too long
  appendOwnMessage(res.message);              // server-confirmed message (has id, created_at)
});
```

Same participant + length checks as the REST endpoints. `body` is 1–2000 chars (trimmed); an invalid/foreign `conversation_id` returns `{ ok: false, error: "Conversation not found" }`. The persisted message is broadcast via `chat:message` to both sides as above. REST (`POST /chat/conversations/:id/messages`) remains available and equivalent — pick one per client.

### Notes
- **Auth expiry:** the ticket is verified once at handshake; an active connection survives ticket expiry. On reconnect, fetch a fresh ticket first (`socket.auth.token = await fetchSocketTicket(); socket.disconnect().connect()`). Access-token refresh does not require a socket reconnect.
- **REST stays the source of truth.** Use the socket for live delivery; on app open still call `GET /notifications` / `GET /notifications/unread-count` to backfill anything missed while offline.
- **Reconnection** is automatic (Socket.IO default). Missed events while disconnected are recovered via the REST backfill, not replayed.
- **Scaling:** a single-instance setup needs no extra infra. Behind multiple Node instances, add the Socket.IO Redis adapter (and Nginx sticky sessions / WebSocket upgrade) so emits reach rooms on every instance.

---

## Notifications

In-app notification feed for the authenticated user (worker, business, or admin). Notifications are generated by other modules — verification decisions, hire/reject decisions, shift moderation, etc. Screens 11–12. Every newly created notification is also pushed live over [Socket.IO](#real-time-socketio).

Base path: `/api/v1/notifications`. Requires `Authorization: Bearer <access_token>` (any role). Every endpoint is scoped to the caller's own `user_id`.

Each notification carries: `id`, `type` (`in_app` · `push` · `sms`), `priority` (`low` · `normal` · `high` · `urgent`), `title`, `body`, `data` (JSON payload with a `kind` discriminator, e.g. `verification_decision`, `application_decision`, `shift_moderation`), `is_read`, `read_at`, `created_at`.

---

### GET `/notifications`

Paginated feed, newest first.

| Param | In | Type | Required | Notes |
|---|---|---|---|---|
| `unread` | query | bool | — | `true` returns only unread |
| `page` | query | int | — | default 1 |
| `limit` | query | int | — | default 20, max 50 |

**Response `200`**
```json
{
  "success": true,
  "message": "Notifications fetched",
  "data": {
    "items": [
      {
        "id": "uuid",
        "type": "in_app",
        "priority": "high",
        "title": "You're hired!",
        "body": "You have been hired for \"Banquet Waiters Needed\". Check your shifts for details.",
        "data": { "kind": "application_decision", "status": "accepted" },
        "is_read": false,
        "read_at": null,
        "created_at": "2026-06-17T10:05:00.000Z"
      }
    ],
    "unread_count": 2,
    "pagination": { "page": 1, "limit": 20, "total": 7, "total_pages": 1 }
  }
}
```

---

### GET `/notifications/unread-count`

Badge count.

**Response `200`** — `{ "data": { "unread_count": 2 } }`.

---

### PATCH `/notifications/read-all`

Marks every unread notification as read.

**Response `200`** — `{ "data": { "updated": 2 } }`.

---

### PATCH `/notifications/:id/read`

Marks a single owned notification as read (idempotent).

**Response `200`** — the updated notification.

**Errors:** `404 Notification not found` (missing or not owned), `422` (invalid id).

---

## Chat

Direct messaging between a worker and a business, **scoped per shift**. A conversation is keyed by `(shift_id, worker_profile_id)` — one thread per worker per shift — and the business side is derived from the shift's owner. New messages and read receipts are pushed live over [Socket.IO](#real-time-socketio) (`chat:message`, `chat:read`); REST stays the source of truth for history and backfill.

Base path: `/api/v1/chat`. Requires `Authorization: Bearer <access_token>`. Every endpoint resolves the caller's **side** (`worker` or `business`) from their profile and rejects non-participants.

**Scoped to the active account context.** A user who holds both a worker and a business profile sees **only** the conversations for their currently active role — worker chats and business chats are separate inboxes. The inbox listing, the unread badge, and per-conversation access (open / messages / send / read) are all filtered by the `active_role` of the access token; a worker-context request that targets a business-side conversation gets `404 Conversation not found` (and vice versa). Switch role (`POST /auth/switch-role`) to see the other side. Legacy tokens minted before `active_role` existed fall back to a merged view until refreshed.

**Access gate:** a conversation can only be opened once an **application exists** for that `(shift, worker)` pair (any status — `pending`…`withdrawn`). No cold-messaging. Because applying requires a verified worker and posting a shift requires a verified business, both participants are implicitly verified.

A `message` carries: `id`, `conversation_id`, `sender_user_id`, `sender_role` (`worker` · `business`), `body`, `read_at` (null until the recipient reads it), `created_at`.

A `conversation` is returned from the **viewer's perspective**: `id`, `side` (the caller's role), `shift` (`{ id, title, shift_date }`), `counterpart` (`{ type, id, name, avatar }`), `last_message` (`{ text, at, sender_role }` or null), `unread_count`, `created_at`.

---

### POST `/chat/conversations`

Opens — or returns the existing — conversation for a `(shift, worker)` pair. Idempotent: calling again returns the same thread. A worker caller opens their own thread (`worker_profile_id` is ignored); a business caller must own the shift and name the worker via `worker_profile_id`.

| Field | In | Type | Required | Notes |
|---|---|---|---|---|
| `shift_id` | body | uuid | yes | The shift the thread is scoped to |
| `worker_profile_id` | body | uuid | business only | Required when the caller is the shift's business; ignored for a worker caller |

**Response `200`**
```json
{
  "success": true,
  "message": "Conversation ready",
  "data": {
    "id": "uuid",
    "side": "worker",
    "shift": { "id": "uuid", "title": "Banquet Waiters Needed", "shift_date": "2026-06-30" },
    "counterpart": { "type": "business", "id": "uuid", "name": "Grand Palace", "avatar": "https://…" },
    "last_message": null,
    "unread_count": 0,
    "created_at": "2026-06-26T09:00:00.000Z"
  }
}
```

**Errors:** `404 Shift not found`; `403 You are not a participant of this shift`; `403 A conversation is only available after the worker applies to this shift` (no application gate); `422` (`worker_profile_id is required to message a worker`, or invalid body).

---

### GET `/chat/conversations`

Paginated inbox of the caller's conversations, most-recent activity first. Spans both sides for a user who is both a worker and a business.

| Param | In | Type | Required | Notes |
|---|---|---|---|---|
| `page` | query | int | — | default 1 |
| `limit` | query | int | — | default 20, max 50 |

**Response `200`** — `data.items` is an array of conversation objects (shape above, each with its own `side` and `unread_count`), plus `data.pagination`.

---

### GET `/chat/conversations/:id/messages`

Message history for a conversation, **newest first**. Fetching marks incoming (counterpart-sent) messages as read and emits a `chat:read` receipt to the counterpart.

| Param | In | Type | Required | Notes |
|---|---|---|---|---|
| `id` | path | uuid | yes | Conversation id |
| `page` | query | int | — | default 1 |
| `limit` | query | int | — | default 30, max 50 |

**Response `200`**
```json
{
  "success": true,
  "message": "Messages fetched",
  "data": {
    "conversation": { "id": "uuid", "side": "worker", "shift": { "…": "…" }, "counterpart": { "…": "…" }, "last_message": { "…": "…" }, "unread_count": 0, "created_at": "…" },
    "items": [
      {
        "id": "uuid",
        "conversation_id": "uuid",
        "sender_user_id": "uuid",
        "sender_role": "business",
        "body": "Can you arrive 30 min early?",
        "read_at": "2026-06-26T09:05:00.000Z",
        "created_at": "2026-06-26T09:01:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 30, "total": 4, "total_pages": 1 }
  }
}
```

**Errors:** `404 Conversation not found` (missing or caller is not a participant), `422` (invalid id).

---

### POST `/chat/conversations/:id/messages`

Sends a message. Persists it, updates the conversation preview, and pushes `chat:message` to both participants in real time. Equivalent to the `chat:send` socket event ([client → server](#events-client--server)) — use either.

| Field | In | Type | Required | Notes |
|---|---|---|---|---|
| `id` | path | uuid | yes | Conversation id |
| `body` | body | string | yes | 1–2000 chars, trimmed |

**Response `201`** — the created `message` object.

**Errors:** `404 Conversation not found` (missing or not a participant); `422` (`Message body is required`, body too long, or invalid id).

---

### PATCH `/chat/conversations/:id/read`

Marks all incoming messages in the conversation as read and emits `chat:read` to the counterpart. Idempotent.

**Response `200`**
```json
{ "success": true, "message": "Conversation marked read", "data": { "updated": 2 } }
```

`updated` is the number of messages flipped to read (0 if already current).

**Errors:** `404 Conversation not found` (missing or not a participant), `422` (invalid id).

---

### GET `/chat/unread-count`

Total unread messages across the caller's conversations (scoped to the active account context) — bind to the chat badge.

**Query Params**

| Param | Type | Required | Notes |
|---|---|---|---|
| `shift_id` | UUID | no | Scopes the count to a single shift's conversations (per-shift badge). Omit for the global total. |

**Response `200`**
```json
{ "success": true, "message": "Unread count fetched", "data": { "unread_count": 5 } }
```

**Error `422`** — `shift_id must be a valid UUID`.

---

## Payments & Wallet

Money module — worker wallet + ledger, payout (withdrawal) requests, business shift settlement, and admin payout processing. Base path: `/api/v1/payments`. Every endpoint requires `Authorization: Bearer <access_token>`; the role differs per endpoint group (worker / business / admin).

**Pay model (current):** flat per-worker pay, released **per assignment** by the [completion handshake](#completion-handshake--how-a-worker-gets-paid). Each worker is paid `pay_amount` the moment their handshake completes (mutual confirm, settle, or the 12h auto-confirm) — no hourly math yet. Worker payouts and the **10% platform fee** (charged per payout, proportional) are funded by the **business escrow** (pay + fee) held when the shift was submitted (see [POST `/business/shifts`](#post-businessshifts)); each payment releases that worker's escrow slice.

### Money flow

```
worker checks out (or business stamps it / sweeper auto-checks-out at shift end)
        │
        ▼
handshake completes                             (confirm by other side, business settle,
        │                                        or 12h auto-confirm — whichever first)
        │   worker credited flat pay_amount → wallet   ("Payment received!")
        │   that slot's escrow slice released; disputes freeze the slice for the admin
        ▼
last handshake resolved → shift auto-finalizes  (leftover escrow returned; shift → closed)
        │
        ▼
worker:   GET  /payments/wallet                 (balance grows)
        │
        ▼
worker:   POST /payments/payouts                (amount held: balance debited now)
        │
        ▼
admin:    PATCH /payments/admin/payouts/:id     approve → sent (total_withdrawn += amount)
                                                reject  → failed (amount refunded to balance)
```

All balance changes run inside DB transactions with a ledger (`transactions`) entry; each per-assignment payment is **claim-guarded** (one-shot even under concurrent confirm/settle/sweep). Payout amounts are **held at request time** (debited immediately) so they can't be double-spent; admin approval finalizes, rejection refunds.

---

### GET `/payments/wallet`

Worker wallet snapshot (screen 13). Auto-creates the wallet on first access. Role: `worker`.

**Response `200`**
```json
{
  "success": true,
  "message": "Wallet fetched",
  "data": {
    "id": "uuid",
    "balance": "2400",
    "total_earned": "5400",
    "total_withdrawn": "3000",
    "currency": "BDT",
    "pending_settlement": 1200,
    "weekly_earnings": 2400,
    "shifts_completed": 4
  }
}
```

| Field | Meaning |
|---|---|
| `balance` | Withdrawable now |
| `total_earned` | Lifetime credited earnings |
| `total_withdrawn` | Lifetime sent payouts |
| `pending_settlement` | Flat pay for attended assignments whose handshake hasn't paid out yet (open, awaiting confirmation, or frozen by a dispute) |
| `weekly_earnings` | Earning credits in the last 7 days |
| `shifts_completed` | Count of paid shifts |

---

### GET `/payments/wallet/transactions`

Paginated wallet ledger, newest first. Role: `worker`.

**Query:** `page` (default 1), `limit` (default 20, max 50).

**Response `200`** — `{ items: [...], pagination: {...} }`. Each item: `id`, `type` (`credit`·`debit`), `amount`, `balance_after`, `description`, `shift_id` (null for payouts/refunds), `reference_id`, `created_at`.

---

### POST `/payments/payouts`

Request a withdrawal (screen 16). Role: `worker`, **admin-verified**. The amount is debited from the balance immediately (held) and a `debit` ledger row is written.

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `amount` | number | ✅ | > 0; min ৳50; must not exceed balance |
| `method` | enum | ✅ | `bkash` · `nagad` · `bank_transfer` |
| `account_number` | string | ✅ | 6–20 chars |
| `account_name` | string | — | ≤ 100 chars |

**Response `201`** — `"Payout requested"` with the payout (status `pending`, `account_number` **masked** e.g. `17****5678`).

**Errors**

| Code | Message | Cause |
|---|---|---|
| `400` | `Minimum payout is ৳50` | Below minimum |
| `400` | `Payout amount exceeds your available balance` | Insufficient balance |
| `403` | `Your worker profile must be verified by an admin first` | Not verified |
| `422` | `Validation failed` | Invalid/missing fields |

---

### GET `/payments/payouts`

Worker's own payout requests, newest first. Role: `worker`.

**Query:** `status` (`pending`·`sent`·`failed`), `page`, `limit`.

**Response `200`** — `{ items: [...], pagination: {...} }`. Account numbers are masked.

---

### POST `/payments/shifts/:shiftId/complete`

Marks a live owned shift `completed`, which unlocks payment. Role: `business`. Accepted source states: `published`, `applications_open`, `worker_selected`, `worker_confirmed`, `checked_in`, `active`. Usually unnecessary — a shift **auto-completes** when its last checked-in worker checks out after the shift window ends (see [Shift status lifecycle](#shift-status-lifecycle)); call this to finalize early or when no one checked out.

**Response `200`** — `"Shift marked completed"` with `{ id, status: "completed" }`.

**Errors:** `404 Shift not found`, `409 A '<state>' shift cannot be completed` (already `completed`/`paid`/`closed`, or still `draft`/`pending_approval`), `422`.

---

### POST `/payments/shifts/:shiftId/settle`

**Confirm-everything shortcut** over the [completion handshake](#completion-handshake--how-a-worker-gets-paid): walks every assignment on a `completed` (or `payment_pending`) owned shift and closes whatever is still open. Role: `business`, **admin-verified**. Idempotent per assignment (already-paid slices are skipped). Optional — the sweeper reaches the same end state on its own within the auto-confirm window.

Per assignment:
- never checked in → marked `no_show` (application too), escrow slice returned
- checked in, forgot to check out → check-out stamped and handshake confirmed → **paid**
- `worker_done` / `business_done` (open handshakes) → confirmed → **paid**
- `disputed` → left frozen for the admin (`disputes_held` in the response)
- `confirmed` / `resolved` / `no_show` → already settled, skipped

If nothing is left disputed the shift **finalizes**: leftover escrow (unfilled slots) returns to the business wallet, `escrow_status` → `released`, shift → `closed`. With open disputes it parks at `payment_pending` and auto-closes when the last dispute is resolved.

**Response `200`**
```json
{
  "success": true,
  "message": "Shift settled and workers paid",
  "data": {
    "shift_id": "uuid",
    "workers_paid": 6,
    "no_show": 1,
    "disputes_held": 1,
    "already_settled": 0,
    "amount_each": "1200",
    "closed": false
  }
}
```

**Errors**

| Code | Message | Cause |
|---|---|---|
| `404` | `Shift not found` | Missing or not owned |
| `409` | `This shift is already settled` | Already `paid` or `closed` |
| `409` | `Complete the shift before settling payment` | Shift not `completed`/`payment_pending` |
| `400` | `No hired workers to settle for this shift` | No roster assignments |
| `403` | `Your business profile must be verified by an admin first` | Not verified |

---

### GET `/payments/admin/payouts`

Payout queue for processing (default `status=pending`), oldest-waiting first. Role: `admin`. Account numbers are shown **in full** here (needed to disburse).

**Query:** `status` (`pending`·`sent`·`failed`), `page` (default 1), `limit` (default 10, max 50).

**Response `200`**
```json
{
  "success": true,
  "message": "Payout queue fetched",
  "data": {
    "items": [
      {
        "id": "uuid",
        "amount": "1500",
        "method": "bkash",
        "account_number": "01712345678",
        "account_name": "Rahim Hossain",
        "status": "pending",
        "created_at": "2026-06-20T10:00:00.000Z",
        "users_payout_requests_user_idTousers": { "id": "uuid", "phone": "+8801712345678" }
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 1, "total_pages": 1 }
  }
}
```

---

### PATCH `/payments/admin/payouts/:payoutId`

Approve (mark sent) or reject (refund) a pending payout. Role: `admin`. Approve finalizes `total_withdrawn`; reject credits the held amount back to the wallet balance. Notifies the worker either way.

| Param | In | Type | Required | Notes |
|---|---|---|---|---|
| `payoutId` | path | UUID | yes | Target payout |
| `decision` | body | string | yes | `approve` · `reject` |
| `failure_reason` | body | string | conditional | **Required when `decision=reject`** (≤ 500 chars) |

**Response `200`** — `"Payout marked sent"` / `"Payout rejected and refunded"` with the updated payout (masked account).

**Errors**

| Code | Message | Cause |
|---|---|---|
| `404` | `Payout request not found` | Unknown payout |
| `409` | `This payout is already '<state>'` | Not `pending` |
| `422` | `failure_reason is required when rejecting` | Reject without a reason |

---

## Disputes

Payment/completion dispute flow over a shift assignment. Base path: `/api/v1/disputes`. Every endpoint requires `Authorization: Bearer <access_token>`. Raising and reading are **party-based** (the assignment's worker or the shift's owning business — no active-role gate); resolution is `admin`.

Raising a dispute **freezes the assignment's handshake** (`completion_status` → `disputed`): the auto-confirm timer stops and no payment can move — settle and the sweeper skip the slice — until an admin rules. One open dispute per assignment.

**Who disputes what (typical):**
- worker → wrongly marked `no_show`, or a business-stamped check-out they don't accept
- business → worker left early / didn't do the work, before confirming a `worker_done` check-out

Already-paid assignments (`confirmed`/`resolved`) cannot be disputed — money moved; file a **report** instead.

### POST `/disputes`

Raise a dispute on an assignment you are a party to. The counterparty and the admin are notified in real time.

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `assignment_id` | UUID | ✅ | From the roster (business) or activity item (worker) |
| `description` | string | ✅ | 10–2000 chars — what went wrong |

**Response `201`** — `"Dispute raised — payment frozen until an admin resolves it"` with the dispute (status `open`, includes shift + assignment + party summaries).

**Errors**

| Code | Message | Cause |
|---|---|---|
| `403` | `You are not a party to this assignment` | Neither the worker nor the owning business |
| `404` | `Assignment not found` | Unknown assignment |
| `409` | `Payment for this assignment is already settled — file a report instead` | Already paid |
| `409` | `A dispute is already open for this assignment` | Duplicate |
| `409` | `This worker has not checked in yet — mark a no-show or wait for the shift` | Nothing happened on-site yet |
| `409` | `This shift was cancelled — its compensation is already settled` | Cancelled shift |

### GET `/disputes/my`

Disputes the caller is a party to (raised **or** against), newest first.

**Query:** `status` (`open`·`under_review`·`resolved`·`dismissed`), `page` (default 1), `limit` (default 10, max 50).

**Response `200`** — `{ items: [...], pagination: {...} }`.

### GET `/disputes/admin`

Admin dispute queue (default `status=open`), oldest-waiting first. Role: `admin`. Items include the shift (`title`, `pay_amount`), the frozen assignment (attendance stamps, `completion_status`), and both parties (`full_name`, `phone`).

**Query:** `status`, `page`, `limit`.

### PATCH `/disputes/admin/:id`

Resolve a dispute. Role: `admin`. Executes the ruling atomically: pays the worker the ruled amount, settles the escrow slice (paid part = spend, remainder back to the business), unfreezes the assignment to `resolved`, notifies both parties, and finalizes/closes the shift if this was the last open handshake.

| Param | In | Type | Required | Notes |
|---|---|---|---|---|
| `id` | path | UUID | ✅ | Target dispute |
| `decision` | body | enum | ✅ | `pay_full` (flat `pay_amount`) · `pay_partial` · `deny` (৳0) |
| `amount` | body | number | for `pay_partial` | Must be > 0 and < the shift's `pay_amount` |
| `resolution_note` | body | string | ✅ | ≤ 2000 chars — both parties see it |

> **Overturned no-shows:** if the disputed assignment was a `no_show`, its escrow slice was already refunded — a `pay_full`/`pay_partial` ruling charges the amount **plus its platform fee** back to the business wallet's balance (which may go negative), restores the application to `accepted`, and decrements the worker's `no_show_count`.

**Response `200`** — `"Dispute resolved"` with the updated dispute (`status: "resolved"`, `decision`, `resolved_amount`, `resolution_note`).

**Errors**

| Code | Message | Cause |
|---|---|---|
| `404` | `Dispute not found` | Unknown dispute |
| `409` | `This dispute is already '<state>'` | Already resolved/dismissed |
| `409` | `The assignment was already processed — refresh the dispute` | Claim lost to a concurrent action |
| `400` | `A partial amount must be between 0 and the shift pay (৳X)` | Bad partial amount |

---

## Ratings

Post-shift mutual ratings. Base path: `/api/v1/ratings`. Every endpoint requires `Authorization: Bearer <access_token>`; access is **party-based** (like disputes) — the assignment's worker rates the business, the owning business rates the worker.

A rating unlocks once the assignment's completion handshake finishes (`completion_status` = `confirmed` or `resolved`). Both parties receive a `rate_prompt` nudge in their handshake-completion notifications. **One rating per direction per shift** (DB-enforced). Each new rating recomputes the rated side's `reliability_score` (rolling average of received `overall_score`, 0–5), which feeds applicant screening and cancellation-penalty math.

### POST `/ratings`

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `assignment_id` | UUID | ✅ | From the roster (business) or activity item (worker) |
| `overall_score` | int | ✅ | 1–5 |
| `punctuality_score` | int | — | 1–5 |
| `behavior_score` | int | — | 1–5 |
| `skill_score` | int | — | 1–5 |
| `review` | string | — | ≤ 1000 chars |
| `is_anonymous` | bool | — | Hides the rater from the rated side's view (default `false`) |

**Response `201`** — `"Rating submitted"` with the rating (includes shift + rater/rated summaries). The rated user is notified (`{ kind: "rating_received" }`).

**Errors**

| Code | Message | Cause |
|---|---|---|
| `403` | `You are not a party to this assignment` | Neither the worker nor the owning business |
| `404` | `Assignment not found` | Unknown assignment |
| `409` | `You can rate once the shift completion is confirmed` | Handshake not finished (`pending`/`worker_done`/`business_done`/`disputed`/`no_show`) |
| `409` | `You have already rated this shift` | Duplicate (one per direction per shift) |

### GET `/ratings/my`

The caller's ratings plus their received summary.

**Query:** `direction` (`received` default · `given`), `page` (default 1), `limit` (default 10, max 50).

**Response `200`** — `{ items: [...], summary: { average, count }, pagination: {...} }`. On `received` items, an anonymous rating's rater is `null`.

---

## Admin

Admin dashboard API: platform monitoring (counters + graph series), verification review, shift-post moderation, user management (block/unblock), and runtime platform settings. Dispute rulings live under [`/disputes/admin`](#disputes) and payout processing under [`/payments/admin/payouts`](#payments--wallet). All endpoints require:
- `Authorization: Bearer <access_token>`
- User must have `admin` role (provisioned with `npm run admin:create` — never via signup)

Admins are **excluded from the public OTP flow**. `/auth/verify-otp` rejects any phone whose account holds the `admin` role with `403 "Admins must sign in through the admin portal"`. Admins sign in with username + password + email 2FA — see [POST `/auth/admin/login`](#post-authadminlogin) and [POST `/auth/admin/verify-2fa`](#post-authadminverify-2fa).

---

### GET `/admin/verifications`

Paginated review queue of profiles awaiting (or in any) verification state. Oldest-waiting first.

**Query Parameters**

| Param | Type | Default | Values |
|---|---|---|---|
| `type` | string | `worker` | `worker` · `business` |
| `status` | string | `pending` | `unverified` · `pending` · `verified` · `rejected` |
| `page` | int | `1` | ≥ 1 |
| `limit` | int | `10` | 1–50 |

**Example**
```
GET /api/v1/admin/verifications?type=worker&status=pending&page=1&limit=10
```

**Response `200`** (worker queue)
```json
{
  "success": true,
  "message": "Verification queue fetched",
  "data": {
    "items": [
      {
        "id": "uuid",
        "user_id": "uuid",
        "full_name": "Rahim Hossain",
        "verification_status": "pending",
        "verification_note": null,
        "nid_front_url": "https://res.cloudinary.com/.../nid-front.jpg",
        "nid_back_url": "https://res.cloudinary.com/.../nid-back.jpg",
        "selfie_url": "https://res.cloudinary.com/.../selfie.jpg",
        "student_id_url": null,
        "created_at": "2026-06-16T09:00:00.000Z",
        "updated_at": "2026-06-16T09:30:00.000Z",
        "users": { "phone": "+8801712345678", "roles": ["worker"] }
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 3, "total_pages": 1 }
  }
}
```

> For `type=business`, items carry `business_name`, `business_type`, `trade_license_url`, `business_doc_url` instead of the worker/NID fields.

---

### GET `/admin/verifications/:profileId`

Single profile under review, with full KYC document URLs.

| Param | In | Type | Required | Notes |
|---|---|---|---|---|
| `profileId` | path | UUID | yes | `worker_profiles.id` or `business_profiles.id` |
| `type` | query | string | yes | `worker` · `business` — selects which table |

**Example**
```
GET /api/v1/admin/verifications/<profileId>?type=worker
```

**Response `200`** — same object shape as a queue item.

**Error `404`**
```json
{ "success": false, "message": "Profile not found" }
```

---

### PATCH `/admin/verifications/:profileId`

Approve or reject a profile. Flips `verification_status` and sends the owner an in-app notification.

| Param | In | Type | Required | Notes |
|---|---|---|---|---|
| `profileId` | path | UUID | yes | Target profile |
| `type` | body | string | yes | `worker` · `business` |
| `decision` | body | string | yes | `approve` · `reject` |
| `note` | body | string | conditional | **Required when `decision=reject`** (≤ 500 chars). Optional on approve. |

**Request Body — approve**
```json
{ "type": "worker", "decision": "approve" }
```

**Request Body — reject**
```json
{ "type": "worker", "decision": "reject", "note": "NID photo is blurry, please re-upload." }
```

**Response `200`**
```json
{
  "success": true,
  "message": "Profile verified",
  "data": { "id": "uuid", "verification_status": "verified", "verification_note": null }
}
```

On `approve` → `verification_status: "verified"` (worker can now apply to shifts). On `reject` → `"rejected"` with the note stored. Either way the owner gets a high-priority in-app notification.

**Errors**

| Code | Message | Cause |
|---|---|---|
| `404` | `Profile not found` | Unknown profile |
| `409` | `Profile is already verified` | Re-deciding a verified profile |
| `422` | `note is required when rejecting` | Reject without a note |

---

### GET `/admin/shifts`

Moderation queue of shift posts awaiting approval (default `status=pending_approval`).

| Param | In | Type | Required | Notes |
|---|---|---|---|---|
| `status` | query | string | — | `pending_approval` (default) · `published` · `draft` |
| `page` | query | int | — | default 1 |
| `limit` | query | int | — | default 10, max 50 |

**Response `200`**
```json
{
  "success": true,
  "message": "Shift-post queue fetched",
  "data": {
    "items": [
      {
        "id": "uuid",
        "title": "Banquet Waiters Needed — Wedding Night",
        "status": "pending_approval",
        "shift_date": "2026-06-26",
        "pay_amount": "1200",
        "workers_needed": 8,
        "created_at": "2026-06-17T10:00:00.000Z",
        "updated_at": "2026-06-17T10:00:00.000Z",
        "business_profiles": { "id": "uuid", "user_id": "uuid", "business_name": "The Wedding Studio", "verification_status": "verified" },
        "categories": { "id": "uuid", "name": "Events & Wedding" },
        "zones": { "id": "uuid", "name": "Gulshan" }
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 1, "total_pages": 1 }
  }
}
```

---

### PATCH `/admin/shifts/:shiftId`

Approve or reject a shift post. Approve → `published` (worker-visible); the escrow stays held until settlement. Reject → `draft` (business edits and resubmits) and the **held escrow is refunded** to the business wallet in the same transaction. Notifies the business owner either way.

| Param | In | Type | Required | Notes |
|---|---|---|---|---|
| `shiftId` | path | UUID | yes | Target shift |
| `decision` | body | string | yes | `approve` · `reject` |
| `note` | body | string | conditional | **Required when `decision=reject`** (≤ 500 chars) |

**Request Body — reject**
```json
{ "decision": "reject", "note": "Pay is below the category minimum." }
```

**Response `200`**
```json
{
  "success": true,
  "message": "Shift approved",
  "data": { "id": "uuid", "status": "published" }
}
```

**Errors**

| Code | Message | Cause |
|---|---|---|
| `404` | `Shift not found` | Unknown/deleted shift |
| `409` | `Shift is not pending approval` | Shift not in `pending_approval` |
| `422` | `note is required when rejecting` | Reject without a note |

---

### GET `/admin/dashboard`

Headline platform counters for the dashboard home screen — everything the admin needs to see at a glance, in one call.

**Response `200`**
```json
{
  "success": true,
  "message": "Dashboard fetched",
  "data": {
    "users": { "total": 9, "workers": 7, "businesses": 6, "blocked": 0 },
    "pending_review": {
      "worker_verifications": 1,
      "business_verifications": 1,
      "shift_posts": 0,
      "open_disputes": 0,
      "handshakes_awaiting_confirm": 0
    },
    "shifts": { "total": 11, "open": 1, "live": 2 },
    "money": {
      "escrow_held": "200",
      "platform_fee_collected": "12",
      "worker_earnings_total": "120"
    }
  }
}
```

| Field | Meaning |
|---|---|
| `pending_review.*` | Work queues needing admin attention (verifications, shift posts, disputes) plus handshakes sitting in `worker_done`/`business_done` |
| `shifts.open` | `published` / `applications_open` |
| `shifts.live` | `worker_selected` / `worker_confirmed` / `checked_in` / `active` |
| `money.escrow_held` | Sum of `escrow_amount` across shifts with escrow currently `held` |
| `money.platform_fee_collected` | Lifetime platform fee revenue (ledger rows with `reference_id = "platform_fee"`) |
| `money.worker_earnings_total` | Lifetime worker payouts (sum of wallet `total_earned`) |

---

### GET `/admin/analytics`

Daily time series for the dashboard graphs. One point per calendar day (UTC buckets), zero-filled — plot directly.

**Query Parameters**

| Param | Type | Default | Values |
|---|---|---|---|
| `days` | int | `30` | 7–90 |

**Response `200`**
```json
{
  "success": true,
  "message": "Analytics fetched",
  "data": {
    "days": 30,
    "since": "2026-06-13",
    "series": [
      {
        "date": "2026-06-13",
        "signups": 2,
        "shifts_created": 3,
        "payouts_count": 1,
        "payouts_amount": 120,
        "fee_count": 1,
        "fee_amount": 12,
        "disputes_raised": 0
      }
    ]
  }
}
```

---

### GET `/admin/users`

Paginated, filterable user directory (workers + businesses + admins). Newest first.

**Query Parameters**

| Param | Type | Default | Values |
|---|---|---|---|
| `role` | string | — | `worker` · `business` · `admin` |
| `status` | string | — | `active` · `blocked` |
| `search` | string | — | Matches phone, name, email, worker full name, or business name (≤ 100 chars) |
| `page` | int | `1` | ≥ 1 |
| `limit` | int | `10` | 1–50 |

**Response `200`**
```json
{
  "success": true,
  "message": "Users fetched",
  "data": {
    "items": [
      {
        "id": "uuid",
        "phone": "+8801...",
        "email": null,
        "full_name": null,
        "roles": ["worker"],
        "is_active": true,
        "created_at": "2026-06-16T10:00:00.000Z",
        "worker_profiles": { "id": "uuid", "full_name": "Rahim", "verification_status": "verified", "reliability_score": "4.5" },
        "business_profiles": null
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 9, "total_pages": 1 }
  }
}
```

---

### GET `/admin/users/:userId`

Single user detail: both profiles (with shift counters), worker wallet snapshot, and full sanction history (`sanctions`, newest first).

**Response `200`** (shape highlights)
```json
{
  "data": {
    "id": "uuid",
    "phone": "+8801...",
    "roles": ["worker"],
    "is_active": true,
    "worker_profiles": { "id": "uuid", "full_name": "Rahim", "verification_status": "verified", "reliability_score": "4.5", "completed_shift_count": 3, "no_show_count": 0 },
    "business_profiles": null,
    "wallets": { "balance": "120", "total_earned": "120" },
    "sanctions": [
      { "id": "uuid", "sanction_type": "ban", "reason": "…", "severity": "high", "is_active": false, "created_at": "…", "expires_at": null }
    ]
  }
}
```

**Error `404`** — `User not found`

---

### POST `/admin/users/:userId/block`

Blocks a user platform-wide (works for both worker and business accounts — the block is on the **user**, so a dual-role account loses both). Atomically: deactivates the account, records a `ban` sanction, and revokes **every live session and refresh token**. The user can't sign in, and any access token they still hold dies at its natural expiry (≤ 15 min) — refresh is rejected with `403 "Account is deactivated"`.

| Param | In | Type | Required | Notes |
|---|---|---|---|---|
| `userId` | path | UUID | yes | Target user |
| `reason` | body | string | yes | ≤ 500 chars — stored on the sanction |
| `severity` | body | string | no | `low` · `medium` · `high` (default) · `critical` |

**Response `200`**
```json
{ "success": true, "message": "User blocked", "data": { "user_id": "uuid", "is_active": false } }
```

**Errors**

| Code | Message | Cause |
|---|---|---|
| `403` | `Admin accounts can't be blocked from here` | Target holds the `admin` role |
| `404` | `User not found` | Unknown/deleted user |
| `409` | `You can't block your own account` | Self-block |
| `409` | `User is already blocked` | Already inactive |

---

### POST `/admin/users/:userId/unblock`

Reactivates a blocked user and closes their active sanctions. The user is notified.

| Param | In | Type | Required | Notes |
|---|---|---|---|---|
| `userId` | path | UUID | yes | Target user |
| `note` | body | string | no | ≤ 500 chars — included in the notification |

**Response `200`**
```json
{ "success": true, "message": "User unblocked", "data": { "user_id": "uuid", "is_active": true } }
```

**Error `409`** — `User is not blocked`

---

### GET `/admin/settings`

All runtime-tunable platform constants with live values. A key with `is_overridden: false` is running on its compiled default. Changes apply **without a redeploy**: instantly in the process that took the edit, within ≤ 60 s in any other (settings cache refresh).

**Response `200`**
```json
{
  "success": true,
  "message": "Settings fetched",
  "data": [
    {
      "key": "PLATFORM_FEE_PERCENT",
      "value": 10,
      "default": 10,
      "is_overridden": false,
      "min": 0,
      "max": 50,
      "description": "Platform commission (%) on top of worker pay, escrowed at submit and captured per payout.",
      "updated_at": null,
      "updated_by": null
    }
  ]
}
```

Tunable keys: `PLATFORM_FEE_PERCENT`, `HANDSHAKE_AUTO_CONFIRM_HOURS`, `CHECKIN_RADIUS_METERS`, `CHECKIN_GRACE_MINUTES`, `CHECKIN_MAX_ACCURACY_METERS`, `BUSINESS_WALLET_SEED_BALANCE`, `MIN_BUSINESS_TOPUP`, `LARGE_REQUEST_WORKER_THRESHOLD`, `CANCEL_FREE_NOTICE_HOURS`, `PENALTY_MIN_RATE`, `PENALTY_MAX_RATE`, `PENALTY_TIMING_MIN_RATE`, `PENALTY_TIMING_MAX_RATE`, `PENALTY_INSTANT_BASE`, `PENALTY_FACTOR_WEIGHT`.

> Fee changes only affect **future** money movements: escrow already held keeps the fee captured at its submit-time rate (release clamps to what is actually held). The sweeper interval (`HANDSHAKE_SWEEP_INTERVAL_MINUTES`) is read once at boot and is deliberately **not** tunable here.

---

### PATCH `/admin/settings/:key`

Overrides one setting. Value must be numeric and within the key's `min`/`max`.

**Request Body**
```json
{ "value": 12 }
```

**Response `200`** — the updated setting object (same shape as the list item).

**Errors**

| Code | Message | Cause |
|---|---|---|
| `422` | `Unknown platform setting: <key>` | Key not in the tunable list |
| `422` | `Value must be between <min> and <max>` | Out of bounds |

---

### DELETE `/admin/settings/:key`

Removes the override — the key reverts to its compiled default. Returns the setting object.

---

## File Uploads

All upload endpoints require `Authorization: Bearer <access_token>`.

Files are **never uploaded through the backend**. The backend generates a signed URL; the frontend uploads directly to Cloudinary.

### Upload Flow

```
1. POST /api/v1/upload/presign  { "purpose": "nid_front" }
         ↓ backend returns signature + upload_url
2. PUT <upload_url>  (multipart — straight to Cloudinary, no backend)
         ↓ Cloudinary returns { secure_url: "https://res.cloudinary.com/..." }
3. Send secure_url to the relevant profile endpoint
   e.g. PATCH /api/v1/worker/profile/documents { "nid_front_url": secure_url }
```

---

### POST `/upload/presign`

Generates a signed upload credential. Valid for one upload only.

**Request Body**
```json
{
  "purpose": "nid_front"
}
```

| `purpose` value | Used for | Allowed formats |
|---|---|---|
| `profile_picture` | Worker / business avatar | jpg, jpeg, png, webp |
| `nid_front` | National ID front photo | jpg, jpeg, png, pdf |
| `nid_back` | National ID back photo | jpg, jpeg, png, pdf |
| `selfie` | Live selfie for identity | jpg, jpeg, png |
| `student_id` | Optional student ID | jpg, jpeg, png, pdf |
| `trade_license` | Business trade license (verification) | jpg, jpeg, png, pdf |
| `business_doc` | Other business verification document | jpg, jpeg, png, pdf |
| `business_logo` | Business logo | jpg, jpeg, png, webp |

**Response `200`**
```json
{
  "success": true,
  "message": "Upload signature generated",
  "data": {
    "upload_url": "https://api.cloudinary.com/v1_1/<cloud>/auto/upload",
    "api_key": "123456789",
    "cloud_name": "your_cloud",
    "signature": "abc123...",
    "timestamp": 1718400000,
    "public_id": "workforcebd/kyc_documents/<user_id>_nid_front_1718400000",
    "folder": "workforcebd/kyc_documents",
    "allowed_formats": ["jpg", "jpeg", "png", "pdf"],
    "transformation": [{ "quality": "auto" }]
  }
}
```

**Error `422`** — invalid purpose
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [{ "msg": "Invalid purpose", "path": "purpose" }]
}
```

---

### How to upload (frontend)

After receiving the presign response, send a `multipart/form-data` POST directly to `upload_url`:

| Field | Value |
|---|---|
| `file` | The binary file |
| `api_key` | From presign response |
| `signature` | From presign response |
| `timestamp` | From presign response |
| `public_id` | From presign response |

Cloudinary returns `{ secure_url: "https://res.cloudinary.com/..." }` — pass this URL to the relevant backend endpoint.

---

## Token Storage Recommendation

| Platform | Recommended Storage |
|---|---|
| Web | `httpOnly` cookie (accessToken) + memory or secure cookie (refreshToken) |
| React Native / Mobile | Secure storage (e.g. `expo-secure-store`, iOS Keychain) |
| Admin dashboard (web) | `sessionStorage` for both tokens — survives a page refresh (F5), dies when the tab closes |

> Never store tokens in `localStorage` — vulnerable to XSS.
>
> **Why sessionStorage for admin:** storing admin tokens only in memory logs the admin out on every page refresh; `localStorage` would keep the session across tab close, which the admin policy forbids. `sessionStorage` gives exactly the desired lifecycle: refresh-proof within the tab, gone on tab close. The 10-minute idle timeout is enforced server-side regardless (see admin auth below).
