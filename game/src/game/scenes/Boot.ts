import { Scene } from "phaser";
import { COLOR, HEIGHT, WIDTH, cornerCaption, nebula, shipMark } from "../ui/theme";

export class Boot extends Scene {
    constructor() {
        super("Boot");
    }

    create() {
        this.cameras.main.setBackgroundColor(COLOR.space);

        nebula(this, WIDTH / 2, HEIGHT * 0.45, 700, 500, COLOR.nebula, 0.2);

        shipMark(this, WIDTH / 2, HEIGHT / 2, 13, 30, COLOR.ink, 0.28);

        cornerCaption(this, "BOOT", 0.22);

        //  Canvas text doesn't trigger a webfont fetch on its own, so ask for the
        //  weights the scenes use and let the boot frame double as the font wait.
        const faces = [
            "200 64px Manrope",
            "300 26px Manrope",
            "400 26px Manrope",
            "300 92px 'IBM Plex Mono'",
            "400 22px 'IBM Plex Mono'",
        ];

        Promise.all(faces.map((face) => document.fonts.load(face)))
            .then(() => document.fonts.ready)
            .catch(() => undefined)
            .then(() => this.scene.start("Preloader"));
    }
}
