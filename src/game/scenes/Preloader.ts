import { Scene } from "phaser";
import { COLOR, HEIGHT, INK, WIDTH, centerTracked, cornerCaption, nebula, sans, shipMark, starfield } from "../ui/theme";

export class Preloader extends Scene {
    bar: Phaser.GameObjects.Rectangle;

    constructor() {
        super("Preloader");
    }

    init() {
        this.cameras.main.setBackgroundColor(COLOR.space);

        nebula(this, WIDTH / 2, HEIGHT * 0.42, 760, 540, COLOR.nebula, 0.24);
        starfield(this, 60, "preloader");

        shipMark(this, WIDTH / 2, 296, 16, 37, COLOR.ink);

        const wordmark = sans(this, WIDTH / 2, 366, "ASTEROIDS", {
            size: 38,
            weight: 200,
            color: INK,
            tracking: 12.9,
        });
        centerTracked(wordmark, WIDTH / 2, 12.9);

        //  A 468 x 2 hairline track; the fill is the only accent-colored thing on screen.
        this.add.rectangle(WIDTH / 2, 440, 468, 2, COLOR.ink, 0.12);
        this.bar = this.add.rectangle(WIDTH / 2 - 234, 440, 0, 2, COLOR.accent).setOrigin(0, 0.5);

        this.load.on("progress", (progress: number) => {
            this.bar.width = 468 * progress;
        });

        cornerCaption(this, "LOADING", 0.28);
    }

    preload() {
        //  Everything the game itself needs. The Boot scene draws its frame with
        //  shapes alone, so this is the only load the player ever waits on.
        this.load.setPath("assets");

        this.load.svg("ship", "ship.svg", { width: 60, height: 45 });
        this.load.svg("asteroid0", "asteroid0.svg", { width: 30, height: 30 });
        this.load.svg("asteroid1", "asteroid1.svg", { width: 60, height: 60 });
        this.load.svg("asteroid2", "asteroid2.svg", { width: 90, height: 90 });
    }

    create() {
        //  Hold the finished bar for a beat so the transition reads as deliberate.
        this.bar.width = 468;

        this.time.delayedCall(320, () => this.scene.start("MainMenu"));
    }
}
