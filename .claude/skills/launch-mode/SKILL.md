---
name: launch-mode
description: Activate or deactivate launch-mode for the investment-tracker — temporarily triples NextAuth rate limits so a burst of investor logins/password-resets during a launch window can't trip the credential-stuffing throttles. TRIGGER when the user says "launch mode on", "activate launch mode", "launch mode off", "deactivate launch mode", "/launch-mode", or describes an upcoming investor onboarding window where many people will log in at once.
---

# Launch mode

This repo gates auth rate limits behind the `AUTH_LIMIT_BOOST` env var. When the var is `"true"`, login and password-reset caps triple for the duration of a launch window. Defaults are restored by removing the var.

| Endpoint | Default | Boosted |
|---|---|---|
| Login (per email) | 15 / 15min | **45 / 15min** |
| Login (per IP) | 60 / 15min | **180 / 15min** |
| Password reset (per email) | 3 / hour | **9 / hour** |
| Password reset (per IP) | 10 / hour | **30 / hour** |

The implementation is in [src/lib/auth.ts](src/lib/auth.ts) and [src/actions/auth-actions.ts](src/actions/auth-actions.ts) — both read `process.env.AUTH_LIMIT_BOOST` once per request, so toggling is just an env-var change + redeploy.

## What this skill does

When the user invokes it, parse their intent:

- **Activate** ("on", "activate", "enable", "start", "before launch"): set `AUTH_LIMIT_BOOST=true` on Vercel for Production (and Preview if they ask), then trigger a redeploy.
- **Deactivate** ("off", "deactivate", "disable", "stop", "after launch", "revert"): remove `AUTH_LIMIT_BOOST` from Vercel and trigger a redeploy.
- **Status** ("status", "is launch mode on", "check"): just read the current value and report.

Default to asking which mode they want if it's ambiguous.

## Steps to execute

### Preflight

1. Confirm the user's intent in one sentence ("Activating launch mode now — triples auth limits until you turn it off"). No deep planning loop, this is a one-flag toggle.
2. Detect whether the Vercel CLI is installed: `vercel --version`.
   - If installed and linked: use it (next step).
   - If not installed: print step-by-step manual instructions for the Vercel dashboard. Do NOT try to install the CLI silently.

### CLI path (preferred)

For **activate**:

```bash
# Set on production
vercel env add AUTH_LIMIT_BOOST production
# When prompted for the value, enter: true

# Optionally also on preview (helpful for staging tests)
vercel env add AUTH_LIMIT_BOOST preview

# Trigger a redeploy so the new env var takes effect
vercel deploy --prod
```

For **deactivate**:

```bash
vercel env rm AUTH_LIMIT_BOOST production
vercel env rm AUTH_LIMIT_BOOST preview  # if it was set there
vercel deploy --prod
```

For **status**:

```bash
vercel env ls production | grep AUTH_LIMIT_BOOST
```

The `vercel env add` command is interactive (prompts for the value). Pass the value via stdin if scripting:

```bash
echo "true" | vercel env add AUTH_LIMIT_BOOST production
```

### Manual path (no CLI)

Print these steps verbatim to the user:

1. Open https://vercel.com/dashboard → select **investment-tracker** project.
2. Settings → Environment Variables.
3. **To activate:** Add a new variable. Name: `AUTH_LIMIT_BOOST`. Value: `true`. Environments: Production (and Preview if testing). Save.
4. **To deactivate:** Find `AUTH_LIMIT_BOOST` in the list → click ⋯ → Remove → confirm.
5. Deployments → click ⋯ on the latest production deploy → **Redeploy** → confirm. Wait ~2 min.

### Confirmation

After execution, wait for the redeploy to finish, then confirm to the user:

- Print which mode is now active and the new caps from the table above.
- Remind them to invoke this skill again to deactivate after the launch window.
- Optionally tail the auth logs for a minute: `vercel logs --since 5m | grep "[auth]"` to verify nothing's being throttled.

## Guardrails

- **Never bake `AUTH_LIMIT_BOOST=true` into committed `.env*` files** — this is a deliberate operational toggle, not a code default.
- **Never auto-activate** without the user asking. The boost reduces protection against credential-stuffing attacks; it's a deliberate trade for a known launch window.
- **Default response if asked "should I always have it on?"**: No — only during a known burst (announced launch, demo day, etc.). Default limits are correct for steady-state.
- After major usage spikes pass, remind the user once that boost is still active and offer to deactivate.
