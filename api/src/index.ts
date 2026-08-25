/**
 * Asteroids leaderboard API.
 *
 * Serves api.brycebohling.com/asteroids/* from the existing `leaderboard` D1
 * database. No dependencies on purpose: the whole thing is one fetch handler
 * over prepared statements, so there is no framework, no ORM, and nothing in
 * the bundle that a supply-chain attack could reach.
 *
 * What "secure" means here, stated plainly: there are no accounts, so the API
 * cannot know that a submitted run really happened. It can only make a fake
 * run expensive and implausible — strict validation, an origin allowlist, a
 * per-IP rate limit, and a board that only accepts scores good enough to place.
 * Anyone determined can still curl a believable score; catching that would
 * take server-side replay of the run, which this game does not do.
 */

export interface Env {
    DB: D1Database;
    //  Rate limiters are optional so `wrangler dev` works without them.
    SUBMIT_LIMIT?: RateLimit;
    READ_LIMIT?: RateLimit;
    //  Comma-separated additions to the origin allowlist (preview URLs).
    EXTRA_ORIGINS?: string;
}

interface Run {
    initials: string;
    score: number;
    wave: number;
    shots: number;
    hits: number;
}

/** Rows kept on the board. Anything below the cut is never written. */
const BOARD_SIZE = 100;

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

/** Seconds a top-N response may be served from the edge cache. */
const CACHE_SECONDS = 30;

const INITIALS_PATTERN = /^[A-Z]{3}$/;

//  Bounds taken from the game's own scoring: a rock is worth 20, 50 or 100
//  points times the current wave, and clearing one large rock takes seven
//  kills (it splits into two mediums, which split into four smalls).
const MIN_POINTS_PER_KILL = 20;
const MAX_POINTS_PER_KILL = 100;
const MIN_KILLS_PER_WAVE = 7;

const MAX_SCORE = 10_000_000;
const MAX_WAVE = 999;
const MAX_SHOTS = 100_000;

const ALLOWED_ORIGINS = [
    "https://asteroids.brycebohling.com",
    "https://brycebohling.com",
    "http://localhost:5199",
    "http://localhost:8080",
];

/**
 * A deliberately short list. It exists so a three-letter slur doesn't end up
 * on a kid's game over screen, not to be a complete profanity filter — those
 * are unwinnable in three characters.
 */
const BLOCKED_INITIALS = new Set([
    "ASS",
    "CNT",
    "CUM",
    "DIK",
    "FAG",
    "FUC",
    "FUK",
    "KKK",
    "NIG",
    "SEX",
    "TIT",
    "WTF",
]);

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json; charset=utf-8", ...headers },
    });

const corsHeaders = (request: Request, env: Env): Record<string, string> => {
    const origin = request.headers.get("Origin");

    if (!origin) {
        return {};
    }

    const extra = (env.EXTRA_ORIGINS ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

    if (![...ALLOWED_ORIGINS, ...extra].includes(origin)) {
        return {};
    }

    return {
        "access-control-allow-origin": origin,
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "86400",
        vary: "Origin",
    };
};

/** True only for a finite integer inside [min, max]. Rejects NaN and floats. */
const isInt = (value: unknown, min: number, max: number): value is number =>
    typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

/**
 * Rejects anything the game itself could not have produced. The arithmetic
 * bounds are the useful part: a run that claims a huge score off a handful of
 * hits, or a deep wave it could not have cleared, fails here.
 */
const validate = (body: unknown): { run: Run } | { error: string } => {
    if (typeof body !== "object" || body === null) {
        return { error: "body must be an object" };
    }

    const { initials, score, wave, shots, hits } = body as Record<string, unknown>;

    if (typeof initials !== "string" || !INITIALS_PATTERN.test(initials)) {
        return { error: "initials must be three letters A-Z" };
    }

    if (BLOCKED_INITIALS.has(initials)) {
        return { error: "initials rejected" };
    }

    if (!isInt(score, 1, MAX_SCORE)) {
        return { error: `score must be an integer in 1..${MAX_SCORE}` };
    }

    if (!isInt(wave, 1, MAX_WAVE)) {
        return { error: `wave must be an integer in 1..${MAX_WAVE}` };
    }

    if (!isInt(shots, 0, MAX_SHOTS)) {
        return { error: `shots must be an integer in 0..${MAX_SHOTS}` };
    }

    if (!isInt(hits, 0, shots)) {
        return { error: "hits must be an integer no greater than shots" };
    }

    if (hits === 0) {
        return { error: "a scoring run must have at least one hit" };
    }

    if (score < hits * MIN_POINTS_PER_KILL) {
        return { error: "score is too low for the number of hits" };
    }

    if (score > hits * MAX_POINTS_PER_KILL * wave) {
        return { error: "score is too high for the number of hits" };
    }

    if (hits < (wave - 1) * MIN_KILLS_PER_WAVE) {
        return { error: "too few hits to have reached that wave" };
    }

    return { run: { initials, score, wave, shots, hits } };
};

const clientIp = (request: Request) => request.headers.get("CF-Connecting-IP") ?? "unknown";

const topScores = async (env: Env, limit: number) => {
    const { results } = await env.DB.prepare(
        `SELECT initials, score, wave, shots, hits, created_at
           FROM asteroids_scores
          ORDER BY score DESC, id ASC
          LIMIT ?`
    )
        .bind(limit)
        .all<{
            initials: string;
            score: number;
            wave: number;
            shots: number;
            hits: number;
            created_at: string;
        }>();

    return results.map((row) => ({
        initials: row.initials,
        score: row.score,
        wave: row.wave,
        shots: row.shots,
        hits: row.hits,
        createdAt: row.created_at,
    }));
};

const handleGet = async (request: Request, env: Env, ctx: ExecutionContext, cors: Record<string, string>) => {
    if (env.READ_LIMIT) {
        const { success } = await env.READ_LIMIT.limit({ key: clientIp(request) });

        if (!success) {
            return json({ error: "rate limited" }, 429, cors);
        }
    }

    const url = new URL(request.url);
    const requested = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
    const limit = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), MAX_LIMIT) : DEFAULT_LIMIT;

    //  Normalize the cache key so ?limit=10 and the bare URL share an entry.
    const cacheKey = new Request(`${url.origin}/asteroids/scores?limit=${limit}`, { method: "GET" });
    const cache = caches.default;
    const cached = await cache.match(cacheKey);

    if (cached) {
        return new Response(cached.body, { status: cached.status, headers: { ...cached.headers, ...cors } });
    }

    const data = await topScores(env, limit);
    const body = JSON.stringify({ results: data.length, data });

    const cacheable = new Response(body, {
        headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": `public, max-age=${CACHE_SECONDS}`,
        },
    });

    ctx.waitUntil(cache.put(cacheKey, cacheable.clone()));

    return new Response(body, {
        headers: { "content-type": "application/json; charset=utf-8", ...cors },
    });
};

const handlePost = async (request: Request, env: Env, ctx: ExecutionContext, cors: Record<string, string>) => {
    if (env.SUBMIT_LIMIT) {
        const { success } = await env.SUBMIT_LIMIT.limit({ key: clientIp(request) });

        if (!success) {
            return json({ error: "rate limited" }, 429, cors);
        }
    }

    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return json({ error: "body must be JSON" }, 400, cors);
    }

    const checked = validate(body);

    if ("error" in checked) {
        return json({ error: checked.error }, 422, cors);
    }

    const { run } = checked;

    //  The score at the bottom of the board. A run that can't beat it is
    //  answered honestly and never written — this is what keeps submissions
    //  from eating into D1's shared daily write allowance.
    const cutoff = await env.DB.prepare(
        `SELECT score FROM asteroids_scores ORDER BY score DESC, id ASC LIMIT 1 OFFSET ?`
    )
        .bind(BOARD_SIZE - 1)
        .first<{ score: number }>();

    if (cutoff && run.score <= cutoff.score) {
        return json({ accepted: false, rank: null }, 200, cors);
    }

    await env.DB.batch([
        env.DB.prepare(
            `INSERT INTO asteroids_scores (initials, score, wave, shots, hits)
             VALUES (?, ?, ?, ?, ?)`
        ).bind(run.initials, run.score, run.wave, run.shots, run.hits),
        //  Trim back to BOARD_SIZE in the same round trip. When the table is
        //  at or under the limit the subquery selects nothing, so this costs
        //  reads but no writes.
        env.DB.prepare(
            `DELETE FROM asteroids_scores
              WHERE id IN (
                    SELECT id FROM asteroids_scores
                     ORDER BY score DESC, id ASC
                     LIMIT -1 OFFSET ?
              )`
        ).bind(BOARD_SIZE),
    ]);

    const better = await env.DB.prepare(`SELECT COUNT(*) AS n FROM asteroids_scores WHERE score > ?`)
        .bind(run.score)
        .first<{ n: number }>();

    //  A new top score should show up immediately rather than after the cache
    //  window, so drop the cached pages for the sizes the game asks for.
    const origin = new URL(request.url).origin;
    ctx.waitUntil(
        Promise.all(
            [DEFAULT_LIMIT, MAX_LIMIT].map((limit) =>
                caches.default.delete(new Request(`${origin}/asteroids/scores?limit=${limit}`, { method: "GET" }))
            )
        )
    );

    return json({ accepted: true, rank: (better?.n ?? 0) + 1 }, 201, cors);
};

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        const cors = corsHeaders(request, env);

        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: cors });
        }

        //  Liveness probe for cf-monitor. Touches no database on purpose: the
        //  monitor polls every five minutes, and pointing it at a query is how
        //  the older leaderboard API spent 164,000 D1 row reads a day watching
        //  itself.
        if (url.pathname === "/asteroids/health") {
            return new Response("ok", { headers: { "content-type": "text/plain" } });
        }

        if (url.pathname !== "/asteroids/scores") {
            return json({ error: "not found" }, 404, cors);
        }

        try {
            if (request.method === "GET") {
                return await handleGet(request, env, ctx, cors);
            }

            if (request.method === "POST") {
                return await handlePost(request, env, ctx, cors);
            }

            return json({ error: "method not allowed" }, 405, { ...cors, allow: "GET, POST, OPTIONS" });
        } catch (error) {
            //  Log the detail, return none of it.
            console.error(`[error] ${request.method} ${url.pathname}:`, (error as Error).message);
            return json({ error: "internal error" }, 500, cors);
        }
    },
} satisfies ExportedHandler<Env>;
