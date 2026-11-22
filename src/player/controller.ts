/**
 * The PlayerController ties the player together once per frame: intent -> look and hotbar -> physics -> raycast
 * -> interaction -> camera. It drives whatever draws the world only through IView (spec section 9) and never
 * imports src/render, src/sim or src/ui: screens are requested with 'ui:open' and machines react to world edits.
 */
import { PLAYER_EYE, REACH, WALK_SPEED, HOTBAR_SIZE } from '../core/constants';
import type { GameBus, InputState, IView, Settings } from '../core/context';
import { clamp, type Vec3 } from '../core/math';
import type { IWorld } from '../core/types';
import { exertJump, type PlayerState } from '../game';
import type { BrewHands } from './brewTools';
import { useRepeatFor, type HandHands } from './handTools';
import { AnimalHands, type AnimalTargets } from './animals';
import { SCOOPING_BUCKETS } from './buckets';
import type { Intent } from './input/intent';
import { Interaction } from './interaction';
import { PlayerPhysics } from './physics';
import type { TransportHands } from './pipeTools';
import { blockOfItem } from '../core/registry';
import { createRayHit, raycast, screenBehindThin, type LiquidAim, type RayHit } from './raycast';
import { attachSapSave } from './sapTools';

/** Where the controller gets its per-frame intent (the InputManager, or a script in tests and harnesses). */
export interface IntentSource {
  frame(dtSeconds: number): Intent;
  /** Capture the mouse again (after a screen closed). Optional for sources without a pointer. */
  requestPointerCapture?(): Promise<boolean>;
  releasePointerCapture?(): void;
  /** Seconds between repeats of a held Use (a hand station's stroke rate); optional for scripted sources. */
  setUseRepeat?(seconds: number): void;
}

export interface PlayerControllerOptions {
  world: IWorld;
  bus: GameBus;
  player: PlayerState;
  view: IView;
  input: IntentSource;
  settings: Settings;
  state: InputState;
  /** Random source for drop rolls (default Math.random). */
  rng?: () => number;
  /** The animals (src/mobs' MobManager): Mine hits them, Use feeds them. Without it only blocks are targeted. */
  animals?: AnimalTargets;
  /** Pipes and fluids (src/sim's Simulation): the wrench and buckets on tanks. Without it the wrench does nothing. */
  transport?: TransportHands;
  /** The simulation's brewing (src/sim's Simulation fits it): cups, heated buckets, the kettle, furnace-top placing. */
  brew?: BrewHands;
  /** The simulation's hand work (src/sim's Simulation fits it): strokes at the Ember stations, moulds poured at a furnace. */
  hands?: HandHands;
}

/** An empty bucket aims at liquid sources, through flowing water (spec 18.3); anything else looks through liquids. */
const liquidAim = (item: string | undefined): LiquidAim => (item !== undefined && SCOOPING_BUCKETS.has(item) ? 'sources' : false);

/** Degrees added to the field of view at full sprint. */
export const SPRINT_FOV_KICK = 8;
/** Vertical / sideways amplitude of the view bob at walking speed, in blocks. */
const BOB_Y = 0.045;
const BOB_X = 0.025;
/** Bob cycles per block walked. */
const BOB_FREQ = 0.62;
/** Blocks walked on the ground between footstep sounds. */
const STEP_EVERY = 1.75;
/** A landing from higher than this makes a thud. */
const LAND_SOUND_FROM = 1.2;
/** Looking straight up or down stops just short of the pole (so the view direction never degenerates). */
const PITCH_LIMIT = Math.PI / 2 - 0.01;
/** "Too hungry to sprint" is repeated at most this often (a thumb pushes the stick to the edge all the time). */
const HUNGRY_SPRINT_ADVICE_S = 20;
/** Dev Mode: two Jump taps within this many seconds toggle flight. */
const DOUBLE_TAP_S = 0.35;

export class PlayerController {
  readonly physics: PlayerPhysics;
  readonly interaction: Interaction;
  /** Mine / Use on animals, when the game has them. */
  readonly animals: AnimalHands | null;
  private readonly world: IWorld;
  private readonly bus: GameBus;
  private readonly player: PlayerState;
  private readonly view: IView;
  private readonly input: IntentSource;
  private readonly settings: Settings;
  private readonly state: InputState;
  private readonly hit: RayHit = createRayHit();
  /** A screen block behind a thin block under the crosshair (see useTarget). */
  private readonly behind: RayHit = createRayHit();
  private readonly dir: Vec3 = { x: 0, y: 0, z: 1 };
  private readonly targetBox = { x: 0, y: 0, z: 0 };
  private readonly unsubscribe: Array<() => void> = [];
  private currentTarget: RayHit | null = null;
  /** The block behind an animal under the crosshair (Use that means nothing to animals goes there). */
  private blockBehind: RayHit | null = null;
  private fov = -1;
  private heldKey: string | null | undefined = undefined;
  private bobPhase = 0;
  private bobAmount = 0;
  /** Camera lag after stepping up onto a slab, so the eye glides instead of snapping. */
  private stepOffset = 0;
  private stepDistance = 0;
  /** The mouse was captured at some point and should be captured again when a screen closes. */
  private wantsLock = false;
  /** Sprint was asked for on the previous frame (the hungry hint fires on a fresh request only). */
  private jumpHeld = false;
  private sinceJumpTap = 9;
  private sprintWanted = false;

  constructor(options: PlayerControllerOptions) {
    this.world = options.world;
    this.bus = options.bus;
    this.player = options.player;
    this.view = options.view;
    this.input = options.input;
    this.settings = options.settings;
    this.state = options.state;
    this.physics = new PlayerPhysics(this.world, this.player);
    this.interaction = new Interaction(this.world, this.bus, this.player, this.physics, this.view, options.rng ?? Math.random, options.transport ?? null, options.brew ?? null, options.hands ?? null);
    this.animals = options.animals ? new AnimalHands(options.animals, this.player, this.view, this.interaction) : null;
    this.unsubscribe.push(
      this.bus.on('ui:opened', () => {
        this.interaction.stopMining();
        this.input.releasePointerCapture?.();
      }),
      this.bus.on('ui:closed', () => this.recapture()),
      this.bus.on('player:respawn', () => this.physics.reset()),
      // Weeping logs ride the world snapshot (extras.sap). Test worlds without persist stay session-only.
      attachSapSave(this.world, this.player),
    );
  }

  /** The block under the crosshair after the last update, or null (also while an animal is in front of it). */
  get target(): RayHit | null {
    return this.currentTarget;
  }

  /** Id of the animal under the crosshair after the last update, or null. */
  get targetAnimal(): number | null {
    return this.animals?.target ?? null;
  }

  /** Mining progress 0..1 on the target, or -1. */
  get miningProgress(): number {
    return this.interaction.progress;
  }

  /** Moves the player (feet position) and forgets any fall in progress. */
  teleport(x: number, y: number, z: number): void {
    const p = this.player.position;
    p.x = x;
    p.y = y;
    p.z = z;
    this.physics.reset();
  }

  /** One frame. `dt` in seconds (the game loop clamps it to 0.1). */
  update(dt: number): void {
    // Holding Use on a hand station repeats at its stroke rate (the aim of the last frame decides).
    this.input.setUseRepeat?.(useRepeatFor(this.currentTarget?.block ?? null));
    const intent = this.input.frame(dt);
    const p = this.player;
    if (this.state.pointerLocked) this.wantsLock = true;
    p.combat.coolStrike(dt);

    if (!p.dead) {
      p.yaw -= intent.lookYaw;
      if (p.yaw > Math.PI) p.yaw -= Math.PI * 2;
      else if (p.yaw < -Math.PI) p.yaw += Math.PI * 2;
      p.pitch = clamp(p.pitch + intent.lookPitch, -PITCH_LIMIT, PITCH_LIMIT);
      this.hotbar(intent);
      this.menus(intent);
      if (intent.drop) p.dropHeld(intent.dropAll);
      // Use with a collector (the hand vacuum pump) in hand runs it instead of acting on the world.
      if (intent.use && p.collectors.trigger()) intent.use = false;
      this.move(dt, intent);
    }

    this.currentTarget = this.cast();
    if (!p.dead) {
      const edits = this.interaction.edits;
      if (this.animals?.target != null) this.actOnAnimal(dt, intent);
      else {
        if (intent.use) this.interaction.use(this.useTarget(this.currentTarget), intent.place);
        this.interaction.updateMining(dt, intent.mine, this.currentTarget);
      }
      // A broken or placed block changes what is under the crosshair this very frame.
      if (this.interaction.edits !== edits) this.currentTarget = this.cast();
    } else {
      this.interaction.stopMining();
      if (this.animals) this.animals.target = null;
    }
    this.updateView(dt);
  }

  dispose(): void {
    for (const off of this.unsubscribe) off();
    this.unsubscribe.length = 0;
    this.interaction.stopMining();
  }

  // ---------------------------------------------------------------------------------------------

  private hotbar(intent: Intent): void {
    if (intent.hotbarSlot !== null) this.player.selectSlot(intent.hotbarSlot);
    if (intent.hotbarStep !== 0) {
      this.player.selectSlot((this.player.selectedSlot + intent.hotbarStep + HOTBAR_SIZE) % HOTBAR_SIZE);
    }
  }

  private menus(intent: Intent): void {
    if (intent.pause) this.bus.emit('ui:open', { screen: { type: 'pause' } });
    else if (intent.inventory) this.bus.emit('ui:open', { screen: { type: this.player.dev ? 'creative' : 'inventory' } });
    else if (intent.log) this.bus.emit('ui:open', { screen: { type: 'log' } });
  }

  private move(dt: number, intent: Intent): void {
    const p = this.player;
    const sprintAsked = intent.sprint && intent.moveZ > 0;
    if (sprintAsked && !this.sprintWanted && p.hungry && !p.dead) {
      this.interaction.advise('sprint', 'Too hungry to sprint - eat something', HUNGRY_SPRINT_ADVICE_S);
    }
    this.sprintWanted = sprintAsked;
    this.devFlight(dt, intent.jump);
    const r = this.physics.step(dt, intent);
    if (r.jumped) {
      this.sfx('jump');
      exertJump(p);
    }
    if (r.enteredWater) this.sfx('splash');
    else if (r.landedFrom > LAND_SOUND_FROM) this.sfx('land');
    if (r.steppedUp > 0) this.stepOffset -= r.steppedUp;
    if (p.onGround && r.walked > 0) {
      this.stepDistance += r.walked;
      if (this.stepDistance >= STEP_EVERY) {
        this.stepDistance -= STEP_EVERY;
        this.sfx('step', 0.6);
      }
    }
    // View bob follows the distance walked, fading in and out with ground speed.
    const speed = Math.hypot(p.velocity.x, p.velocity.z);
    const bobTarget = p.onGround && !this.physics.inLiquid ? clamp(speed / WALK_SPEED, 0, 1.3) : 0;
    this.bobAmount += (bobTarget - this.bobAmount) * (1 - Math.exp(-10 * dt));
    if (p.onGround) this.bobPhase += r.walked * BOB_FREQ * Math.PI * 2;
    this.sprintFov(dt, r.sprinting && speed > WALK_SPEED * 0.9);
  }

  /** Dev Mode: a second tap of Jump within 0.35 s toggles flight. */
  private devFlight(dt: number, jump: boolean): void {
    const p = this.player;
    this.sinceJumpTap += dt;
    if (!p.dev) {
      p.flying = false;
      this.jumpHeld = jump;
      return;
    }
    if (jump && !this.jumpHeld) {
      if (this.sinceJumpTap < DOUBLE_TAP_S) {
        p.flying = !p.flying;
        this.sinceJumpTap = DOUBLE_TAP_S;
      } else this.sinceJumpTap = 0;
    }
    this.jumpHeld = jump;
  }

  private sprintFov(dt: number, sprinting: boolean): void {
    const target = this.settings.fov + (sprinting ? SPRINT_FOV_KICK : 0);
    let next = this.fov < 0 ? target : this.fov + (target - this.fov) * (1 - Math.exp(-8 * dt));
    if (Math.abs(next - target) < 0.05) next = target;
    if (next !== this.fov) {
      this.fov = next;
      this.view.setFov(next);
    }
  }

  /**
   * The block under the crosshair, or null when nothing is in reach or an animal stands in front of it (then the
   * block is kept in `blockBehind` and the animal in `animals.target`).
   */
  private cast(): RayHit | null {
    const p = this.player;
    const held = p.heldStack();
    p.viewDir(this.dir);
    const d = this.dir;
    const hit = raycast(this.world, p.position.x, p.eyeY, p.position.z, d.x, d.y, d.z, REACH, liquidAim(held?.item), this.hit);
    this.blockBehind = hit;
    if (!this.animals || p.dead) return hit;
    const animal = this.animals.aim(p.position.x, p.eyeY, p.position.z, d.x, d.y, d.z, hit ? hit.distance : Infinity);
    return animal === null ? hit : null;
  }

  /**
   * What Use acts on: the target, or the screen block behind it when the target is a thin block without a screen
   * (a cable in a furnace mouth) that the ray passes beside, or that nothing held could be placed against.
   */
  private useTarget(hit: RayHit | null): RayHit | null {
    if (!hit) return null;
    const p = this.player;
    const held = p.heldStack()?.item;
    const d = this.dir;
    const behind = screenBehindThin(this.world, p.position.x, p.eyeY, p.position.z, d.x, d.y, d.z, REACH, liquidAim(held), hit, this.behind, !held || blockOfItem(held) === null);
    return behind ?? hit;
  }

  /** Mine and Use while an animal is under the crosshair: no block is mined; Use falls through when it is not food for it. */
  private actOnAnimal(dt: number, intent: Intent): void {
    const hands = this.animals as AnimalHands;
    this.interaction.updateMining(dt, false, null);
    if (intent.use && hands.use() === 'pass') this.interaction.use(this.useTarget(this.blockBehind), intent.place);
    if (intent.mine) hands.strike();
  }

  private updateView(dt: number): void {
    const p = this.player;
    this.stepOffset *= Math.exp(-14 * dt);
    if (Math.abs(this.stepOffset) < 1e-3) this.stepOffset = 0;
    const bobY = Math.abs(Math.sin(this.bobPhase)) * BOB_Y * this.bobAmount;
    const side = Math.sin(this.bobPhase) * BOB_X * this.bobAmount;
    const x = p.position.x + Math.cos(p.yaw) * side;
    const z = p.position.z - Math.sin(p.yaw) * side;
    this.view.setView(x, p.position.y + PLAYER_EYE + bobY + this.stepOffset, z, p.yaw, p.pitch);
    if (this.fov < 0) this.sprintFov(dt, false);

    const t = this.currentTarget;
    if (t) {
      this.targetBox.x = t.x;
      this.targetBox.y = t.y;
      this.targetBox.z = t.z;
      const mining = this.interaction.progress >= 0 && t.x === this.interaction.mx && t.y === this.interaction.my && t.z === this.interaction.mz;
      this.view.setTarget(this.targetBox, mining ? this.interaction.progress : -1);
    } else {
      this.view.setTarget(null, -1);
    }

    const key = p.heldStack()?.item ?? null;
    if (key !== this.heldKey) {
      this.heldKey = key;
      this.view.setHeldItem(key);
    }
  }

  private recapture(): void {
    if (!this.wantsLock || this.state.touch || !this.input.requestPointerCapture) return;
    void this.input.requestPointerCapture().then((locked) => {
      // A refusal (no user gesture yet) is fine: the next click on the view captures again.
      if (locked) this.state.pointerLocked = true;
    });
  }

  private sfx(name: 'jump' | 'splash' | 'land' | 'step', volume?: number): void {
    const p = this.player.position;
    this.bus.emit('sfx', { name, x: p.x, y: p.y, z: p.z, volume });
  }
}
