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
    shipMark,
    starfield,
} from "../ui/theme";
import { recordLastRun } from "../scores";

const WRAP_MARGIN = 40;
const STARTING_LIVES = 3;
const RESPAWN_INVULNERABILITY = 2000;

//  Classic scoring: the smaller the rock, the more it is worth.
const SCORE_BY_SIZE: Record<number, number> = { 3: 20, 2: 50, 1: 100 };

type PhysicsImage = Phaser.GameObjects.Image & { body: Phaser.Physics.Arcade.Body };

export class Game extends Scene {
    // Input
    cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    // Ship
    ship: PhysicsImage;
    shipMaxSpeed = 300;
    shipDrag = 30;
    invulnerableUntil = 0;
    // Bullet
    bullets: Phaser.Physics.Arcade.Group;
    fireRate = 250;
    bulletSpeed = 400;
    lastFiredTime: number = 0;
    // Asteroids
    asteroids: Phaser.Physics.Arcade.Group;
    // Run state — every number here is on screen in the HUD
    score = 0;
    wave = 1;
    lives = STARTING_LIVES;
    shots = 0;
    hits = 0;
    paused = false;
    // HUD
    scoreText: Phaser.GameObjects.Text;
    multiplierText: Phaser.GameObjects.Text;
    waveText: Phaser.GameObjects.Text;
    lifeMarks: Phaser.GameObjects.Triangle[] = [];
    pauseOverlay: Phaser.GameObjects.Container;

    constructor() {
        super("Game");
    }

    create() {
        this.score = 0;
        this.wave = 1;
        this.lives = STARTING_LIVES;
        this.shots = 0;
        this.hits = 0;
        this.paused = false;
        this.lastFiredTime = 0;
        this.invulnerableUntil = 0;
        this.lifeMarks = [];

        this.cameras.main.setBackgroundColor(COLOR.space);
        nebula(this, WIDTH / 2, HEIGHT / 2, 900, 700, COLOR.nebula, 0.18);
        starfield(this, 80, "game");

        this.cursors = this.input.keyboard!.createCursorKeys();

        this.ship = this.add.image(WIDTH / 2, HEIGHT / 2, "ship") as PhysicsImage;
        this.ship.setTint(COLOR.accent);

        this.physics.add.existing(this.ship);

        this.ship.body.setMaxSpeed(this.shipMaxSpeed);
        this.ship.body.setDrag(this.shipDrag);

        this.bullets = this.physics.add.group();
        this.asteroids = this.physics.add.group();

        this.spawnWave(4); // start with 4 asteroids

        // Bullet hits asteroid
        this.physics.add.overlap(this.asteroids, this.bullets, this.hitAsteroid, undefined, this);

        // Ship hits asteroid
        this.physics.add.overlap(this.ship, this.asteroids, this.shipHit, undefined, this);

        this.buildHud();
        this.buildPauseOverlay();

        if (this.registry.get("debugBodies") === true) {
            this.physics.world.createDebugGraphic();
        }

        this.input.keyboard!.on("keydown-ESC", () => this.togglePause());
    }

    /**
     * HUD lives at the four edges only — the design keeps the middle of the
     * playfield free of anything the player has to read.
     */
    buildHud() {
        mono(this, 48, 44, "SCORE", { size: 11, tracking: 2.2, color: ink(0.38) });
        this.scoreText = mono(this, 48, 62, formatScore(this.score), { size: 42, weight: 300 });
        this.multiplierText = mono(this, 0, 104, `×${this.wave}`, { size: 18, color: ACCENT }).setOrigin(0, 1);

        mono(this, WIDTH / 2, 48, "WAVE", { size: 11, tracking: 2.64, color: ink(0.38) }).setOrigin(0.5, 0);
        this.waveText = mono(this, WIDTH / 2, 71, formatWave(this.wave), { size: 22, tracking: 1.32 }).setOrigin(
            0.5,
            0
        );

        mono(this, WIDTH - 48, 44, "LIVES", { size: 11, tracking: 2.2, color: ink(0.38) }).setOrigin(1, 0);

        for (let i = 0; i < STARTING_LIVES; i++) {
            //  Right-aligned, so losing a life dims the leftmost mark.
            const x = WIDTH - 56 - (STARTING_LIVES - 1 - i) * 28;
            this.lifeMarks.push(shipMark(this, x, 81, 8, 19, COLOR.ink));
        }

        keyHints(this, 48, HEIGHT - 59, ["← →  TURN", "↑  THRUST", "SPACE  FIRE", "ESC  PAUSE"]);

        this.refreshHud();
    }

    buildPauseOverlay() {
        const container = this.add.container(0, 0).setVisible(false).setDepth(10);

        container.add(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, COLOR.space, 0.72));

        const title = sans(this, WIDTH / 2, HEIGHT / 2 - 24, "PAUSED", { size: 40, weight: 200, tracking: 12 });
        container.add(centerTracked(title, WIDTH / 2, 12));

        const hint = mono(this, WIDTH / 2, HEIGHT / 2 + 34, "ESC  RESUME", {
            size: 11,
            tracking: 2,
            color: ink(0.38),
        });
        container.add(centerTracked(hint, WIDTH / 2, 2));

        this.pauseOverlay = container;
    }

    refreshHud() {
        this.scoreText.setText(formatScore(this.score));
        this.multiplierText.setText(`×${this.wave}`);
        this.multiplierText.setX(48 + this.scoreText.width + 14);
        this.waveText.setText(formatWave(this.wave));

        this.lifeMarks.forEach((mark, i) => {
            const spent = i >= this.lives;
            mark.setFillStyle(COLOR.ink, spent ? 0.16 : 1);
        });
    }

    togglePause() {
        this.paused = !this.paused;

        this.pauseOverlay.setVisible(this.paused);

        if (this.paused) {
            this.physics.pause();
        } else {
            this.physics.resume();
        }
    }

    update(time: number, delta: number) {
        if (this.paused) {
            return;
        }

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
        this.asteroids.getChildren().forEach((asteroid) => this.screenWrap(asteroid as PhysicsImage));
        this.bullets.getChildren().forEach((bullet) => this.screenWrap(bullet as any));

        if (this.cursors.space.isDown) {
            this.tryFire(time);
        }
    }

    screenWrap(obj: Phaser.GameObjects.GameObject & { x: number; y: number }) {
        if (obj.x < -WRAP_MARGIN) obj.x = WIDTH + WRAP_MARGIN;
        else if (obj.x > WIDTH + WRAP_MARGIN) obj.x = -WRAP_MARGIN;
        if (obj.y < -WRAP_MARGIN) obj.y = HEIGHT + WRAP_MARGIN;
        else if (obj.y > HEIGHT + WRAP_MARGIN) obj.y = -WRAP_MARGIN;
    }

    tryFire(time: number) {
        if (time - this.lastFiredTime > this.fireRate) {
            this.fire();
            this.lastFiredTime = time;
        }
    }

    fire() {
        const bullet = this.add.circle(this.ship.x, this.ship.y, 2, COLOR.accent);
        this.physics.add.existing(bullet);
        this.bullets.add(bullet);

        this.shots += 1;

        const body = bullet.body as Phaser.Physics.Arcade.Body;
        this.physics.velocityFromRotation(this.ship.rotation - Math.PI / 2, this.bulletSpeed, body.velocity);

        // Destroy after 2 seconds so offscreen bullets don't leak
        this.time.delayedCall(2000, () => bullet.destroy());
    }

    spawnAsteroid(x: number, y: number, size: number) {
        // size: 3 = large, 2 = medium, 1 = small
        const radius = size * 15; // 45px, 30px, 15px

        const asteroidSprites = ["asteroid0", "asteroid1", "asteroid2"];

        const asteroid = this.add.image(x, y, asteroidSprites[size - 1]);
        asteroid.setTint(COLOR.ink);
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
                y = Phaser.Math.Between(0, HEIGHT);
            } // left
            else if (edge === 1) {
                x = WIDTH;
                y = Phaser.Math.Between(0, HEIGHT);
            } // right
            else if (edge === 2) {
                x = Phaser.Math.Between(0, WIDTH);
                y = 0;
            } // top
            else {
                x = Phaser.Math.Between(0, WIDTH);
                y = HEIGHT;
            } // bottom

            this.spawnAsteroid(x, y, 3); // all start large
        }
    }

    hitAsteroid(asteroid: any, bullet: any) {
        const size = asteroid.getData("size");

        this.hits += 1;
        this.score += SCORE_BY_SIZE[size] * this.wave;

        if (size > 1) {
            this.spawnAsteroid(asteroid.x, asteroid.y, size - 1);
            this.spawnAsteroid(asteroid.x, asteroid.y, size - 1);
        }

        asteroid.destroy();
        bullet.destroy();

        this.refreshHud();

        if (this.asteroids.countActive(true) === 0) {
            this.nextWave();
        }
    }

    nextWave() {
        this.wave += 1;
        this.refreshHud();

        //  A short breath between waves, then a bigger field.
        this.time.delayedCall(900, () => this.spawnWave(3 + this.wave));
    }

    shipHit(_ship: any, asteroid: any) {
        if (this.time.now < this.invulnerableUntil) {
            return;
        }

        this.lives -= 1;
        this.refreshHud();

        if (this.lives <= 0) {
            this.endRun();
            return;
        }

        //  Clear the rock that got us so the respawn isn't an instant second death.
        asteroid.destroy();

        this.ship.setPosition(WIDTH / 2, HEIGHT / 2);
        this.ship.setAngle(0);
        this.ship.body.setVelocity(0, 0);
        this.ship.body.setAcceleration(0);

        this.invulnerableUntil = this.time.now + RESPAWN_INVULNERABILITY;

        this.tweens.add({
            targets: this.ship,
            alpha: { from: 0.25, to: 1 },
            duration: 200,
            yoyo: true,
            repeat: RESPAWN_INVULNERABILITY / 400 - 1,
            onComplete: () => this.ship.setAlpha(1),
        });
    }

    endRun() {
        recordLastRun(this.score);

        this.scene.start("GameOver", {
            score: this.score,
            wave: this.wave,
            shots: this.shots,
            hits: this.hits,
        });
    }
}
