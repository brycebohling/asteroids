import { Scene } from "phaser";

export class Game extends Scene {
    ship: Phaser.GameObjects.Triangle & { body: Phaser.Physics.Arcade.Body };
    cursors: Phaser.Types.Input.Keyboard.CursorKeys;

    constructor() {
        super("Game");
    }

    create() {
        this.ship = this.add.triangle(512, 384, 0, 20, 20, 20, 10, 0, 0xb8b8b8) as any;

        this.physics.add.existing(this.ship);

        this.ship.body.setMaxSpeed(300);
        this.ship.body.setDrag(30);

        this.cursors = this.input.keyboard!.createCursorKeys();
    }

    update(time: number, delta: number) {
        if (this.cursors.left.isDown) {
            this.ship.angle -= 180 * (delta / 1000);
        } else if (this.cursors.right.isDown) {
            this.ship.angle += 180 * (delta / 1000);
        }

        if (this.cursors.up.isDown) {
            this.physics.velocityFromRotation(this.ship.rotation - Math.PI / 2, 200, this.ship.body.acceleration);
        } else {
            this.ship.body.setAcceleration(0);
        }

        this.screenWrap(this.ship);
    }

    screenWrap(obj: Phaser.GameObjects.GameObject & { body: Phaser.Physics.Arcade.Body }) {
        const body = obj.body;
        if (body.x < 0) body.x = 1024;
        else if (body.x > 1024) body.x = 0;
        if (body.y < 0) body.y = 768;
        else if (body.y > 768) body.y = 0;
    }
}
