# Asteroids

A Phaser 4 Asteroids game and the leaderboard API behind it, in one repo.

```
game/    Phaser + Vite + TypeScript  →  Cloudflare Pages
api/     Worker + D1, no dependencies →  api.brycebohling.com/asteroids/*
```

| | |
|---|---|
| Game | `cd game && npm install && npm run dev` → http://localhost:5199 |
| API | `cd api && npm install && npm run migrate:local && npm run dev` → http://127.0.0.1:8787 |
| Game against the local API | put `VITE_API_BASE=http://127.0.0.1:8787/asteroids` in `game/.env.local` |

Both halves deploy from `main` through GitHub Actions, and only when their own
directory changes — see `.github/workflows/`.

## The API

Three routes, all under `/asteroids`:

| Route | Notes |
|---|---|
| `GET /asteroids/health` | Liveness probe. Touches no database on purpose. |
| `GET /asteroids/scores?limit=10` | Top N (max 25), cached 30s at the edge. |
| `POST /asteroids/scores` | Submit a run: `{initials, score, wave, shots, hits}`. |

It runs on the existing `leaderboard` D1 database (a new `asteroids_scores`
table, not a new database) and on a route more specific than the older
`leaderboard-api` Worker's `api.brycebohling.com/*`, so neither DNS nor
Terraform in `cf-infra` needs to change.

### What "secure" means here, and what it doesn't

There are no accounts, so the API cannot know that a submitted run really
happened. It can only make a forged run awkward and implausible:

- **Strict validation.** Initials are three letters; every number is a bounded
  integer; hits can't exceed shots; the score has to be arithmetically
  reachable from the hits and wave claimed (20–100 points per kill times the
  wave), and the wave has to be reachable from the number of hits.
- **Origin allowlist.** CORS answers only the game's own origins. Add preview
  URLs through the `EXTRA_ORIGINS` var rather than editing code.
- **Per-IP rate limits.** 5 submissions and 30 reads per minute, via Workers'
  rate-limiting binding — free, and it stores nothing.
- **A closed board.** A run that can't beat 100th place is answered honestly
  and never written.

**It does not stop a determined person from POSTing a believable score.**
Nothing short of validating a replay of the run server-side would, and this
game doesn't record runs. If the board starts attracting garbage, the next
step is Turnstile on submit, not more validation rules.

### Staying inside the free tier

D1's free tier allows 100k row writes and 5M row reads per *account* per day,
and this account already runs 30–45k writes daily. So:

- Reads are answered by an index on `(score DESC, id ASC)` and cached for 30
  seconds, rather than scanning and sorting the table per request.
- Submissions that can't place cost one indexed read and zero writes.
- The board self-trims to 100 rows in the same round trip as the insert.
- `/health` exists so uptime monitoring doesn't run a query every five
  minutes. Point `cf-monitor` at it, not at `/scores`.

## First deploy

The code is ready; the account plumbing is not. These need to be run by
someone with the cf-infra provisioner token:

1. **Pages project.** Add an `asteroids` static-site module block to
   `sites.tf` in `cf-infra` (mm/hs are the template) for
   `asteroids.brycebohling.com`.
2. **CI token + repo secrets.** From `cf-infra`:
   ```sh
   op run --env-file=.env -- node scripts/provision-site.mjs \
     --project asteroids --repo brycebohling/asteroids \
     --hostname asteroids.brycebohling.com
   ```
   The token needs D1 write as well as Workers Scripts and Pages, since the
   API workflow applies migrations.
3. **Push to `main`.** `deploy-api.yml` applies the migration and deploys the
   Worker; `deploy-game.yml` builds and deploys the game.
4. **Verify:** `curl https://api.brycebohling.com/asteroids/health` returns
   `ok`, and `.../scores` returns `{"results":0,"data":[]}`.

Note that this repo lives on the `brycebohling` GitHub account, which was
compromised in July 2026 (see the incident report in `cf-infra/docs`). The
deploy token in its GitHub secrets is scoped to this project only — keep 2FA
on the account and don't widen it.

