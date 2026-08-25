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
        // Private browsing or a full quota — the board just doesn't persist.
    }
};

export const leaderboard = (): ScoreEntry[] => read<ScoreEntry[]>(BOARD_KEY, []);

export const highScore = (): ScoreEntry | null => leaderboard()[0] ?? null;

export const lastRun = (): number => read<number>(LAST_RUN_KEY, 0);

export const recordLastRun = (score: number) => write(LAST_RUN_KEY, score);

/** True when this run beats the current top entry, so Game Over can call it out. */
export const isNewRecord = (score: number) => {
    const best = highScore();
    return score > 0 && (!best || score > best.score);
};

export const submitScore = (entry: ScoreEntry) => {
    const board = [...leaderboard(), entry].sort((a, b) => b.score - a.score).slice(0, 5);
    write(BOARD_KEY, board);
    return board;
};

/** True when the run earns a slot on the five-entry board, so initials are worth asking for. */
export const qualifies = (score: number) => {
    const board = leaderboard();
    return score > 0 && (board.length < 5 || score > board[board.length - 1].score);
};
