export interface RunResult {
    score: number;
    wave: number;
    shots: number;
    hits: number;
}

export interface ScoreEntry {
    initials: string;
    score: number;
    wave: number;
}

export interface SubmitResult {
    accepted: boolean;
    rank: number | null;
    offline: boolean;
}

/**
 * The leaderboard lives in D1 behind a Worker; localStorage is kept as a cache
 * so the menu can paint a board before the network answers, and as the
 * fallback when it doesn't answer at all.
 */
const API_BASE = import.meta.env.VITE_API_BASE ?? "https://api.brycebohling.com/asteroids";

const REQUEST_TIMEOUT = 4000;

const BOARD_KEY = "asteroids.leaderboard";
const LAST_RUN_KEY = "asteroids.lastRun";

const read = <T>(key: string, fallback: T): T => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
};

const write = (key: string, value: unknown) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Private browsing or a full quota — the cache just doesn't persist.
    }
};

/** The last board we managed to fetch. Reads never block on the network. */
export const cachedLeaderboard = (): ScoreEntry[] => read<ScoreEntry[]>(BOARD_KEY, []);

export const cachedHighScore = (): ScoreEntry | null => cachedLeaderboard()[0] ?? null;

export const lastRun = (): number => read<number>(LAST_RUN_KEY, 0);

export const recordLastRun = (score: number) => write(LAST_RUN_KEY, score);

/**
 * Worth asking for initials. The server owns the real decision — it holds a
 * hundred places and this client can only see the ten it last fetched — so
 * this stays deliberately permissive.
 */
export const qualifies = (score: number) => score > 0;

/** True against the cached board, which is all the Game Over screen can know. */
export const isNewRecord = (score: number) => {
    const best = cachedHighScore();
    return score > 0 && (!best || score > best.score);
};

const request = async (path: string, init: RequestInit = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
        return await fetch(`${API_BASE}${path}`, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
};

/**
 * Top entries from the server, cached on success. Returns null when the
 * network fails so callers can tell "empty board" from "couldn't ask".
 */
export const fetchLeaderboard = async (limit = 10): Promise<ScoreEntry[] | null> => {
    try {
        const response = await request(`/scores?limit=${limit}`);

        if (!response.ok) {
            return null;
        }

        const body = (await response.json()) as { data?: ScoreEntry[] };
        const entries = Array.isArray(body.data) ? body.data : [];

        write(BOARD_KEY, entries);

        return entries;
    } catch {
        return null;
    }
};

/**
 * Submits a run. The local cache is updated either way, so a player offline
 * still sees their own score on the menu until the next successful fetch.
 */
export const submitScore = async (entry: ScoreEntry & Partial<RunResult>): Promise<SubmitResult> => {
    const cached = [...cachedLeaderboard(), { initials: entry.initials, score: entry.score, wave: entry.wave }]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    write(BOARD_KEY, cached);

    try {
        const response = await request("/scores", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                initials: entry.initials,
                score: entry.score,
                wave: entry.wave,
                shots: entry.shots ?? 0,
                hits: entry.hits ?? 0,
            }),
        });

        if (!response.ok) {
            return { accepted: false, rank: null, offline: response.status >= 500 };
        }

        const body = (await response.json()) as { accepted?: boolean; rank?: number | null };

        return { accepted: body.accepted === true, rank: body.rank ?? null, offline: false };
    } catch {
        return { accepted: false, rank: null, offline: true };
    }
};
