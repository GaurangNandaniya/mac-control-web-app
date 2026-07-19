# Tailscale Remote Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Mac reachable from the phone whenever the Mac is on the internet (any Wi-Fi, cellular) via Tailscale, without breaking the existing LAN (`.local`) path — both entries coexist in the multi-Mac switcher.

**Architecture:** No new transports or auth. The Mac and phone join a private Tailscale tailnet (out-of-band). The server autodetects the Mac's Tailscale FQDN at startup and adds a second rumps menu item that generates a pairing QR whose `serviceUrl` uses that FQDN. mkcert cert is regenerated with the Tailscale FQDN as a SAN so a single cert works for both entry points. The client's device switcher gains a small `LAN` / `TAILSCALE` row badge (variant B from brainstorming) so the two entries are distinguishable at pair time and in the dropdown.

**Tech Stack:** Server — Python 3, Flask, rumps, `subprocess` + stdlib `json` (no new deps). Client — React 18, plain CSS (no new deps).

**Repos:** Tasks 1–3, 5 = **mac_controller** (git repo name; on disk at `Mac-Controller/server/`). Tasks 6–7 = **mac-control-web-app** (on disk at `Mac-Controller/client/`). Task 4 + Task 8 span both. **Assumed working directory for all commands below is `Mac-Controller/`** (the parent of `server/` and `client/`); adjust if you run from elsewhere.

**Verification model:** No test runner on either side. Server verifies via `python3 -c` import + curl smoke checks + rumps menu inspection. Client verifies via `npm run lint`, `npm run dev`, and a phone check at 375px width in both themes. Task 8 is the real-iPhone end-to-end.

**Spec:** `docs/superpowers/specs/2026-07-19-tailscale-remote-access-design.md`

## Global Constraints

- **No new dependencies** in either repo. Server uses `subprocess`/`json` stdlib; client uses no libraries.
- **No changes** to: Flask app factory, auth flow, JWT format, controllers, streaming servers, `.local` pairing path.
- **Existing users must see zero regression** — a device paired before this change (no `kind` field on record) must render as `LAN` with no visible difference in the LAN flow.
- **Tailscale CLI availability is optional** — if `tailscale` isn't on PATH or returns non-JSON/errors, features degrade silently (menu item hides, badge defaults to `LAN`). Never surface a warning; a Mac without Tailscale is a supported configuration.
- **Commit after every task.** Per user's standing rule, don't let work pile up uncommitted. Each task ends with a `git commit`.
- **Standalone Tailscale installer** (not the Mac App Store version) — the App Store build sandboxes the `tailscale` CLI, breaking auto-detect. Documented; not enforced in code.

---

## File Structure

```
server/                                     (repo: mac_controller)
  src/utils/tailscale.py                            # CREATE — get_tailscale_hostname()
  src/controllers/qr_generator.py                   # MODIFY — accept optional ?host= override
  mac_controller_app.py                             # MODIFY — detect FQDN + conditional rumps menu item
  setup.sh                                          # MODIFY — include Tailscale FQDN in mkcert SAN if detected
  .env.example                                      # MODIFY — document TAILSCALE_HOSTNAME (optional override)

mac-control-web-app/                                (repo: mac-control-web-app, this repo)
  src/utils/deviceStore.js                          # MODIFY — persist + read `kind`; export inferKind
  src/utils/pairing.js                              # MODIFY — set `kind` at pair time
  src/components/Remote/DeviceSwitcher.jsx          # MODIFY — render row-tag badge per row
  src/App.css                                       # MODIFY — .row-tag / .row-tag--lan / .row-tag--tailscale
```

Cert regeneration in Task 4 is a **one-time dev-machine action** for this user (not code, not committed). Task 5 (`setup.sh`) is what makes future clean installs pick up the SAN automatically.

---

## Prerequisites (out-of-band, once, before Task 1)

Install Tailscale on the Mac and iPhone using the **standalone installer from tailscale.com** (the Mac App Store version sandboxes the CLI, which breaks auto-detect). Sign in with the same Google identity on both devices.

Verify from the Mac's terminal:

```bash
tailscale status --json | python3 -c 'import json, sys; print(json.load(sys.stdin)["Self"]["DNSName"])'
```

Expected: prints an FQDN like `gaurangs-macbook-pro.tail-abcd.ts.net.` (trailing dot is fine — the helper strips it).

If this fails, stop. Everything downstream depends on it.

---

## Task 1: Tailscale hostname detection helper (repo: mac_controller)

**Files:**
- Create: `server/src/utils/tailscale.py`

**Interfaces:**
- Consumes: nothing (stdlib only).
- Produces: `get_tailscale_hostname() -> Optional[str]` — returns the Mac's Tailscale FQDN, or `None` if unavailable / opted-out. Prefers `TAILSCALE_HOSTNAME` env var when set.

- [ ] **Step 1: Create the helper**

Create `server/src/utils/tailscale.py`:

```python
"""Detect the Mac's Tailscale hostname if Tailscale is installed and up.

Callers get the FQDN (e.g. "gaurangs-macbook-pro.tail-abcd.ts.net") or None.
An explicit TAILSCALE_HOSTNAME env var always wins. Any CLI/JSON failure
returns None silently — a Mac without Tailscale is a supported
configuration, not an error condition.
"""
import json
import logging
import os
import subprocess
from typing import Optional

logger = logging.getLogger(__name__)


def get_tailscale_hostname() -> Optional[str]:
    override = os.environ.get("TAILSCALE_HOSTNAME")
    if override:
        return override.strip().rstrip(".")
    try:
        result = subprocess.run(
            ["tailscale", "status", "--json"],
            capture_output=True,
            text=True,
            timeout=2,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        logger.debug("tailscale CLI unavailable: %s", e)
        return None
    if result.returncode != 0:
        logger.debug("tailscale status exited %s", result.returncode)
        return None
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as e:
        logger.debug("tailscale status JSON parse failed: %s", e)
        return None
    dns_name = (data.get("Self") or {}).get("DNSName") or ""
    dns_name = dns_name.strip().rstrip(".")
    return dns_name or None
```

- [ ] **Step 2: Smoke-test with Tailscale running**

Run from `server/`:

```bash
./venv/bin/python3 -c "from src.utils.tailscale import get_tailscale_hostname; print(repr(get_tailscale_hostname()))"
```

Expected: `'gaurangs-macbook-pro.tail-abcd.ts.net'` (or your Mac's actual Tailscale FQDN).

- [ ] **Step 3: Smoke-test the env-var override**

```bash
TAILSCALE_HOSTNAME=custom.example.ts.net ./venv/bin/python3 -c "from src.utils.tailscale import get_tailscale_hostname; print(repr(get_tailscale_hostname()))"
```

Expected: `'custom.example.ts.net'`.

- [ ] **Step 4: Smoke-test the "Tailscale not installed" path**

```bash
PATH="/usr/bin:/bin" ./venv/bin/python3 -c "from src.utils.tailscale import get_tailscale_hostname; print(repr(get_tailscale_hostname()))"
```

Expected: `None` (the `tailscale` binary isn't on this stripped PATH).

- [ ] **Step 5: Commit**

```bash
cd server
git add src/utils/tailscale.py
git commit -m "feat(server): detect Mac's Tailscale FQDN via CLI

Returns Self.DNSName from 'tailscale status --json', with a
TAILSCALE_HOSTNAME env var override. All failure modes (missing
binary, timeout, non-zero exit, bad JSON, missing key) return
None silently — a Mac without Tailscale is supported."
```

---

## Task 2: QR endpoint accepts optional `?host=` override (repo: mac_controller)

**Files:**
- Modify: `server/src/controllers/qr_generator.py`

**Interfaces:**
- Consumes: nothing new.
- Produces: `GET /auth/qr?host=<fqdn>` — when `host` is present and passes a basic hostname regex, the QR's embedded `serviceUrl` uses that host instead of `<hostname>.local`. When absent or invalid, existing behavior is unchanged.

- [ ] **Step 1: Add a hostname validator and wire it into `qr_auth_page`**

Edit `server/src/controllers/qr_generator.py`. Add a validator near the top-of-file imports (after the existing imports, before `logger = setup_logger()`):

```python
import re

# Accepts a valid DNS hostname (labels of alphanumerics + hyphens, dot-separated).
# Guards against injecting arbitrary characters into the connection URL.
_HOST_LABEL = r"[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?"
_HOST_RE = re.compile(rf"^{_HOST_LABEL}(\.{_HOST_LABEL})*$")

def _valid_host(host: str) -> bool:
    return bool(host) and len(host) <= 253 and bool(_HOST_RE.match(host))
```

Then replace the `service_name` block inside `qr_auth_page` (currently lines 52–53):

```python
    # Host override: ?host=<fqdn> lets the menu bar generate a QR for the
    # Tailscale FQDN (or any stable hostname). Falls back to <hostname>.local.
    override = request.args.get("host", "").strip()
    if override and _valid_host(override):
        service_name = override
    else:
        hostname = socket.gethostname()
        service_name = hostname if hostname.endswith(".local") else f"{hostname}.local"
```

The rest of `qr_auth_page` is unchanged.

- [ ] **Step 2: Restart the running menu-bar app so the change takes effect**

The rumps app runs Flask in a child process; a code change needs a restart. From the terminal:

```bash
pkill -f mac_controller_app || true
cd server && ./venv/bin/python3 mac_controller_app.py &
sleep 3
```

- [ ] **Step 3: Smoke-test with no override (existing behavior)**

```bash
curl -sk "https://localhost:8080/auth/qr" | grep -oE 'serviceUrl=https://[^"&]+' | head -1
```

Expected: `serviceUrl=https://Gaurangs-MacBook-Pro.local:8080` (your Mac's `.local` name).

- [ ] **Step 4: Smoke-test with override**

```bash
TS_FQDN="$(./venv/bin/python3 -c 'from src.utils.tailscale import get_tailscale_hostname; print(get_tailscale_hostname())')"
curl -sk "https://localhost:8080/auth/qr?host=$TS_FQDN" | grep -oE 'serviceUrl=https://[^"&]+' | head -1
```

Expected: `serviceUrl=https://<your-tailscale-fqdn>:8080`.

- [ ] **Step 5: Smoke-test that a bogus host is rejected (falls back to `.local`)**

```bash
curl -sk "https://localhost:8080/auth/qr?host=nope;rm+-rf+/" | grep -oE 'serviceUrl=https://[^"&]+' | head -1
```

Expected: `serviceUrl=https://Gaurangs-MacBook-Pro.local:8080` (bogus host rejected, fell back).

- [ ] **Step 6: Commit**

```bash
cd server
git add src/controllers/qr_generator.py
git commit -m "feat(server): /auth/qr accepts optional ?host= override

When ?host=<fqdn> is present and passes a strict DNS-hostname regex,
the QR's serviceUrl uses that host instead of <hostname>.local.
Bogus/malformed hosts are silently rejected (fall back to .local).
Used by the upcoming 'QR Code (Tailscale)' menu item."
```

---

## Task 3: Rumps "QR Code (Tailscale)" menu item (repo: mac_controller)

**Files:**
- Modify: `server/mac_controller_app.py`

**Interfaces:**
- Consumes: `get_tailscale_hostname()` from Task 1; `/auth/qr?host=` from Task 2.
- Produces: a second rumps menu item, present only when a Tailscale FQDN is detected.

- [ ] **Step 1: Add the import**

At the top of `server/mac_controller_app.py`, next to the other `src.utils.*` imports:

```python
from src.utils.tailscale import get_tailscale_hostname
```

- [ ] **Step 2: Detect the FQDN at init time and create the menu item conditionally**

In `MacPyCtrlMenuBar.__init__`, just after the existing `self.qr_item = rumps.MenuItem(...)` line, add:

```python
        # QR pairing (Tailscale). Only appears when Tailscale is installed + up;
        # otherwise the menu stays clean.
        self.tailscale_hostname = get_tailscale_hostname()
        if self.tailscale_hostname:
            self.tailscale_qr_item = rumps.MenuItem(
                "QR Code (Tailscale)",
                callback=self.open_tailscale_qr_page,
            )
        else:
            self.tailscale_qr_item = None
```

- [ ] **Step 3: Insert it into the menu list**

Still in `__init__`, in the `self.menu = [...]` assignment, replace the line `self.qr_item,` with:

```python
            self.qr_item,
            *([self.tailscale_qr_item] if self.tailscale_qr_item else []),
```

(Star-unpacking a conditional list keeps the menu clean when Tailscale is absent.)

- [ ] **Step 4: Add the click handler**

Add this method to `MacPyCtrlMenuBar` (near the existing `open_qr_page`):

```python
    def open_tailscale_qr_page(self, sender):
        """Open the QR pairing page with the Tailscale FQDN as the serviceUrl host."""
        webbrowser.open(
            f"https://localhost:{self.app.config['SERVER_PORT']}/auth/qr?host={self.tailscale_hostname}"
        )
```

- [ ] **Step 5: Restart and verify the menu item appears**

```bash
pkill -f mac_controller_app || true
cd server && ./venv/bin/python3 mac_controller_app.py &
sleep 3
```

Click the "MacPyCtrl" menu-bar icon. Expected: both **QR Code** and **QR Code (Tailscale)** items are visible.

- [ ] **Step 6: Verify the Tailscale item opens the correct URL**

Click **QR Code (Tailscale)**. A browser tab opens showing a QR whose page source contains `serviceUrl=https://<your-tailscale-fqdn>:8080`. Confirm by right-clicking → View Source or by inspecting the QR-rendered page.

- [ ] **Step 7: Verify auto-hide by simulating no Tailscale**

Kill the app, then relaunch it with a stripped PATH so `tailscale` isn't found:

```bash
pkill -f mac_controller_app || true
cd server && PATH="/usr/bin:/bin" ./venv/bin/python3 mac_controller_app.py &
sleep 3
```

Click the menu. Expected: only the original **QR Code** item; **QR Code (Tailscale)** is absent.

Restart normally afterward:

```bash
pkill -f mac_controller_app || true
cd server && ./venv/bin/python3 mac_controller_app.py &
```

- [ ] **Step 8: Commit**

```bash
cd server
git add mac_controller_app.py
git commit -m "feat(server): add rumps 'QR Code (Tailscale)' menu item

Auto-hidden when Tailscale isn't detected. When present, opens the
existing /auth/qr endpoint with ?host=<tailscale-fqdn> so the QR
embeds the Tailscale hostname as serviceUrl."
```

---

## Task 4: Regenerate mkcert cert to cover Tailscale FQDN (out-of-band, one-time)

**Not committed** — this modifies the local `cert.pem`/`key.pem` on this Mac. The equivalent one-shot for future fresh installs lives in Task 5's `setup.sh`.

**Files:**
- Overwrite: `server/cert.pem`, `server/key.pem`

- [ ] **Step 1: Confirm the current cert doesn't already cover the Tailscale FQDN**

```bash
cd server
openssl x509 -in cert.pem -noout -text | grep -A1 "Subject Alternative Name"
```

If the output already lists the Tailscale FQDN, skip Steps 2–3 and jump to Step 4.

- [ ] **Step 2: Gather the hostnames**

```bash
cd server
LOCAL_NAME="$(./venv/bin/python3 -c 'import socket; h=socket.gethostname(); print(h if h.endswith(".local") else h + ".local")')"
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)"
TS_FQDN="$(./venv/bin/python3 -c 'from src.utils.tailscale import get_tailscale_hostname; print(get_tailscale_hostname() or "")')"
echo "LOCAL=$LOCAL_NAME  LAN=$LAN_IP  TS=$TS_FQDN"
```

Expected: all three non-empty.

- [ ] **Step 3: Regenerate the cert with all four hostnames**

```bash
cd server
mkcert -cert-file cert.pem -key-file key.pem \
  "$LOCAL_NAME" localhost 127.0.0.1 ::1 "$LAN_IP" "$TS_FQDN"
```

Expected output ends with `The certificate is at "./cert.pem" and the key at "./key.pem" ✅`.

- [ ] **Step 4: Verify the cert covers the Tailscale FQDN**

```bash
openssl x509 -in cert.pem -noout -text | grep -A1 "Subject Alternative Name"
```

Expected: the SAN list includes `<your-tailscale-fqdn>`, `Gaurangs-MacBook-Pro.local`, `localhost`, `127.0.0.1`, `::1`, and the LAN IP.

- [ ] **Step 5: Restart the server so it loads the new cert**

```bash
pkill -f mac_controller_app || true
cd server && ./venv/bin/python3 mac_controller_app.py &
sleep 3
```

- [ ] **Step 6: Verify TLS works for the Tailscale hostname from the Mac itself**

```bash
curl -sk "https://$TS_FQDN:8080/api/hello" -w "\nHTTP %{http_code}\n"
```

Expected: `HTTP 200` (or whatever `/api/hello` returns — the point is that TLS handshake succeeds).

**No commit** (this changes local cert files, which are already `.gitignored`).

---

## Task 5: `setup.sh` + `.env.example` for future fresh installs (repo: mac_controller)

**Files:**
- Modify: `server/setup.sh`
- Modify: `server/.env.example`

**Interfaces:**
- Consumes: `tailscale` on PATH (best-effort at setup time).
- Produces: a fresh-install cert that already covers the Tailscale FQDN if Tailscale was installed at setup time; `.env.example` documents the override.

- [ ] **Step 1: Read `setup.sh` and locate the TLS-cert section**

Section header: `# ---- 3. TLS certificates ----` (around line 61 as of the current commit).

- [ ] **Step 2: Add Tailscale-FQDN detection before the mkcert call**

Inside the `else` branch of the `if [ -f cert.pem ] && [ -f key.pem ]` block, immediately before the `say "Generating TLS cert…"` line, add:

```bash
  TS_FQDN=""
  if command -v tailscale >/dev/null 2>&1; then
    TS_FQDN="$(tailscale status --json 2>/dev/null | ./venv/bin/python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
    print((data.get("Self") or {}).get("DNSName", "").rstrip("."))
except Exception:
    pass
' || true)"
  fi
  if [ -n "$TS_FQDN" ]; then
    ok "Tailscale detected: $TS_FQDN — including as SAN"
  fi
```

- [ ] **Step 3: Include `$TS_FQDN` in the mkcert command**

Replace the existing `mkcert -cert-file cert.pem ...` line with:

```bash
  mkcert -cert-file cert.pem -key-file key.pem \
    "$LOCAL_NAME" localhost 127.0.0.1 ::1 \
    ${LAN_IP:+$LAN_IP} \
    ${TS_FQDN:+$TS_FQDN}
```

And update the `say` line above it to include the FQDN in the log:

```bash
  say "Generating TLS cert for: $LOCAL_NAME localhost 127.0.0.1 ::1 ${LAN_IP:-(no LAN IP)} ${TS_FQDN:-(no Tailscale)}"
```

- [ ] **Step 4: Update `.env.example` to document the override**

Read `server/.env.example` and append this section (add before the last blank line if there's a trailing newline pattern):

```
# Optional. Auto-detected from `tailscale status --json` at server startup if unset.
# Set explicitly to force the "QR Code (Tailscale)" menu item to use a specific
# hostname (e.g. when using Headscale with a custom control domain).
# TAILSCALE_HOSTNAME=your-mac.tail-abcd.ts.net
```

- [ ] **Step 5: Syntax-check the shell script**

```bash
cd server
bash -n setup.sh
```

Expected: exit 0, no output.

- [ ] **Step 6: Commit**

```bash
cd server
git add setup.sh .env.example
git commit -m "chore(server): setup.sh includes Tailscale FQDN as mkcert SAN

If 'tailscale' is on PATH at setup time, the generated cert already
covers the Mac's Tailscale FQDN, so no follow-up mkcert run is needed
on a fresh Mac. Also documents TAILSCALE_HOSTNAME as an optional
override in .env.example."
```

---

## Task 6: Client — `kind` field in `deviceStore` + `pairing` (repo: mac-control-web-app)

**Files:**
- Modify: `client/src/utils/deviceStore.js`
- Modify: `client/src/utils/pairing.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Exported `inferKind(serviceUrl: string) -> "lan" | "tailscale"` from `deviceStore.js`.
  - Every device object in `getDevices()` gains a `kind` property (backfilled from `serviceUrl` for legacy entries with no stored `kind`).
  - `upsertDevice({ serviceUrl, authToken, kind? })` — `kind` is optional; defaults to `inferKind(serviceUrl)`.
  - `parsePairingUrl(text)` returns `{ token, serviceUrl, kind }`.

- [ ] **Step 1: Add `inferKind` + `kind` handling to `deviceStore.js`**

Edit `client/src/utils/deviceStore.js`. Add after the imports and before `const DEVICES_KEY`:

```javascript
// A serviceUrl whose hostname ends in `.ts.net` is Tailscale's tailnet suffix
// (the internet endpoint); everything else is LAN.
export const inferKind = (serviceUrl) => {
  try {
    return new URL(serviceUrl).hostname.endsWith(".ts.net") ? "tailscale" : "lan";
  } catch {
    return "lan";
  }
};
```

Update `getDevices` to backfill `kind` on read (legacy entries stored before this feature have no `kind` field):

```javascript
export const getDevices = () => {
  try {
    const list = JSON.parse(localStorage.getItem(DEVICES_KEY));
    if (!Array.isArray(list)) return [];
    return list.map((d) => ({ ...d, kind: d.kind || inferKind(d.serviceUrl) }));
  } catch {
    return [];
  }
};
```

Update `upsertDevice` to accept + persist `kind`:

```javascript
export const upsertDevice = ({ serviceUrl, authToken, kind }) => {
  const resolvedKind = kind || inferKind(serviceUrl);
  const list = getDevices().filter((d) => d.serviceUrl !== serviceUrl);
  list.push({
    serviceUrl,
    authToken,
    name: deviceName(authToken),
    kind: resolvedKind,
    addedAt: Date.now(),
  });
  saveDevices(list);
  setActiveKeys(authToken, serviceUrl);
};
```

Update `ensureActiveRegistered` to include `kind` when migrating a pre-multi-Mac entry:

```javascript
export const ensureActiveRegistered = () => {
  const authToken = localStorage.getItem("authToken");
  const serviceUrl = localStorage.getItem("serviceUrl");
  if (authToken && serviceUrl && !getDevices().some((d) => d.serviceUrl === serviceUrl)) {
    const list = getDevices();
    list.push({
      serviceUrl,
      authToken,
      name: deviceName(authToken),
      kind: inferKind(serviceUrl),
      addedAt: Date.now(),
    });
    saveDevices(list);
  }
};
```

- [ ] **Step 2: Update `pairing.js` to set `kind` at pair time**

Edit `client/src/utils/pairing.js`:

```javascript
import axios from "axios";
import { upsertDevice, inferKind } from "./deviceStore";

// Extract token + serviceUrl from a scanned/deep-link pairing URL.
export const parsePairingUrl = (text) => {
  const url = new URL(text);
  const token = url.searchParams.get("token");
  const serviceUrl = url.searchParams.get("serviceUrl");
  if (!token || !serviceUrl) throw new Error("missing pairing params");
  return { token, serviceUrl, kind: inferKind(serviceUrl) };
};

// Exchange a temp token for a permanent one, register the Mac in the device
// list, and make it active. Returns the permanent token.
export const pairWithMac = async (serviceUrl, token, deviceName) => {
  const res = await axios.post(
    `${serviceUrl}/auth/connect`,
    { device_name: deviceName || "My Mac" },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  upsertDevice({
    serviceUrl,
    authToken: res.data.token,
    kind: inferKind(serviceUrl),
  });
  return res.data.token;
};
```

- [ ] **Step 3: Lint**

```bash
cd client
npm run lint
```

Expected: exit 0, no warnings for the touched files. (Existing unrelated warnings, if any, are pre-existing — do not fix here.)

- [ ] **Step 4: Verify in the browser console**

Start the dev server:

```bash
cd client
npm run dev &
sleep 3
```

Open `https://Gaurangs-MacBook-Pro.local:5173` on the phone (or desktop). If you're already paired, open DevTools → Console and run:

```javascript
// Existing device (paired before this change) should backfill to kind:"lan"
JSON.parse(localStorage.getItem("devices")).map(d => ({url: d.serviceUrl, storedKind: d.kind}));
```

Expected: `storedKind` may be `undefined` in the raw store (fine — that's the legacy row). Then in the module:

```javascript
import("./src/utils/deviceStore.js").then(m => console.log(m.getDevices().map(d => ({url: d.serviceUrl, kind: d.kind}))));
```

Expected: every row shows `kind: "lan"` (backfilled). Rows whose serviceUrl hostname ends in `.ts.net` show `kind: "tailscale"`.

- [ ] **Step 5: Commit**

```bash
cd client
git add src/utils/deviceStore.js src/utils/pairing.js
git commit -m "feat(devices): tag each paired Mac with 'lan' | 'tailscale' kind

Derived from the serviceUrl's hostname suffix (.ts.net = tailscale).
Legacy entries paired before this change are backfilled to 'lan' on
read, so no localStorage migration is needed. Sets up the dropdown
badge in the next commit."
```

---

## Task 7: Client — DeviceSwitcher row badge + CSS (repo: mac-control-web-app)

**Files:**
- Modify: `client/src/components/Remote/DeviceSwitcher.jsx`
- Modify: `client/src/App.css`

**Interfaces:**
- Consumes: `kind` field on each device (from Task 6).
- Produces: visible `LAN` / `TAILSCALE` badge next to each device name in the switcher dropdown. Header is unchanged.

- [ ] **Step 1: Add the badge to each dropdown row**

Edit `client/src/components/Remote/DeviceSwitcher.jsx`. Locate the row rendering inside the `open && ...` block (around lines 130–146). Replace the `<button className="device-row__pick" ...>` inner content with a version that includes the badge:

```jsx
              <div key={d.serviceUrl} className="device-row">
                <button className="device-row__pick" onClick={() => switchTo(d.serviceUrl)}>
                  <span className="device-row__check">
                    {d.serviceUrl === active && <Check size={14} strokeWidth={2.4} />}
                  </span>
                  <span className="device-row__name">{d.name}</span>
                  <span className={`row-tag row-tag--${d.kind || "lan"}`}>
                    {(d.kind || "lan") === "tailscale" ? "TAILSCALE" : "LAN"}
                  </span>
                </button>
                <button
                  className="device-row__del"
                  aria-label={`Remove ${d.name}`}
                  onClick={() => remove(d.serviceUrl)}
                >
                  <Trash2 size={14} strokeWidth={1.8} />
                </button>
              </div>
```

- [ ] **Step 2: Add the badge styles to `App.css`**

Edit `client/src/App.css`. Immediately after the `.device-add` rule (currently around lines 159–164), before the `.device-add-overlay` block, add:

```css
/* Device kind badges — inline pill in each dropdown row (matches the
   spec's variant B: header stays clean, distinction lives where the
   pick happens). */
.row-tag {
  display: inline-flex; align-items: center;
  padding: 2px 6px; border-radius: 6px;
  font-size: 9.5px; font-weight: 700; letter-spacing: 0.4px;
  line-height: 1; text-transform: uppercase; flex-shrink: 0;
  margin-left: auto;
}
.row-tag--lan {
  background: color-mix(in srgb, var(--success) 16%, transparent);
  color: var(--success);
  border: 1px solid color-mix(in srgb, var(--success) 34%, transparent);
}
.row-tag--tailscale {
  background: var(--accent-fill);
  color: var(--accent-text);
  border: 1px solid var(--accent-border);
}
```

(`margin-left: auto` pushes the badge to the right edge of the flex row so it visually reads as "here's what kind of connection this row represents".)

- [ ] **Step 3: Lint**

```bash
cd client
npm run lint
```

Expected: exit 0.

- [ ] **Step 4: Build to confirm no syntax errors**

```bash
cd client
npm run build
```

Expected: `✓ built in …` output, no errors.

- [ ] **Step 5: Visual check at iPhone width**

```bash
cd client
npm run dev
```

Open `https://Gaurangs-MacBook-Pro.local:5173` on the phone. Tap the device name to open the dropdown. Expected:
- Each row shows the device name followed by a small `LAN` (green tinted) or `TAILSCALE` (accent tinted) badge on the right.
- Names truncate with ellipsis if long; badge stays fully visible (flex-shrink: 0).
- Flip the theme (Sun/Moon icon in header) — badges remain readable in both light and dark.

- [ ] **Step 6: Commit**

```bash
cd client
git add src/components/Remote/DeviceSwitcher.jsx src/App.css
git commit -m "feat(device-switcher): show LAN / TAILSCALE badge per row

Variant B from the spec: header stays clean, badge lives in the
dropdown row where the switch is made. Green (success) for LAN,
accent for Tailscale — matches design tokens in both themes."
```

---

## Task 8: End-to-end iPhone verification + docs update (both repos)

**Files:**
- Modify: `Mac-Controller/FEATURE_BACKLOG.md`
- Modify: `client/CODEBASE_MAP.md`
- Modify: `server/CODEBASE_MAP.md`

**Prereq:** Tasks 1–7 complete. Task 4 (cert regen) already done. Menu bar app running.

- [ ] **Step 1: Confirm Tailscale is up on both devices**

- On Mac: menu bar Tailscale icon shows connected; `tailscale status` lists the phone.
- On iPhone: Tailscale app is toggled ON; the Mac appears in the device list.

- [ ] **Step 2: Pair via the Tailscale QR**

- On the Mac: click **MacPyCtrl → QR Code (Tailscale)**. A browser tab opens with the QR.
- On the phone (in the PWA): open the **Device switcher → Add another Mac**, scan the on-screen QR.
- After the scan, the app should navigate through the "Name this Mac" step (rename to something like "MacBook via TS" for clarity) → "Add this Mac".
- Expected: the app reloads, the header shows the new device active, and control endpoints work.

- [ ] **Step 3: Verify both entries render with correct badges**

Open the header device dropdown. Expected: two rows — one with `LAN` badge and one with `TAILSCALE` badge. The active row shows a checkmark.

- [ ] **Step 4: Verify the LAN entry still works (home Wi-Fi)**

Switch back to the LAN entry from the dropdown. Expected: page reloads, connection pill goes online with your usual home latency (~15–25 ms), a media/system tap works, screen stream opens.

- [ ] **Step 5: Verify the Tailscale entry works on cellular**

Turn off Wi-Fi on the phone (cellular only). Switch to the TAILSCALE entry. Expected: connection pill goes online (higher latency is fine); a media/system tap works; screen stream opens (may be slower — note it).

- [ ] **Step 6: (Optional but recommended) Verify on a different Wi-Fi**

When you're next on a café/hotel/office Wi-Fi, repeat Step 5. Expected: same result; if P2P didn't establish, DERP relay handles it and things still work.

- [ ] **Step 7: Update `FEATURE_BACKLOG.md`**

Append to `Mac-Controller/FEATURE_BACKLOG.md`'s "Post-backlog features" section:

```markdown
- [x] **19. Tailscale remote access (LAN + internet coexist)** [+server, +client] — new rumps "QR Code (Tailscale)" menu item generates a pairing QR whose serviceUrl uses the Mac's Tailscale FQDN; the multi-Mac switcher gains a `LAN` / `TAILSCALE` badge per row. mkcert cert covers both hostnames (SAN) so a single cert works both paths. Server auto-detects the FQDN via `tailscale status --json`; menu item auto-hides when Tailscale isn't installed. Zero code touching auth / controllers / streaming. _Verified on iPhone 2026-07-19 — LAN entry unchanged, Tailscale entry works on cellular and off-LAN Wi-Fi._
```

And update the "Last Updated" line at the bottom with today's date and a one-line note.

- [ ] **Step 8: Update `server/CODEBASE_MAP.md`**

In `server/CODEBASE_MAP.md`, add a new dated entry to "Last Updated" (at the top of that section, above the previous entry):

```markdown
2026-07-19 — **Tailscale remote access.** New helper `src/utils/tailscale.py` (`get_tailscale_hostname()` — reads `TAILSCALE_HOSTNAME` env override, else shells out to `tailscale status --json`; returns None silently on any failure). `qr_generator.py` `qr_auth_page` accepts an optional `?host=<fqdn>` query param (validated by a strict DNS regex) to override the QR's embedded `serviceUrl` hostname. `mac_controller_app.py` detects the FQDN at init; if present, adds a second rumps item **"QR Code (Tailscale)"** that opens `/auth/qr?host=<fqdn>`. `setup.sh` includes the FQDN in the mkcert SAN list when Tailscale is installed at setup time; `.env.example` documents the optional override. No changes to auth flow, controllers, streaming, or the existing `.local` QR path. Client-side badge lives in the `mac-control-web-app` repo (see its map).
```

- [ ] **Step 9: Update `client/CODEBASE_MAP.md`**

In `client/CODEBASE_MAP.md`, add to "Last Updated" (at the top):

```markdown
2026-07-19 — **Tailscale row badge in the device switcher.** `utils/deviceStore.js` exports `inferKind(serviceUrl)` (`.ts.net` suffix → `"tailscale"`, else `"lan"`); every device object now carries a `kind` field, backfilled on read for legacy entries so no storage migration is needed. `utils/pairing.js` sets `kind` when scanning a QR / calling `pairWithMac`. `components/Remote/DeviceSwitcher.jsx` renders a `.row-tag` (LAN / TAILSCALE) after each device name in the dropdown; new `.row-tag*` CSS in `App.css` uses `--success` (LAN) and `--accent` (Tailscale) so both themes work from the same tokens. Header switcher button is unchanged (variant B from the spec — same name for both entries; distinction lives in the dropdown row where the pick is made). Server side is in `../server`'s Last Updated for the same date.
```

- [ ] **Step 10: Commit the docs updates in each repo**

```bash
cd server
git add CODEBASE_MAP.md
git commit -m "docs(map): tailscale remote access (server side)"
```

```bash
cd client
git add CODEBASE_MAP.md
git commit -m "docs(map): tailscale row badge in device switcher"
```

Note: `FEATURE_BACKLOG.md` sits in `Mac-Controller/` which is **not a git repo** (per project convention). Edit it, but don't try to commit — the edit stands as the shared source of truth.

- [ ] **Step 11: Stop the preview server if it's still running**

```bash
pkill -f "http.server 8765" || true
```

---

## Self-Review checklist (fill in after implementation)

Before marking Task 8 complete, walk through the spec's Verification Bar and mark each item:

- [ ] Home Wi-Fi, LAN entry: control + screen stream, ping ≈ today.
- [ ] Cellular, Tailscale entry: control + screen stream, latency noted.
- [ ] Different Wi-Fi (later): Tailscale entry works, DERP fallback confirmed if P2P didn't establish.
- [ ] Menu bar shows both QR items with Tailscale up; only LAN with Tailscale off.
- [ ] Dropdown badges render correctly in light + dark, at 375px width.
- [ ] Regression check: a Mac without Tailscale (or a user who never pairs via Tailscale) sees no visible change.
