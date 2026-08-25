import { Scene } from "phaser";
import Phaser from "phaser";
import {
    ACCENT,
    COLOR,
    HEIGHT,
    WIDTH,
    centerTracked,
    formatScore,
    formatWave,
    ink,
    keyHints,
    mono,
    nebula,
    sans,
    starfield,
} from "../ui/theme";
import { RunResult, isNewRecord, qualifies, submitScore } from "../scores";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SLOT_CENTERS = [568, 640, 712];

export class GameOver extends Scene {
    result: RunResult;
    initials = [0, 0, 0];
    activeSlot = 0;
    entering = false;
    letterTexts: Phaser.GameObjects.Text[] = [];
    underlines: Phaser.GameObjects.Rectangle[] = [];
    hintRow: Phaser.GameObjects.Text[] = [];

    constructor() {
        super("GameOver");
    }

    init(data: Partial<RunResult>) {
        this.result = {
            score: data.score ?? 0,
            wave: data.wave ?? 1,
            shots: data.shots ?? 0,
            hits: data.hits ?? 0,
        };

        this.initials = [0, 0, 0];
        this.activeSlot = 0;
        this.letterTexts = [];
        this.underlines = [];
        this.hintRow = [];
        this.entering = qualifies(this.result.score);
    }

    create() {
        this.cameras.main.setBackgroundColor(COLOR.space);

        nebula(this, WIDTH / 2, HEIGHT * 0.44, 880, 640, COLOR.nebula, 0.22);
        starfield(this, 55, "gameover");

        this.buildHeader();
        this.buildFinalScore();
        this.buildStats();

        if (this.entering) {
            this.buildInitials();
        }

        this.buildFooter();
        this.bindKeys();
    }

    buildHeader() {
        const title = sans(this, WIDTH / 2, 56, "GAME OVER", {
            size: 46,
            weight: 200,
            tracking: 13.8,
            color: ink(0.85),
        }).setOrigin(0.5, 0);
        title.setX(WIDTH / 2 + 13.8 / 2);

        if (!isNewRecord(this.result.score)) {
            return;
        }

        //  The one moment the accent color gets to shout.
        const badge = mono(this, WIDTH / 2, 148, "NEW HIGH SCORE", { size: 11, tracking: 2.42, color: ACCENT });
        centerTracked(badge, WIDTH / 2 + 9, 2.42);

        const width = badge.width + 32 + 15;
        const plate = this.add
            .rectangle(WIDTH / 2, 148, width, 29, COLOR.accent, 0.08)
            .setStrokeStyle(1, COLOR.accent, 0.45);

        this.add.circle(plate.x - width / 2 + 16, 148, 2.5, COLOR.accent);
        this.children.bringToTop(badge);
    }

    buildFinalScore() {
        mono(this, WIDTH / 2, 189, "FINAL SCORE", { size: 11, tracking: 2.64, color: ink(0.38) }).setOrigin(0.5, 0);
        mono(this, WIDTH / 2, 213, formatScore(this.result.score), { size: 92, weight: 300 }).setOrigin(0.5, 0);
    }

    buildStats() {
        const accuracy = this.result.shots ? Math.round((this.result.hits / this.result.shots) * 100) : 0;

        const cells: [string, string][] = [
            ["WAVE", formatWave(this.result.wave)],
            ["ACCURACY", `${accuracy}%`],
            ["SHOTS", `${this.result.shots}`],
            ["HITS", `${this.result.hits}`],
        ];

        const rowWidth = cells.length * 170 + (cells.length - 1);
        const left = WIDTH / 2 - rowWidth / 2;

        this.add.rectangle(WIDTH / 2, 331, rowWidth, 1, COLOR.ink, 0.1);
        this.add.rectangle(WIDTH / 2, 432, rowWidth, 1, COLOR.ink, 0.1);

        cells.forEach(([label, value], index) => {
            const centerX = left + index * 171 + 85;

            mono(this, centerX, 354, label, { size: 10, tracking: 2, color: ink(0.36) }).setOrigin(0.5, 0);
            mono(this, centerX, 376, value, { size: 26, weight: 300 }).setOrigin(0.5, 0);

            if (index > 0) {
                this.add.rectangle(left + index * 171 - 0.5, 381.5, 1, 101, COLOR.ink, 0.1);
            }
        });
    }

    buildInitials() {
        mono(this, WIDTH / 2, 458, "ENTER INITIALS", { size: 11, tracking: 2.64, color: ink(0.38) }).setOrigin(0.5, 0);

        SLOT_CENTERS.forEach((x, index) => {
            this.letterTexts.push(mono(this, x, 488, LETTERS[this.initials[index]], { size: 40 }).setOrigin(0.5, 0));
            this.underlines.push(this.add.rectangle(x, 550, 56, 1, COLOR.ink, 0.25));
        });

        this.refreshInitials();
    }

    refreshInitials() {
        this.letterTexts.forEach((text, index) => {
            const active = index === this.activeSlot;

            text.setText(LETTERS[this.initials[index]]);
            text.setColor(active ? ACCENT : ink(1));

            const underline = this.underlines[index];
            underline.setFillStyle(active ? COLOR.accent : COLOR.ink, active ? 1 : 0.25);
            underline.setSize(56, active ? 2 : 1);
        });
    }

    buildFooter() {
        const label = sans(this, WIDTH / 2, 614, "RETRY", { size: 17, weight: 400, tracking: 3.06, color: ACCENT });
        centerTracked(label, WIDTH / 2, 3.06);

        this.add
            .rectangle(WIDTH / 2, 614, label.width + 88 - 3.06, 50, COLOR.accent, 0.1)
            .setStrokeStyle(1, COLOR.accent, 0.5);
        this.children.bringToTop(label);

        this.drawHints();
    }

    drawHints() {
        this.hintRow.forEach((hint) => hint.destroy());

        const hints = this.entering
            ? ["← →  LETTER", "ENTER  SUBMIT", "ESC  MENU"]
            : ["ENTER  RETRY", "ESC  MENU"];

        //  Centered as a row, so the hints stay under the RETRY button.
        this.hintRow = keyHints(this, 0, 661, hints, 0.28);

        const width = this.hintRow.reduce((total, hint) => total + hint.width + 26, -26);
        let cursor = WIDTH / 2 - width / 2;

        this.hintRow.forEach((hint) => {
            hint.setX(cursor);
            cursor += hint.width + 26;
        });
    }

    bindKeys() {
        const keyboard = this.input.keyboard!;

        keyboard.on("keydown-LEFT", () => this.cycleLetter(-1));
        keyboard.on("keydown-RIGHT", () => this.cycleLetter(1));
        keyboard.on("keydown-UP", () => this.cycleLetter(1));
        keyboard.on("keydown-DOWN", () => this.cycleLetter(-1));
        keyboard.on("keydown-BACKSPACE", () => this.stepSlot(-1));
        keyboard.on("keydown-ENTER", () => this.commit());
        keyboard.on("keydown-ESC", () => this.scene.start("MainMenu"));

        //  Typing a letter is faster than scrubbing to it.
        keyboard.on("keydown", (event: KeyboardEvent) => {
            if (!this.entering || event.key.length !== 1) {
                return;
            }

            const index = LETTERS.indexOf(event.key.toUpperCase());

            if (index === -1) {
                return;
            }

            this.initials[this.activeSlot] = index;
            this.refreshInitials();
            this.stepSlot(1);
        });
    }

    cycleLetter(delta: number) {
        if (!this.entering) {
            return;
        }

        this.initials[this.activeSlot] = Phaser.Math.Wrap(this.initials[this.activeSlot] + delta, 0, LETTERS.length);
        this.refreshInitials();
    }

    stepSlot(delta: number) {
        if (!this.entering) {
            return;
        }

        this.activeSlot = Phaser.Math.Clamp(this.activeSlot + delta, 0, SLOT_CENTERS.length - 1);
        this.refreshInitials();
    }

    commit() {
        if (!this.entering) {
            this.scene.start("Game");
            return;
        }

        if (this.activeSlot < SLOT_CENTERS.length - 1) {
            this.stepSlot(1);
            return;
        }

        submitScore({
            initials: this.initials.map((index) => LETTERS[index]).join(""),
            score: this.result.score,
            wave: this.result.wave,
        });

        this.entering = false;

        //  The slots stay on screen as a record of what was entered, but stop taking input.
        this.letterTexts.forEach((text) => text.setColor(ink(0.7)));
        this.underlines.forEach((underline) => underline.setFillStyle(COLOR.ink, 0.25).setSize(56, 1));

        this.drawHints();
    }
}
