import { Scene } from "phaser";

export class Boot extends Scene {
    constructor() {
        super("Boot");
    }

    preload() {
        //  The Boot Scene is typically used to load in any assets you require for your Preloader, such as a game logo or background.
        //  The smaller the file size of the assets, the better, as the Boot Scene itself has no preloader.

        this.load.image("background", "assets/bg.png");
        this.load.svg("ship", "assets/ship.svg", { width: 60, height: 45 });
        this.load.svg("asteroid0", "assets/asteroid0.svg", { width: 30, height: 30 });
        this.load.svg("asteroid1", "assets/asteroid1.svg", { width: 60, height: 60 });
        this.load.svg("asteroid2", "assets/asteroid2.svg", { width: 90, height: 90 });
    }

    create() {
        this.scene.start("Preloader");
    }
}
