# Secure Deployment Guide for OptionsOracle

This guide outlines the pathways to deploy your **OptionsOracle** dashboard to the internet securely. Since the application contains private trading actions (Dhan F&O integration, sandbox, custom portfolios) and a user access system, it is vital to keep all connections encrypted (HTTPS/SSL) and expose only what is absolutely necessary.

---

## Architecture Overview

```
                        +---------------------------------------+
                        |           Cloudflare Edge             |
                        |     (SSL Termination, DDoS Shield)    |
                        +------------------+--------------------+
                                           |
                                 Secure HTTPS Tunnel
                                           |
                                           v
                        +------------------+--------------------+
                        |           Your Home PC                |
                        |  (Runs backend on 8000 & frontend)    |
                        +------------------+--------------------+
                                           |
                    +----------------------+----------------------+
                    |                                             |
                    v                                             v
       +------------+------------+                   +------------+------------+
       |   FastAPI Backend Server|                   |   Vite Frontend Web App |
       |     (Port 8000, SQLite) |                   |      (Production Build) |
       +-------------------------+                   +-------------------------+
```

---

## Method A: Home PC Server with Cloudflare Tunnels (Recommended)

Running the app from your home computer but making it accessible anywhere is best achieved using a **Cloudflare Tunnel** (`cloudflared`). 

### Why Cloudflare Tunnels?
* **No Port Forwarding**: You do not need to open any ports on your home router or expose your home IP address.
* **Automatic HTTPS**: Cloudflare handles SSL certificates for your domain automatically.
* **DDoS Protection**: Traffic is routed through Cloudflare's global edge network first, blocking malicious traffic before it hits your home computer.

### Step-by-Step Setup

#### 1. Setup a Domain in Cloudflare
1. Sign up for a free account at [Cloudflare](https://www.cloudflare.com/).
2. Add a custom domain you own (e.g., `yourdomain.com`) to Cloudflare and point your domain registrar's Name Servers (NS) to Cloudflare.

#### 2. Install Cloudflare Tunnel Client (`cloudflared`)
1. Download the Windows MSI installer from the [Cloudflare Downloads page](https://github.com/cloudflare/cloudflared/releases).
2. Install it on your home computer.
3. Open PowerShell or Command Prompt as Administrator and verify the installation:
   ```cmd
   cloudflared --version
   ```

#### 3. Log In and Authenticate
1. Authenticate the local agent with your Cloudflare account:
   ```cmd
   cloudflared tunnel login
   ```
2. A browser window will open. Select your domain (`yourdomain.com`) and click **Authorize**. This downloads a certificate file (`cert.pem`) to your local user directory.

#### 4. Create the Tunnel
1. Run the command to create a tunnel (replace `options-oracle-tunnel` with your preferred name):
   ```cmd
   cloudflared tunnel create options-oracle-tunnel
   ```
2. This generates a UUID for your tunnel and saves a credential file (.json) in your `.cloudflared` folder. Note the UUID!

#### 5. Configure Routing (DNS Records)
Create two DNS entries in Cloudflare to map subdomains to your local services:
* **Frontend mapping**:
  ```cmd
  cloudflared tunnel route dns options-oracle-tunnel options.yourdomain.com
  ```
* **Backend API mapping**:
  ```cmd
  cloudflared tunnel route dns options-oracle-tunnel options-api.yourdomain.com
  ```

#### 6. Create Tunnel Configuration File
Create a configuration file named `config.yml` in your `.cloudflared` directory (usually `C:\Users\YourUser\.cloudflared\config.yml`):

```yaml
tunnel: <YOUR-TUNNEL-UUID>
credentials-file: C:\Users\<YourUser>\.cloudflared\<YOUR-TUNNEL-UUID>.json

ingress:
  # Route API traffic to local FastAPI port 8000
  - hostname: options-api.yourdomain.com
    service: http://localhost:8000
  
  # Route Web traffic to local frontend server port 3000 (production build)
  - hostname: options.yourdomain.com
    service: http://localhost:3000

  # Catch-all rule (required by cloudflared)
  - service: http_status:404
```

#### 7. Update Frontend API Endpoint
Before building the frontend, change the backend connection URL in `frontend/src/hooks/useStore.ts` (line 33) to point to your public API subdomain:
```typescript
const BACKEND_URL = "https://options-api.yourdomain.com";
```

#### 8. Build and Run the App locally in Production mode
1. **Build and Serve Frontend**:
   Build the static files using Vite, then host it using a lightweight local web server on port 3000:
   ```cmd
   cd frontend
   npm run build
   # Install 'serve' globally to run a fast static file server
   npm install -g serve
   serve -s dist -l 3000
   ```
2. **Start Backend**:
   Make sure you have your virtual environment activated and start the backend:
   ```cmd
   cd backend
   python run.py
   ```

#### 9. Start the Tunnel
To start routing internet traffic securely to your home server, run:
```cmd
cloudflared tunnel run options-oracle-tunnel
```
You can now access your secured application from any browser at `https://options.yourdomain.com` with full HTTPS encryption!

*Tip: To keep the tunnel running 24/7, you can install it as a Windows Service:*
```cmd
cloudflared service install
```

---

## Method B: Full Cloud Hosting (Render + Vercel)

If you don't want to keep your home computer running all the time, you can host the backend on Render and the frontend on Vercel for free.

### 1. Backend on Render (FastAPI + Persistent SQLite)
SQLite databases are normally file-based and ephemeral. When Render restarts a web app container, files are deleted. To solve this, you **must** attach a persistent volume:

1. Push your `backend/` folder to a repository on GitHub.
2. Log in to [Render](https://render.com/) and click **New > Web Service**.
3. Link your GitHub repository.
4. Configure these fields:
   * **Runtime**: `Python`
   * **Build Command**: `pip install -r requirements.txt`
   * **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Go to the **Advanced** tab:
   * Click **Add Environment Variable**:
     * `JWT_SECRET`: Generate a secure, random string (e.g. `openssl rand -hex 32`).
     * `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`: (Your Twilio credentials if using SMS OTP).
     * `DHAN_CLIENT_ID` / `DHAN_ACCESS_TOKEN`: (Your Dhan keys).
6. Under **Disk (Persistent Volume)**:
   * Click **Add Disk**.
   * Mount Path: `/data`
   * Size: `1 GB` (Plenty for SQLite database).
7. In your backend `.env` configuration (or environment settings), make sure you point the database creation path to the persistent `/data` folder to prevent database resets on rebuilds. (Our SQLAlchemy configuration in `session.py` resolves database directory structure dynamically under `backend/data/options_oracle.db`, so on Render you can set a disk mount pointing to `e:\Option oracle rebuild\options oracle from scratch\backend\data` or update the database path via a DB url override).

### 2. Frontend on Vercel
1. Push your `frontend/` folder to GitHub.
2. Sign in to [Vercel](https://vercel.com/) and click **Add New > Project**.
3. Select your repository.
4. Set the **Framework Preset** to `Vite`.
5. Set the **Root Directory** to `frontend`.
6. Add the environment variable:
   * Set the API endpoint: In `useStore.ts`, ensure the backend connects to your public Render service URL (`https://your-backend.onrender.com`).
7. Click **Deploy**. Vercel will automatically compile, serve, and assign a secure HTTPS domain to your site.

---

## Production Security Hardening Checklist

- [ ] **Generate Production JWT Secret**: Never use the default JWT secret in production. Generate a strong key using:
  ```cmd
  python -c "import secrets; print(secrets.token_hex(32))"
  ```
  Set this value as the `JWT_SECRET` environment variable in your production environment.
- [ ] **Verify Role Escalation**: The first phone number that registers on the deployed site will immediately become the **Owner** (gets read/write access). Confirm that all subsequent users who sign up are automatically assigned the **Viewer** role (locked to read-only option chains and scanners).
- [ ] **Enable Twilio SMS in Production**: Add real Twilio credentials to your production `.env` to enable real phone SMS authentication.
- [ ] **Set CORS Constraints**: In `backend/app/main.py`, replace `allow_origins=["*"]` with your specific frontend domain (e.g., `allow_origins=["https://options.yourdomain.com"]`) to block unauthorized websites from querying your API.
