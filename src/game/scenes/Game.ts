import { Scene } from "phaser";

export class Game extends Scene {
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    msg_text: Phaser.GameObjects.Text;

    constructor() {
        super("Game");
    }

    create() {
        this.camera = this.cameras.main;

        this.add.triangle(512, 384, 0, 20, 20, 20, 10, 0, 0xb8b8b8);

        // this.input.once("pointerdown", () => {
        //     this.scene.start("GameOver");
        // });
    }
}
