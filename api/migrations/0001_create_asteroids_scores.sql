-- Asteroids leaderboard. Lives in the existing `leaderboard` D1 database
-- alongside the older Bullet Blitz table, so no new database (and no
-- Terraform change) is needed.

CREATE TABLE IF NOT EXISTS asteroids_scores (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    initials   TEXT    NOT NULL,
    score      INTEGER NOT NULL,
    wave       INTEGER NOT NULL,
    shots      INTEGER NOT NULL,
    hits       INTEGER NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Every read is "top N by score", and ties break by insertion order so the
-- earlier run keeps the higher slot. This index answers that ordering
-- directly; without it each read is a full scan plus a temp b-tree sort,
-- which is how this account burned its D1 read allowance once already.
CREATE INDEX IF NOT EXISTS idx_asteroids_scores_rank
    ON asteroids_scores (score DESC, id ASC);
