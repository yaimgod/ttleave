# TTLeave — Authentication

TTLeave uses **Supabase GoTrue** for authentication. All auth flows go through Kong at `/auth/v1/*`.

## How it works

```
Browser  →  Kong (:8001)  →  GoTrue (auth)  →  PostgreSQL (auth schema)
                                    ↓
                               Real SMTP provider (emails)
```

After a successful login, GoTrue issues a **JWT** signed with `JWT_SECRET`. The browser sends this JWT as `Authorization: Bearer <token>` on every subsequent API call. Kong validates the key, PostgREST uses the JWT claims to enforce RLS policies.

---

## Email auth (default)

Signup requires email confirmation by default. The flow is:

1. User signs up → GoTrue creates an unconfirmed user → sends a confirmation email
2. User clicks the link → GoTrue confirms the account → redirects to `/auth/callback?next=/dashboard`
3. App exchanges the code for a session → user is logged in

Password reset follows the same pattern (reset email → link → new password form).

### Email delivery

Auth emails (confirmation, password reset, invite) are sent via a real transactional SMTP provider.
Configure the `SMTP_*` variables in `.env.supabase` before starting the stack.

**Recommended: [Resend](https://resend.com)** (free tier: 100 emails/day, 3 000/month)
1. Sign up at resend.com
2. Domains → Add your domain → verify the DNS records shown
3. Generate an API key

Then set in `.env.supabase`:
```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_YOUR_API_KEY
SMTP_ADMIN_EMAIL=noreply@yourdomain.com  # must be a verified sender on that domain
```

Other providers: Mailgun, Postmark, Amazon SES, Brevo — adjust `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS` accordingly.

After changing SMTP settings, restart auth:
```bash
docker compose -f docker-compose.supabase.yaml up -d --force-recreate auth
```

### Skip email confirmation (local dev only)

To bypass confirmation during development, set in `.env.supabase`:
```env
ENABLE_EMAIL_AUTOCONFIRM=true
```
Then `docker compose -f docker-compose.supabase.yaml up -d --force-recreate auth`. **Never use this in production.**

---

## Google OAuth

### Status
Google OAuth is **enabled** in the stack. The `ENABLE_GOOGLE_AUTH`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` variables are set in `.env.supabase` and the "Continue with Google" button is shown on the login and signup pages.

### Requirements
- A **real public domain** with HTTPS — Google OAuth does not work on `localhost` for production apps.
- A verified OAuth 2.0 Client ID from [Google Cloud Console](https://console.cloud.google.com).

### Setup
1. Go to **Google Cloud Console → APIs & Services → Credentials**
2. Create an **OAuth 2.0 Client ID** (type: Web application)
3. Add to **Authorised redirect URIs**:
   ```
   https://api.yourdomain.com/auth/v1/callback
   ```
4. Copy the **Client ID** and **Client Secret** into `.env.supabase`:
   ```env
   ENABLE_GOOGLE_AUTH=true
   GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
   ```
5. Restart auth:
   ```bash
   docker compose -f docker-compose.supabase.yaml up -d --force-recreate auth
   ```

---

## GitHub OAuth

### Status
GitHub OAuth is **not currently configured**. The env vars and UI button are not present.
To add it:

### Step 1 — Create a GitHub OAuth app
1. Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**
2. Set **Authorization callback URL** to:
   ```
   https://api.yourdomain.com/auth/v1/callback
   ```
3. Copy the **Client ID** and generate a **Client Secret**

### Step 2 — Add env vars to `.env.supabase`
```env
ENABLE_GITHUB_AUTH=true
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
```

### Step 3 — Add env vars to docker-compose.supabase.yaml
In the `auth` service environment block, add:
```yaml
GOTRUE_EXTERNAL_GITHUB_ENABLED: ${ENABLE_GITHUB_AUTH:-false}
GOTRUE_EXTERNAL_GITHUB_CLIENT_ID: ${GITHUB_CLIENT_ID}
GOTRUE_EXTERNAL_GITHUB_SECRET: ${GITHUB_CLIENT_SECRET}
GOTRUE_EXTERNAL_GITHUB_REDIRECT_URI: ${API_EXTERNAL_URL}/auth/v1/callback
```

### Step 4 — Add the UI button
In `src/components/auth/OAuthButtons.tsx`, import the `Github` icon from `lucide-react` and add a button alongside the existing Google one:
```tsx
import { Github } from "lucide-react";

const signInWithGitHub = async () => {
  await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${window.location.origin}/auth/callback?next=${redirectTo}`,
    },
  });
};

// Inside the return:
<Button variant="outline" className="w-full gap-2" onClick={signInWithGitHub}>
  <Github className="h-4 w-4" />
  Continue with GitHub
</Button>
```

### Step 5 — Apply
```bash
docker compose up -d --build
docker compose -f docker-compose.supabase.yaml up -d --force-recreate auth
```

---

## JWT and API keys

| Key | Role | Used by |
|---|---|---|
| `ANON_KEY` | `anon` | Browser / public client — limited by RLS |
| `SERVICE_ROLE_KEY` | `service_role` | Server-side only — bypasses RLS |
| `JWT_SECRET` | — | Signs and verifies all JWTs |

Both keys are JWTs signed with `JWT_SECRET`. They are generated by `scripts/generate-secrets.sh` and must never be committed to Git or exposed to users.

The `SERVICE_ROLE_KEY` is used only in server-side Next.js route handlers (via `SUPABASE_SERVICE_ROLE_KEY` env var). It is never sent to the browser.
