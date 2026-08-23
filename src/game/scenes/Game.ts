import { Scene } from "phaser";

export class Game extends Scene {
    // Input
    cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    // Ship
    ship: Phaser.GameObjects.Image & { body: Phaser.Physics.Arcade.Body };
    shipMaxSpeed = 300;
    shipDrag = 30;
    // Bullet
    fireRate = 250;
    bulletSpeed = 400;
    lastFiredTime: number = 0;

    constructor() {
        super("Game");
    }

    create() {
        this.ship = this.add.image(512, 384, "ship") as any;

        this.physics.add.existing(this.ship);

        this.ship.body.setMaxSpeed(this.shipMaxSpeed);
        this.ship.body.setDrag(this.shipDrag);

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

        if (this.cursors.space.isDown) {
            this.tryFire(time);
        }
    }

    screenWrap(obj: Phaser.GameObjects.GameObject & { body: Phaser.Physics.Arcade.Body }) {
        const body = obj.body;
        if (body.x < 0) body.x = 1024;
        else if (body.x > 1024) body.x = 0;
        if (body.y < 0) body.y = 768;
        else if (body.y > 768) body.y = 0;
    }

    tryFire(time: number) {
        if (time - this.lastFiredTime > this.fireRate) {
            this.fire();
            this.lastFiredTime = time;
        }
    }

    fire() {
        const bullet = this.add.circle(this.ship.x, this.ship.y, 3, 0xffffff);
        this.physics.add.existing(bullet);
        const body = bullet.body as Phaser.Physics.Arcade.Body;
        this.physics.velocityFromRotation(this.ship.rotation - Math.PI / 2, this.bulletSpeed, body.velocity);

        this.physics.world.on("worldbounds", (body: Phaser.Physics.Arcade.Body) => {
            if (body.gameObject === bullet) {
                bullet.destroy();
            }
        });
    }
}
