# Tailscale Remote Access (LAN + Internet Coexistence) — Design

Date: 2026-07-19
Repos: **mac_controller** (server: cert regen, rumps menu item, QR variant, hostname auto-detect) + **mac-control-web-app** (client: dropdown row badge). Post-backlog #19.

## Goal
Make the Mac reachable from the phone whenever the Mac is on the internet — including different Wi-Fis and cellular — **without giving up the existing LAN path**. Both endpoints coexist as entries in the multi-Mac switcher; the user picks per-trip.

## Approach (why Tailscale)
Tailscale is a WireGuard mesh with a coordination server. The Mac and phone form a **peer-to-peer** WireGuard tunnel when possible and fall back to DERP relays (encrypted TCP on outbound 443) when NAT is hostile — the only protocol every hotel/café/office Wi-Fi allows. Nothing is publicly reachable; the tailnet is private to the user's identity. Self-hosting the coordinator (Headscale) is a deferred option — the client change is a one-line control-URL swap if we ever migrate.

Rejected alternatives (recorded, so we don't re-litigate):
- **IPv6-direct + Let's Encrypt** — user's ISP does dual-stack; IPv6 direct works at home but fails from arbitrary Wi-Fis that don't route IPv6 to clients or block inbound.
- **Port-forward + DDNS** — CGNAT on IPv4 rules it out, and the unauthenticated streaming servers on 9090/9091/9092 make public exposure untenable without a much larger refactor.
- **Cloudflare Tunnel + Access** — real public URL, more setup, needs a tunnel per streaming port; picked B in the earlier variant discussion; keep as a future path if we ever want a public URL for reasons other than personal access.
- **DIY "log IP to Firebase" P2P** — solves DDNS but not NAT traversal; without STUN/TURN/ICE this doesn't produce a reachable socket. Tailscale is that architecture, already built.

## Scope / non-goals
- **In scope:** cert covers both hostnames; server auto-detects the Tailscale FQDN at startup; a second rumps menu item generates a pairing QR whose `serviceUrl` uses the Tailscale FQDN; client's device switcher shows a small **LAN / TAILSCALE** row badge in the dropdown to distinguish the two entries at pair time.
- **Explicitly deferred to a later feature:**
  - Client-side auto-fallback (try `.local`, fall back to Tailscale hostname on failure). Manual switching via the header dropdown covers day-one need.
  - Tailscale ACLs restricting Mac ports to the phone device.
  - Notification-on-new-connect from the Mac side.
  - Shorter JWT + refresh-token flow.
  - Auth-gating the streaming ports 9090/9091/9092. They remain reachable to any device on the tailnet; acceptable because the tailnet has only the user's own devices.
- **Untouched:** Flask app factory, auth flow, JWT format, controllers, streaming architecture, existing `.local` pairing path.

## Out-of-band setup (user, one-time)
1. Install Tailscale on the Mac — **standalone installer from tailscale.com** (not the Mac App Store build; the App Store one sandboxes the `tailscale` CLI which we need at startup). Sign in with Google.
2. Install Tailscale on the iPhone (App Store). Sign in with **the same Google identity** so both devices land in one tailnet.
3. Verify: on the iPhone Tailscale app, the Mac appears in the device list. On the Mac, `tailscale status --json` returns a `Self.DNSName` like `gaurangs-macbook-pro.tail-abcd.ts.net`. This FQDN is stable.

## mkcert cert covering both hostnames
Regenerate the leaf cert to include the Tailscale FQDN as a SAN so a single cert works for both entry points:

```
mkcert Gaurangs-MacBook-Pro.local localhost 127.0.0.1 <tailscale-fqdn>
```

- The phone already trusts the mkcert root CA (Full Trust installed earlier) — no re-trust dance.
- Point `.env` `CERTIFICATE_PATH` / `PRIVATE_KEY_PATH` at the new files (either overwrite the old ones or rename and repoint).
- No server code change to accept the new cert — `run_flask_server()` already reads the paths from `.env`.

`server/setup.sh` gets a lightweight edit: if `tailscale` is installed and `TAILSCALE_HOSTNAME` isn't already in `.env`, add it (see below) and include the FQDN in the mkcert call. Doesn't break the "no Tailscale" path.

## Server (`mac_controller`)

**1. Auto-detect the Tailscale FQDN at menu-bar app startup.**
- New helper `src/utils/tailscale.py` exporting `get_tailscale_hostname() -> Optional[str]`:
  - Prefer `os.environ.get("TAILSCALE_HOSTNAME")` (explicit override always wins; useful for headless).
  - Otherwise `subprocess.run(["tailscale", "status", "--json"], capture_output=True, text=True, timeout=2)`, parse JSON, return `data["Self"]["DNSName"].rstrip(".")`.
  - Any failure (binary missing, non-zero exit, timeout, JSON key absent) → return `None`. Log at debug level; never at warn — a Mac without Tailscale should be silent.
- `mac_controller_app.py` calls this once at startup and stashes the result on the rumps App instance (`self.tailscale_hostname`).

**2. New rumps menu item: "Show Tailscale Pairing QR".**
- Added to the same submenu as the existing pairing QR item.
- **Auto-hide when `self.tailscale_hostname` is None** (matches the "quieter menu, matches your just-works philosophy" call from the earlier design discussion — no dead menu items when Tailscale isn't set up).
- On click, calls the same pairing QR path that the existing item uses, but with the `override_host` parameter set (see next).

**3. `qr_generator.py`: parameterize the pairing URL host.**
- `generate_pairing_qr(...)` gains an optional `override_host: Optional[str] = None` parameter.
- If set, the QR's `serviceUrl` is built as `f"https://{override_host}:{SERVER_PORT}"` — bypassing the current `<hostname>.local` derivation.
- If unset, existing behavior (host from `socket.gethostname()`, `.local` appended if missing) is unchanged.
- The existing "Show Pairing QR" menu item calls it with no `override_host`; the new "Show Tailscale Pairing QR" item passes `self.tailscale_hostname`.
- Rate limiting, temp-token generation, and QR rendering are unchanged — the only difference is the embedded `serviceUrl`.

**4. Env var addition (documented, optional).**
- `.env.example` gains `# TAILSCALE_HOSTNAME=your-mac.tail-abcd.ts.net  # optional; auto-detected via tailscale CLI if unset`.
- No default value; unset is fine.

**No changes** to: `server.py`, controllers, `auth_manager.py`, `config.py`, streaming servers, the existing `.local` QR item.

## Client (`mac-control-web-app`) — Variant B (badge in dropdown only)

**Data model change (`utils/deviceStore.js`).**
- Each device entry gains an optional `kind: "lan" | "tailscale"` field.
- Migration: existing entries without a `kind` are treated as `"lan"` on read (default in the accessor). No storage rewrite; new pairings via the Tailscale QR store `kind: "tailscale"`.
- Detection at pair time: if `serviceUrl`'s hostname ends in `.ts.net`, `kind = "tailscale"`; else `"lan"`. Kept in `parsePairingUrl` (`utils/pairing.js`) so both the Connect screen and DeviceSwitcher scan flow tag correctly.

**UI change (`components/Remote/DeviceSwitcher.jsx`).**
- Dropdown rows render a small badge to the right of the device name:
  - `<span class="row-tag row-tag--lan">LAN</span>` or `<span class="row-tag row-tag--ts">TAILSCALE</span>`.
- Header switcher button is **unchanged** — same device name for both entries (accurate: same Mac, different transport). Header stays visually clean.
- Badge styles are new CSS in `App.css`, tokens-only (no hard-coded colors):
  - `--lan` badge uses `--success` color-mix (matches the "healthy home network" mental model).
  - `--ts` badge uses `--accent` color-mix (matches the "internet path via our tailnet" mental model).

**No changes** to: `useMacApi`, connection pill logic, pairing flow (`pairWithMac` already accepts any `serviceUrl`), routing, service worker.

## How LAN + Internet coexist day-to-day

- At home: user picks the `LAN` entry → traffic goes over LAN (`.local` → macOS Bonjour → LAN IP). Latency identical to today. Tailscale is idle.
- Anywhere else: user picks the `TAILSCALE` entry → Tailscale routes P2P when possible, DERP-relayed otherwise. The mkcert cert covers this hostname too.
- Both entries live permanently in the switcher. Switching is one tap in the header dropdown.
- The connection pill's ping (`/connections/ping`) works for both paths since it's just an authenticated HTTP round-trip to the current `serviceUrl`.

## Gotchas / operating notes
- **Tailscale iOS app must be active** for the Tailscale entry to work. If the phone's Tailscale VPN is off, the connection pill goes offline. Standard iOS Tailscale usage is "always on"; the app supports this well.
- **`tailscale` CLI location.** The standalone-installer path puts it in `/usr/local/bin/tailscale` (on PATH). If the user installed the App Store version, `subprocess.run(["tailscale", ...])` fails → auto-detect returns `None` → menu item hides. That is the intended fallback; the setup docs must call out "standalone installer only" so the user isn't surprised.
- **Cert regeneration is a one-time step.** Once the SAN covers both hostnames, the cert is good for the mkcert CA lifetime; the phone doesn't need re-trusting.
- **Streaming ports on the tailnet.** 9090/9091/9092 remain unauthenticated and reachable to any tailnet device. Acceptable — the tailnet is private to the user's own devices. If the user ever adds a friend's device to their tailnet (e.g. to help debug), those ports become reachable to that device too. Future ACL work would gate this.
- **DERP-relayed streaming may be slower** than LAN — MJPEG screen share pays the relay path. Measure once; if unusable, that's a signal to add a "reduce quality when on Tailscale" toggle in a later feature.
- **No new dependencies on either side.** Server: uses `subprocess` + stdlib `json`. Client: pure CSS + one string in `deviceStore`.

## Verification bar
- **Home Wi-Fi, `LAN` entry:** control works, screen stream works, ping latency ≈ today (~15–25 ms).
- **Cellular (Wi-Fi off), `TAILSCALE` entry:** control works; screen stream works (may be slower); ping latency measured and noted.
- **Different café/hotel Wi-Fi, `TAILSCALE` entry:** control works. Confirm at least one network where P2P doesn't establish and DERP takes over — verifies the fallback path.
- **Menu bar shows both QR items** on a Mac with Tailscale installed and running; **only the LAN QR item** on a Mac without Tailscale.
- **Dropdown badges** render correctly in light + dark theme; text stays readable at iPhone width.
- **Regression:** existing single-entry (no-Tailscale) users see no visible change (`kind` defaults to `lan`, badge renders as `LAN`, everything else identical).

## Rollout / rollback
- **Rollout:** cert regen and `.env` swap are the only irreversible-ish steps. Everything else is code, revertable with a git checkout.
- **Rollback:** delete the new Tailscale menu item + revert `qr_generator.py`'s optional param + delete the client's `kind` accessor. The existing `.local` path is untouched throughout, so the app keeps working through partial rollback.

## Open questions (decide during implementation)
- Whether to persist the auto-detected Tailscale hostname to `.env` on first detect (so it survives a Tailscale outage/restart) or re-derive on every launch. Leaning re-derive — simpler, and Tailscale-down means the Tailscale entry is useless anyway.
- Row-tag copy: `TAILSCALE` reads a bit shouty. `TS` is too cryptic. Sticking with `TAILSCALE` in caps to match the design mock; revisit if it feels heavy in the real app.
