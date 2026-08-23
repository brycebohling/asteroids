import { Scene } from "phaser";
import Phaser from "phaser";

export class Game extends Scene {
    // Input
    cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    // Ship
    ship: Phaser.GameObjects.Image & { body: Phaser.Physics.Arcade.Body };
    shipMaxSpeed = 300;
    shipDrag = 30;
    // Bullet
    bullets: Phaser.Physics.Arcade.Group;
    fireRate = 250;
    bulletSpeed = 400;
    lastFiredTime: number = 0;
    // Asteroids
    asteroids: Phaser.Physics.Arcade.Group;

    constructor() {
        super("Game");
    }

    create() {
        this.cursors = this.input.keyboard!.createCursorKeys();

        this.ship = this.add.image(512, 384, "ship") as any;

        this.physics.add.existing(this.ship);

        this.ship.body.setMaxSpeed(this.shipMaxSpeed);
        this.ship.body.setDrag(this.shipDrag);

        this.bullets = this.physics.add.group();
        this.asteroids = this.physics.add.group();

        // Spawn initial wave
        this.spawnWave(4); // start with 4 asteroids

        // Bullet hits asteroid
        this.physics.add.overlap(this.asteroids, this.bullets, this.hitAsteroid, undefined, this);

        // Ship hits asteroid
        this.physics.add.overlap(this.ship, this.asteroids, this.shipHit, undefined, this);
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
        this.bullets.add(bullet);

        const body = bullet.body as Phaser.Physics.Arcade.Body;
        this.physics.velocityFromRotation(this.ship.rotation - Math.PI / 2, this.bulletSpeed, body.velocity);

        // Destroy after 2 seconds so offscreen bullets don't leak
        this.time.delayedCall(2000, () => bullet.destroy());
    }

    spawnAsteroid(x: number, y: number, size: number) {
        // size: 3 = large, 2 = medium, 1 = small
        const radius = size * 15; // 45px, 30px, 15px

        const asteroidSprites = ["asteroid0", "asteroid1", "asteroid2"];

        // const asteroid = this.add.circle(x, y, radius, 0x888888);
        const asteroid = this.add.image(x, y, asteroidSprites[size - 1]);
        // asteroid.setStrokeStyle(2, 0xffffff); // outline like classic asteroids
        this.physics.add.existing(asteroid);

        this.asteroids.add(asteroid);

        const body = asteroid.body as Phaser.Physics.Arcade.Body;
        body.setCircle(radius);

        // Random direction + speed (smaller = faster, like the original)
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const speed = Phaser.Math.Between(50, 150) / size;
        this.physics.velocityFromRotation(angle, speed, body.velocity);

        // Store the size so we know how to split it
        asteroid.setData("size", size);
        return asteroid;
    }

    spawnWave(count: number) {
        for (let i = 0; i < count; i++) {
            // Spawn at random edge positions (not on top of the player)
            const edge = Phaser.Math.Between(0, 3);
            let x = 0,
                y = 0;
            if (edge === 0) {
                x = 0;
                y = Phaser.Math.Between(0, 768);
            } // left
            else if (edge === 1) {
                x = 1024;
                y = Phaser.Math.Between(0, 768);
            } // right
            else if (edge === 2) {
                x = Phaser.Math.Between(0, 1024);
                y = 0;
            } // top
            else {
                x = Phaser.Math.Between(0, 1024);
                y = 768;
            } // bottom

            this.spawnAsteroid(x, y, 3); // all start large
        }
    }

    hitAsteroid(asteroid: any, bullet: any) {
        const size = asteroid.getData("size");

        if (size > 1) {
            this.spawnAsteroid(asteroid.x, asteroid.y, size - 1);
            this.spawnAsteroid(asteroid.x, asteroid.y, size - 1);
        }

        asteroid.destroy();
        bullet.destroy();
    }

    shipHit(ship: any, asteroid: any) {
        this.scene.start("GameOver");
    }
}
