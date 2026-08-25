import { Scene } from "phaser";
import Phaser from "phaser";
import {
    ACCENT,
    COLOR,
    HEIGHT,
    MONO,
    WIDTH,
    centerTracked,
    fadeTexture,
    formatScore,
    formatWave,
    ink,
    keyHints,
    mono,
    nebula,
    sans,
    shipMark,
    starfield,
} from "../ui/theme";
import { ScoreEntry, cachedHighScore, cachedLeaderboard, fetchLeaderboard, lastRun } from "../scores";

const ROW_WIDTH = 420;
const ROW_HEIGHT = 62;
const ROW_GAP = 4;
const ROW_TOP = 341;
const LEFT = 96;

type MenuAction = "play" | "howToPlay" | "leaderboard" | "settings";

interface MenuRow {
    action: MenuAction;
    label: Phaser.GameObjects.Text;
    dot: Phaser.GameObjects.Arc;
    highlight: Phaser.GameObjects.Image;
    topRule: Phaser.GameObjects.Rectangle;
    bottomRule: Phaser.GameObjects.Rectangle;
    enterHint: Phaser.GameObjects.Text;
}

export class MainMenu extends Scene {
    rows: MenuRow[] = [];
    selected = 0;
    overlay: Phaser.GameObjects.Container | null = null;
    overlayKind: MenuAction | null = null;
    highScoreText: Phaser.GameObjects.Text;
    highScoreByline: Phaser.GameObjects.Text;

    constructor() {
        super("MainMenu");
    }

    create() {
        //  Phaser reuses the scene instance, so last visit's rows are still on the
        //  field here — and every game object in them was destroyed on shutdown.
        this.rows = [];
        this.selected = 0;
        this.overlay = null;
        this.overlayKind = null;

        this.cameras.main.setBackgroundColor(COLOR.space);

        nebula(this, WIDTH * 0.22, HEIGHT * 0.4, 820, 620, COLOR.nebula, 0.26);
        nebula(this, WIDTH * 0.88, HEIGHT * 0.82, 500, 400, COLOR.haze, 0.14);
        starfield(this, 70, "mainmenu");

        this.buildTitle();
        this.buildMenu();
        this.buildRecords();
        this.buildFooter();

        this.select(0);
        this.bindKeys();

        //  The cached board painted above is whatever we last saw; ask the
        //  server for the current one and repaint if it answers.
        void fetchLeaderboard(10).then((entries) => {
            if (entries && this.scene.isActive()) {
                this.applyBoard(entries);
            }
        });
    }

    buildTitle() {
        shipMark(this, LEFT + 14, 136, 14, 32, COLOR.accent);

        sans(this, LEFT, 174, "ASTEROIDS", { size: 64, weight: 200, tracking: 10.24 });
        mono(this, LEFT, 260, "DRIFT / SHOOT / SURVIVE", { size: 13, tracking: 3.12, color: ink(0.4) });
    }

    buildMenu() {
        const items: { action: MenuAction; text: string }[] = [
            { action: "play", text: "PLAY" },
            { action: "howToPlay", text: "HOW TO PLAY" },
            { action: "leaderboard", text: "LEADERBOARD" },
            { action: "settings", text: "SETTINGS" },
        ];

        items.forEach((item, index) => {
            const top = ROW_TOP + index * (ROW_HEIGHT + ROW_GAP);
            const middle = top + ROW_HEIGHT / 2;

            const highlight = this.add
                .image(LEFT, top, fadeTexture(this, "row-fade", COLOR.accent, 0.1))
                .setOrigin(0, 0)
                .setDisplaySize(ROW_WIDTH, ROW_HEIGHT);
            const topRule = this.add.rectangle(LEFT, top, ROW_WIDTH, 1, COLOR.accent, 0.35).setOrigin(0, 0);
            const bottomRule = this.add
                .rectangle(LEFT, top + ROW_HEIGHT, ROW_WIDTH, 1, COLOR.accent, 0.35)
                .setOrigin(0, 0);

            const dot = this.add.circle(LEFT + 3, middle, 3, COLOR.accent);

            const label = sans(this, LEFT + 26, middle, item.text, { size: 26, weight: 300, tracking: 2.6 }).setOrigin(
                0,
                0.5
            );

            const enterHint = mono(this, LEFT + ROW_WIDTH - 20, middle, "ENTER", {
                size: 11,
                tracking: 1.76,
                color: "rgba(245,197,24,0.7)",
            }).setOrigin(1, 0.5);

            this.rows.push({ action: item.action, label, dot, highlight, topRule, bottomRule, enterHint });
        });
    }

    buildRecords() {
        const right = WIDTH - 96;
        const best = cachedHighScore();

        mono(this, right, 150, "HIGH SCORE", { size: 11, tracking: 2.2, color: ink(0.38) }).setOrigin(1, 0);
        this.highScoreText = mono(this, right, 172, formatScore(best?.score ?? 0), {
            size: 44,
            weight: 300,
        }).setOrigin(1, 0);
        this.highScoreByline = mono(
            this,
            right,
            232,
            best ? `${best.initials} · WAVE ${formatWave(best.wave)}` : "NO RUNS YET",
            { size: 12, tracking: 1.92, color: ink(0.35) }
        ).setOrigin(1, 0);

        this.add.rectangle(right, 274, 180, 1, COLOR.ink, 0.1).setOrigin(1, 0);

        mono(this, right, 306, "LAST RUN", { size: 11, tracking: 2.2, color: ink(0.38) }).setOrigin(1, 0);
        mono(this, right, 328, formatScore(lastRun()), { size: 24, weight: 300, color: ink(0.7) }).setOrigin(1, 0);
    }

    buildFooter() {
        keyHints(this, LEFT, HEIGHT - 63, ["↑ ↓  NAVIGATE", "ENTER  SELECT"], 0.3);

        mono(this, WIDTH - 96, HEIGHT - 63, "v0.1.0", { size: 11, tracking: 2, color: ink(0.3) }).setOrigin(1, 0);
    }

    /** Repaints the records column, and the leaderboard panel if it's open. */
    applyBoard(entries: ScoreEntry[]) {
        const best = entries[0];

        this.highScoreText.setText(formatScore(best?.score ?? 0));
        this.highScoreByline.setText(best ? `${best.initials} · WAVE ${formatWave(best.wave)}` : "NO RUNS YET");

        if (this.overlayKind === "leaderboard") {
            this.openOverlay("LEADERBOARD", this.boardLines(entries));
            this.overlayKind = "leaderboard";
        }
    }

    boardLines(entries: ScoreEntry[]) {
        if (!entries.length) {
            return ["NO RUNS RECORDED YET."];
        }

        return entries.map(
            (entry, i) =>
                `${`${i + 1}`.padStart(2, " ")}   ${entry.initials}   ${formatScore(entry.score).padStart(9, " ")}   WAVE ${formatWave(entry.wave)}`
        );
    }

    bindKeys() {
        const keyboard = this.input.keyboard!;

        keyboard.on("keydown-UP", () => this.move(-1));
        keyboard.on("keydown-DOWN", () => this.move(1));
        keyboard.on("keydown-ENTER", () => this.activate());
        keyboard.on("keydown-SPACE", () => this.activate());
        keyboard.on("keydown-ESC", () => this.closeOverlay());
    }

    move(delta: number) {
        if (this.overlay) {
            return;
        }

        this.select(Phaser.Math.Wrap(this.selected + delta, 0, this.rows.length));
    }

    select(index: number) {
        this.selected = index;

        this.rows.forEach((row, i) => {
            const active = i === index;

            row.highlight.setVisible(active);
            row.topRule.setVisible(active);
            row.dot.setVisible(active);
            row.enterHint.setVisible(active);

            row.bottomRule.setFillStyle(active ? COLOR.accent : COLOR.ink, active ? 0.35 : 0.07);
            row.label.setColor(active ? ACCENT : ink(0.62));
            row.label.setFontStyle(active ? "400" : "300");
        });
    }

    activate() {
        if (this.overlay) {
            const onEnter = this.overlay.getData("onEnter") as (() => void) | undefined;

            if (onEnter) {
                onEnter();
            } else {
                this.closeOverlay();
            }

            return;
        }

        const { action } = this.rows[this.selected];

        if (action === "play") {
            this.scene.start("Game");
            return;
        }

        if (action === "howToPlay") {
            this.openOverlay("HOW TO PLAY", [
                "← →   TURN THE SHIP",
                "↑     THRUST — momentum carries, there is no brake",
                "SPACE FIRE",
                "ESC   PAUSE",
                "",
                "LARGE ROCKS SPLIT TWICE. CLEAR THE WAVE TO ADVANCE.",
                "SCORE MULTIPLIES BY THE WAVE YOU ARE ON.",
            ]);
            return;
        }

        if (action === "leaderboard") {
            const cached = cachedLeaderboard();

            this.openOverlay("LEADERBOARD", cached.length ? this.boardLines(cached) : ["LOADING…"]);
            this.overlayKind = "leaderboard";

            void fetchLeaderboard(10).then((entries) => {
                if (!this.scene.isActive() || this.overlayKind !== "leaderboard") {
                    return;
                }

                this.applyBoard(entries ?? cached);
            });

            return;
        }

        this.openSettings();
    }

    openSettings() {
        const debug = this.registry.get("debugBodies") === true;

        this.openOverlay("SETTINGS", [
            `SHOW HITBOXES        ${debug ? "ON" : "OFF"}`,
            "",
            "ENTER TOGGLES. HITBOXES DRAW THE ARCADE PHYSICS BODIES",
            "OVER THE PLAYFIELD WHILE YOU PLAY.",
        ]);

        //  openOverlay clears the kind, so claim it back afterwards.
        this.overlayKind = "settings";

        //  Inside the settings panel, Enter flips the toggle instead of closing it.
        this.overlay!.setData("onEnter", () => {
            this.registry.set("debugBodies", !debug);
            this.closeOverlay();
            this.openSettings();
        });
    }

    openOverlay(title: string, lines: string[]) {
        this.closeOverlay();

        const panelWidth = 720;
        const panelHeight = 380;
        const x = WIDTH / 2;
        const y = HEIGHT / 2;

        const container = this.add.container(0, 0);

        container.add(this.add.rectangle(x, y, WIDTH, HEIGHT, COLOR.space, 0.86));
        container.add(
            this.add.rectangle(x, y, panelWidth, panelHeight, COLOR.space, 0.98).setStrokeStyle(1, COLOR.ink, 0.12)
        );

        const heading = mono(this, x, y - panelHeight / 2 + 40, title, {
            size: 12,
            tracking: 2.64,
            color: ACCENT,
        });
        container.add(centerTracked(heading, x, 2.64));

        lines.forEach((line, i) => {
            container.add(
                this.add
                    .text(x - panelWidth / 2 + 56, y - panelHeight / 2 + 96 + i * 30, line, {
                        fontFamily: MONO,
                        fontSize: 14,
                        color: ink(0.72),
                    })
                    .setLetterSpacing(1.2)
            );
        });

        const hint = mono(this, x, y + panelHeight / 2 - 42, "ESC  BACK", {
            size: 11,
            tracking: 2,
            color: ink(0.3),
        });
        container.add(centerTracked(hint, x, 2));

        this.overlay = container;
    }

    closeOverlay() {
        if (!this.overlay) {
            return;
        }

        this.overlay.destroy(true);
        this.overlay = null;
        this.overlayKind = null;
    }
}
