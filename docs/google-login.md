# MusicWave Google sign-in

MusicWave uses its own Google OAuth web client and its existing Prisma users in
Supabase PostgreSQL. It does not modify the shared FoodGo Supabase Auth provider.

1. Configure Google Auth Platform branding as MusicWave with External audience.
2. Create a Web application client, with redirect URIs:
   - `https://musicwave-app.vercel.app/auth/google/callback`
   - `http://localhost:5173/auth/google/callback`
3. Set server-only `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and
   `GOOGLE_REDIRECT_URI` in `server/.env` and Vercel Production. Production must
   use the HTTPS redirect above. Never prefix the secret with `VITE_`.
4. Apply only the additive SQL in
   `server/prisma/migrations/20261022_google_login/migration.sql` to the MusicWave
   database before deploying. Do not run a seed or reset. Both Prisma schemas
   include the nullable unique `googleSubject` column.
5. Generate both Prisma clients and build server/client. Deploy after configuration.
6. Google exempts sign-in using only `openid email profile` from the Testing
   allowlist requirement. MusicWave uses only these scopes; accounts outside the
   test list can sign in (subject to their organization policies). Additional
   scopes would require revisiting testing/publication and verification rules.
   See https://support.google.com/cloud/answer/15549945?hl=en.

The flow uses authorization code + PKCE S256, a per-tab state and nonce, and the
official Google library to verify the ID token signature, issuer, audience and
expiry. It requests only `openid email profile`, never Drive or Gmail access.
Google secrets and tokens stay server-side; the browser receives the existing
MusicWave session format. Existing email matches require the local password before
linking; user roles and playlists are retained. New Google users get the USER role.
Changing the MusicWave profile email does not break the Google identity link.
Google-only users can use the existing forgot-password flow to set a local password.

The current flow targets the website in a regular browser. Native Android WebView
sign-in requires a separate system-browser/deep-link flow and OAuth client setup.

Checks: `npx tsc --noEmit -p server/tsconfig.json`,
`server/node_modules/.bin/tsx --test server/src/scripts/googleAuth.test.ts`,
`npm --prefix client run build`.

References: https://developers.google.com/identity/protocols/oauth2/web-server
and https://developers.google.com/identity/sign-in/web/backend-auth.
