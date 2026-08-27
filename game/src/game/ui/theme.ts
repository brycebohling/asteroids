import { Scene } from "phaser";
import Phaser from "phaser";

/**
 * Shared visual language for every scene, taken from the "Asteroids Scenes"
 * design canvas: deep-space backdrop, Manrope for labels, IBM Plex Mono for
 * every number, and a single signal color used only for state that matters.
 */

export const WIDTH = 1280;
export const HEIGHT = 720;

export const COLOR = {
    space: 0x060a16,
    ink: 0xe8edf7,
    accent: 0xf5c518,
    nebula: 0x3a54a0,
    haze: 0x7850b4,
};

export const INK = "#e8edf7";
export const ACCENT = "#f5c518";

export const SANS = "Manrope, sans-serif";
export const MONO = "'IBM Plex Mono', monospace";

/** rgba() string for the ink color at a given alpha, matching the design tokens. */
export const ink = (alpha: number) => `rgba(232,237,247,${alpha})`;

interface TextOptions {
    size?: number;
    weight?: number;
    color?: string;
    tracking?: number;
    align?: string;
}

const text = (family: string) => (scene: Scene, x: number, y: number, value: string, options: TextOptions = {}) => {
    const label = scene.add.text(x, y, value, {
        fontFamily: family,
        fontSize: options.size ?? 14,
        fontStyle: `${options.weight ?? 400}`,
        color: options.color ?? INK,
        align: options.align ?? "left",
    });

    if (options.tracking) {
        label.setLetterSpacing(options.tracking);
    }

    return label;
};

/** Manrope — titles, menu items, anything that reads as language. */
export const sans = text(SANS);

/** IBM Plex Mono — scores, waves, keycaps, anything that reads as data. */
export const mono = text(MONO);

/**
 * The ship mark: an upward triangle, 26 x 30 in the design at its base size.
 * Used as the logo, as the lives icon, and as the player itself.
 */
export const shipMark = (scene: Scene, x: number, y: number, halfWidth: number, height: number, color: number, alpha = 1) => {
    return scene.add.triangle(x, y, 0, height, halfWidth, 0, halfWidth * 2, height, color, alpha);
};

/**
 * Builds a radial-gradient texture once per game and returns its key, so the
 * soft nebula washes behind each scene cost a single draw call.
 */
export const nebulaTexture = (
    scene: Scene,
    key: string,
    width: number,
    height: number,
    color: number,
    alpha: number
) => {
    if (scene.textures.exists(key)) {
        return key;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2);
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;

    gradient.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
    gradient.addColorStop(0.7, `rgba(${r},${g},${b},0)`);
    gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    scene.textures.addCanvas(key, canvas);

    return key;
};

/** A nebula wash: an ellipse of light centered at (x, y) in scene coordinates. */
export const nebula = (
    scene: Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    color = COLOR.nebula,
    alpha = 0.24
) => {
    const key = nebulaTexture(scene, `nebula-${color.toString(16)}-${alpha}`, 512, 512, color, alpha);

    return scene.add.image(x, y, key).setDisplaySize(width, height);
};

/**
 * Scattered pinpoint stars. Seeded so a given scene always draws the same sky
 * across restarts, which keeps the backdrop from flickering on scene changes.
 */
export const starfield = (scene: Scene, count: number, seed: string) => {
    const random = new Phaser.Math.RandomDataGenerator([seed]);
    const stars = scene.add.graphics();

    for (let i = 0; i < count; i++) {
        const x = random.between(0, WIDTH);
        const y = random.between(0, HEIGHT);
        const alpha = random.realInRange(0.18, 0.5);
        const radius = random.realInRange(0.6, 1.3);

        stars.fillStyle(0xffffff, alpha);
        stars.fillCircle(x, y, radius);
    }

    return stars;
};

/** The dim caption sitting in the lower-left corner of the Boot and Preloader frames. */
export const cornerCaption = (scene: Scene, value: string, alpha: number) => {
    return mono(scene, 48, HEIGHT - 56, value, { size: 12, tracking: 2.4, color: ink(alpha) });
};

/** The row of keycap hints along the bottom edge of the Game and Game Over frames. */
export const keyHints = (scene: Scene, x: number, y: number, hints: string[], alpha = 0.26) => {
    const row: Phaser.GameObjects.Text[] = [];
    let cursor = x;

    for (const hint of hints) {
        const label = mono(scene, cursor, y, hint, { size: 11, tracking: 2, color: ink(alpha) });
        row.push(label);
        cursor += label.width + 26;
    }

    return row;
};

export const formatScore = (score: number) => score.toLocaleString("en-US");

export const formatWave = (wave: number) => `${wave}`.padStart(2, "0");

/**
 * Centers text that carries letter spacing. Phaser counts the trailing gap
 * after the last glyph in the text width, which drags a centered line left.
 */
export const centerTracked = (label: Phaser.GameObjects.Text, x: number, tracking: number) => {
    label.setOrigin(0.5);
    label.setX(x + tracking / 2);
    return label;
};

/**
 * A left-to-right fade of one color, used for the selected menu row. Built as a
 * texture so it can be stretched to any row size without banding.
 */
export const fadeTexture = (scene: Scene, key: string, color: number, alpha: number) => {
    if (scene.textures.exists(key)) {
        return key;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 1;

    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createLinearGradient(0, 0, 256, 0);
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;

    gradient.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
    gradient.addColorStop(0.7, `rgba(${r},${g},${b},0)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 1);

    scene.textures.addCanvas(key, canvas);

    return key;
};
