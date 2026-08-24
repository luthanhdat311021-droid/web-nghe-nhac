# MusicWave — Security Architecture & Policy (SECURITY.md)

This document outlines the security architecture, threat model, defensive controls, and vulnerability disclosure policy for the **MusicWave** streaming application.

---

## 1. Security Architecture & Threat Model

MusicWave enforces a **Defense-in-Depth** and **Zero-Trust (Server-Authoritative)** security design:

```
[ Client Browser ]
        │
        ▼ (TLS 1.3 / HTTPS)
[ Security Headers & Strict CSP (X-Request-Id) ]
        │
        ▼
[ Hardened CORS Origin Allowlist ]
        │
        ▼
[ Multi-Tier Sliding-Window Rate Limiters ]
        │ (Auth, Uploads, Search, Global)
        ▼
[ Authentication Layer (HMAC-SHA256 JWT, Bcrypt / Argon2id) ]
        │
        ▼
[ Server-Side Authorization & Ownership Enforcement ]
        │ (Role-Based: USER / ADMIN + IDOR Object-Level Validation)
        ▼
[ Strict Input Validation (Zod Schemas & SSRF Guard) ]
        │
        ▼
[ Business Logic & Safe Query Abstraction ]
        │
        ▼
[ Database Access (Prisma ORM Parameterized Queries) ]
```

---

## 2. Threat Model & Defensive Controls

| Attack Vector | Threat Scenario | MusicWave Defensive Control |
| :--- | :--- | :--- |
| **Credential Stuffing & Brute Force** | Automated scripts guessing passwords | Sliding-window `authRateLimiter` (15 attempts / 15m), standardized error responses preventing user enumeration, NIST-compliant password complexity. |
| **Broken Object-Level Authorization (IDOR)** | User tampering with song or playlist IDs to edit/delete others' data | Explicit server-side ownership checks (`item.createdBy === req.user.userId || req.user.role === 'ADMIN'`). |
| **Cross-Origin Resource Sharing (CORS)** | Malicious websites making credentialed requests to MusicWave API | Origin validation against strict allowlist. Disallowed wildcard origins with `credentials: true`. |
| **Cross-Site Scripting (XSS)** | Injected scripts via metadata or lyrics | Strict Content Security Policy (CSP), `X-Content-Type-Options: nosniff`, context-safe JSX encoding. |
| **Malicious File Upload / Web Shells** | Uploading `.exe`/`.php` masqueraded as `.mp3` or `.jpg` | Dual-validation (file extension + MIME type whitelist), crypto-random UUID filenames, storage path isolation. |
| **Server-Side Request Forgery (SSRF)** | Probing internal networks (`127.0.0.1`, `169.254.169.254`) via YouTube/audio URLs | `ssrfGuard` blocking private IP subnets, loopbacks, link-local metadata addresses, and non-HTTPS protocols. |
| **AI Prompt Injection** | Tampering with AI Smart Search to leak system prompts or override intent | Isolated system prompt framing (`<USER_SEARCH_QUERY>` delimiters), Zod schema output validation, automatic fallback. |
| **Information Disclosure** | Stack traces or database errors leaking in responses | Sanitized global error handler in `error.ts` stripping stack traces and Prisma internals in production. |

---

## 3. OWASP Top 10 (2025) Compliance Matrix

| OWASP Category | Implemented Controls | Status |
| :--- | :--- | :--- |
| **A01: Broken Access Control** | Server-side role validation (`requireAdmin`), resource ownership verification (`requireAuth`), IDOR prevention on songs, albums, and playlists. | ✅ Hardened |
| **A02: Cryptographic Failures** | Bcrypt password hashing (work factor 10), HMAC-SHA256 JWT tokens, TLS 1.3 in transit, HSTS enabled for 1 year. | ✅ Hardened |
| **A03: Injection (SQL/SSRF/Cmd)** | Prisma parameterized queries, SSRF Guard for remote probes, no raw command execution. | ✅ Hardened |
| **A04: Insecure Design** | Principle of Least Privilege, defense-in-depth architecture, rate limiting per endpoint sensitivity. | ✅ Hardened |
| **A05: Security Misconfiguration** | Helmet security headers (CSP, nosniff, frame-ancestors, Permissions-Policy), strict CORS allowlist, production secret validation. | ✅ Hardened |
| **A06: Vulnerable & Outdated Components** | Minimal dependency footprint, audited packages, isolated serverless functions. | ✅ Hardened |
| **A07: Identification & Auth Failures** | Strong password policy (8+ chars with uppercase, lowercase, numbers/symbols), anti-enumeration login messages, rate-limited auth. | ✅ Hardened |
| **A08: Software & Data Integrity Failures** | Strict upload file filters (extension + MIME validation), structured schema parsing (Zod). | ✅ Hardened |
| **A09: Security Logging & Monitoring** | Privacy-safe structured logging (`SecurityLogger`) for auth events, admin mutations, rate limit hits, and SSRF blocks. | ✅ Hardened |
| **A10: SSRF** | `validateSafeUrl` with private IP and cloud metadata protection. | ✅ Hardened |

---

## 4. Secret Management & Rotation Policy

1. **Environment Separation**: Never commit `.env` or secret keys to version control.
2. **Production Startup Verification**: The server will refuse to boot in production if `JWT_SECRET` is missing or matches the default development fallback string.
3. **Secret Rotation**:
   - `JWT_SECRET`: Rotate periodically or upon suspected token leakage.
   - `GEMINI_API_KEY`: Kept strictly server-side; rotate via Google Cloud Console / AI Studio.
   - `DATABASE_URL`: Managed via Supabase dashboard with TLS SSL mode enabled.

---

## 5. Security Checklist Before Production Deployment

- [x] Configure production `JWT_SECRET` with a high-entropy string (e.g. `openssl rand -base64 48`).
- [x] Configure `ALLOWED_ORIGINS` / `CLIENT_URL` to match your production domain (`https://musicwave-app.vercel.app`).
- [x] Ensure `NODE_ENV=production` is set in hosting environment variables.
- [x] Verify that CORS headers block untrusted origins.
- [x] Confirm that no `.env` files are tracked in Git repository.

---

## 6. Vulnerability Reporting (Responsible Disclosure)

If you discover a security vulnerability within MusicWave, please report it privately:

- **Security Team Contact**: `security@musicwave.com` (or create a private GitHub Security Advisory)
- **Response SLA**: Initial acknowledgment within 48 hours.
- Please do not publicly disclose vulnerabilities until a fix has been released.
