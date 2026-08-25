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

## 2) Microsoft / Outlook — local POC (default, no Azure needed)

If `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` are empty and `MICROSOFT_DEV_LOGIN=true` (default):

1. Click **Continue with Microsoft / Outlook**
2. Enter Outlook / Microsoft email (+ optional name)
3. Complete MFA (`123456`)

No Azure portal access required. Suitable for local demos.

---

## 2b) Real Microsoft Entra ID OAuth (optional)

When you have Azure access, set both client values in `.env` — the app switches to real Microsoft login automatically (`microsoftMode: oauth`).

1. Go to [Azure Portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. **New registration**
   - Name: `HIVE Roots`
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**  
     (covers work/school + personal Outlook / Hotmail / Live)
   - Redirect URI platform: **Web**
   - Redirect URI: `http://localhost:4000/api/auth/microsoft/callback`  
     (must match `MICROSOFT_CALLBACK_URL` exactly)
3. **Certificates & secrets → New client secret** → copy the **Value** immediately
4. **Overview** → copy **Application (client) ID**
5. **API permissions**
   - Microsoft Graph → Delegated: `openid`, `profile`, `email`, `User.Read`
   - Click **Grant admin consent** if your tenant requires it
6. **Authentication** (optional but recommended)
   - Under Implicit grant: leave access/ID tokens unchecked (we use auth code)
   - Ensure the Web redirect URI above is listed
7. Put in `backend/.env`:
   ```
   MICROSOFT_CLIENT_ID=<Application (client) ID>
   MICROSOFT_CLIENT_SECRET=<client secret value>
   MICROSOFT_TENANT_ID=common
   MICROSOFT_CALLBACK_URL=http://localhost:4000/api/auth/microsoft/callback
   ```
   Use `MICROSOFT_TENANT_ID=<your-tenant-guid>` instead of `common` if you want **only** your org accounts.

8. Restart the backend. Login/Register should show **Continue with Microsoft / Outlook** enabled.

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
