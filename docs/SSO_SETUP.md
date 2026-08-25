# Google + Microsoft SSO setup (HIVE Roots)

## App login flow
1. User clicks **Continue with Google** or **Continue with Microsoft**
2. Provider authenticates the account
3. Backend auto-creates the user in Postgres (if new)
4. MFA step (6-digit code) → full session JWT
5. User lands on dashboard

---

## 1) Google Cloud OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create / select a project
3. **APIs & Services → OAuth consent screen**
   - User type: **External** (for any Google account) or Internal (Workspace-only)
   - App name: `HIVE Roots`
   - Add your email as test user while in Testing
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URIs:
     - `http://localhost:4000/api/auth/google/callback`
5. Copy **Client ID** and **Client Secret** into `backend/.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```

---

## 2) Microsoft / Outlook — local POC (only if no Client ID)

If `MICROSOFT_CLIENT_ID` is empty and `MICROSOFT_DEV_LOGIN=true`:

1. Click **Microsoft**
2. Enter Outlook / Microsoft email manually
3. App creates/opens the session

Use this only for demos without Azure access.

---

## 2b) Real Microsoft auto-login (recommended)

When `MICROSOFT_CLIENT_ID` + `MICROSOFT_CLIENT_SECRET` are set:

1. User clicks **Microsoft**
2. Browser opens **login.microsoftonline.com** (pick / sign in to Microsoft account)
3. Microsoft redirects back → user is logged in automatically (no email typing)

### Azure setup
1. Go to [Azure Portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Open your app (or **New registration**)
   - Supported account types: org + personal if you need both (`MICROSOFT_TENANT_ID=common`)
   - Or work/school only (`MICROSOFT_TENANT_ID=organizations`)
3. **Authentication → Add a platform → Web**
   - Redirect URI: `http://localhost:4000/api/auth/microsoft/callback`  
     (must match `MICROSOFT_CALLBACK_URL` exactly)
4. **Certificates & secrets → New client secret** → copy the **Value** immediately
5. **Overview** → copy **Application (client) ID**
6. **API permissions** → Microsoft Graph delegated: `openid`, `profile`, `email`, `User.Read`
7. Put in `backend/.env`:
   ```
   MICROSOFT_CLIENT_ID=<Application (client) ID>
   MICROSOFT_CLIENT_SECRET=<client secret value>
   MICROSOFT_TENANT_ID=organizations
   MICROSOFT_CALLBACK_URL=http://localhost:4000/api/auth/microsoft/callback
   MICROSOFT_DEV_LOGIN=false
   ```
8. Restart the backend, then click **Microsoft** on the login page.

---

## 3) Backend .env checklist

```
FRONTEND_URL=http://localhost:5173
DEV_SHOW_OTP=true
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_TENANT_ID=common
MICROSOFT_CALLBACK_URL=http://localhost:4000/api/auth/microsoft/callback
```

Restart backend after saving `.env`.

---

## 4) Database migration (one time)

```powershell
cd C:\roots_poc\hive-roots
$env:PGPASSWORD="your_postgres_password"
psql -U postgres -d hive_roots -f database/migrations/002_sso_mfa.sql
```

---

## 5) Run

```powershell
# Terminal 1
cd C:\roots_poc\hive-roots\backend
npm run dev

# Terminal 2
cd C:\roots_poc\hive-roots\frontend
npm run dev
```

Open the Vite URL → use Google / Microsoft → complete MFA.

During local POC, MFA code is printed in the **backend terminal**.  
If `DEV_SHOW_OTP=true`, it is also shown on the MFA screen.
