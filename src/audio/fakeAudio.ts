/**
 * A recording stand-in for the Web Audio API, for unit tests: it produces no sound but remembers
 * every node that was created, how nodes were wired and every parameter automation call.
 */
import type {
  BufferLike,
  BufferSourceLike,
  CompressorLike,
  FilterLike,
  GainLike,
  NodeLike,
  OscLike,
  PannerLike,
  ParamLike,
  RealtimeCtxLike,
  ShaperLike,
} from './types';

export type AutomationKind = 'set' | 'linear' | 'exponential' | 'target';

export interface AutomationEvent {
  kind: AutomationKind;
  value: number;
  time: number;
}

export class FakeParam implements ParamLike {
  readonly events: AutomationEvent[] = [];
  /** Every value ever assigned directly, which real browsers reject when not finite. */
  readonly assigned: number[] = [];
  private current: number;

  constructor(initial: number) {
    this.current = initial;
  }

  get value(): number {
    return this.current;
  }

  set value(v: number) {
    FakeParam.check(v);
    this.current = v;
    this.assigned.push(v);
  }

  /** Real AudioParams throw a TypeError on anything that is not a finite number. */
  private static check(...values: number[]): void {
    for (const v of values) if (!Number.isFinite(v)) throw new TypeError(`non-finite AudioParam value: ${v}`);
  }

  private record(kind: AutomationKind, value: number, time: number): void {
    FakeParam.check(value, time);
    this.events.push({ kind, value, time });
  }

  setValueAtTime(value: number, time: number): void {
    this.record('set', value, time);
  }

  linearRampToValueAtTime(value: number, time: number): void {
    this.record('linear', value, time);
  }

  exponentialRampToValueAtTime(value: number, time: number): void {
    this.record('exponential', value, time);
  }

  setTargetAtTime(target: number, time: number): void {
    this.record('target', target, time);
  }
}

export type FakeKind = 'destination' | 'oscillator' | 'bufferSource' | 'gain' | 'filter' | 'compressor' | 'shaper' | 'panner';

export class FakeNode implements NodeLike {
  readonly outputs: Array<NodeLike | ParamLike> = [];
  disconnected = false;

  constructor(readonly kind: FakeKind) {}

  connect(destination: NodeLike | ParamLike): void {
    this.outputs.push(destination);
  }

  disconnect(): void {
    this.outputs.length = 0;
    this.disconnected = true;
  }
}

export class FakeSource extends FakeNode {
  startedAt: number | null = null;
  stoppedAt: number | null = null;

  constructor(kind: 'oscillator' | 'bufferSource', private readonly ctx: FakeAudioContext) {
    super(kind);
  }

  start(when?: number): void {
    if (this.startedAt !== null) throw new Error('InvalidStateError: source started twice');
    this.startedAt = when ?? this.ctx.currentTime;
  }

  stop(when?: number): void {
    if (this.startedAt === null) throw new Error('InvalidStateError: source stopped before it was started');
    this.stoppedAt = when ?? this.ctx.currentTime;
  }
}

export class FakeOscillator extends FakeSource implements OscLike {
  type = 'sine';
  readonly frequency = new FakeParam(440);
  readonly detune = new FakeParam(0);

  constructor(ctx: FakeAudioContext) {
    super('oscillator', ctx);
  }
}

export class FakeBufferSource extends FakeSource implements BufferSourceLike {
  buffer: BufferLike | null = null;
  loop = false;
  readonly playbackRate = new FakeParam(1);

  constructor(ctx: FakeAudioContext) {
    super('bufferSource', ctx);
  }
}

export class FakeGain extends FakeNode implements GainLike {
  readonly gain = new FakeParam(1);

  constructor() {
    super('gain');
  }
}

export class FakeFilter extends FakeNode implements FilterLike {
  type = 'lowpass';
  readonly frequency = new FakeParam(350);
  readonly Q = new FakeParam(1);

  constructor() {
    super('filter');
  }
}

export class FakePanner extends FakeNode implements PannerLike {
  readonly pan = new FakeParam(0);

  constructor() {
    super('panner');
  }
}

export class FakeCompressor extends FakeNode implements CompressorLike {
  readonly threshold = new FakeParam(-24);
  readonly knee = new FakeParam(30);
  readonly ratio = new FakeParam(12);
  readonly attack = new FakeParam(0.003);
  readonly release = new FakeParam(0.25);

  constructor() {
    super('compressor');
  }
}

export class FakeShaper extends FakeNode implements ShaperLike {
  curve: Float32Array | null = null;

  constructor() {
    super('shaper');
  }
}

export class FakeAudioContext implements RealtimeCtxLike {
  currentTime = 0;
  readonly sampleRate = 48000;
  state = 'suspended';
  readonly destination = new FakeNode('destination');
  readonly nodes: FakeNode[] = [];
  buffersCreated = 0;

  private track<T extends FakeNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }

  createOscillator(): FakeOscillator {
    return this.track(new FakeOscillator(this));
  }

  createBufferSource(): FakeBufferSource {
    return this.track(new FakeBufferSource(this));
  }

  createGain(): FakeGain {
    return this.track(new FakeGain());
  }

  createBiquadFilter(): FakeFilter {
    return this.track(new FakeFilter());
  }

  createDynamicsCompressor(): FakeCompressor {
    return this.track(new FakeCompressor());
  }

  createWaveShaper(): FakeShaper {
    return this.track(new FakeShaper());
  }

  createStereoPanner(): FakePanner {
    return this.track(new FakePanner());
  }

  createBuffer(_channels: number, length: number, sampleRate: number): BufferLike {
    this.buffersCreated++;
    const data = new Float32Array(length);
    return { length, duration: length / sampleRate, getChannelData: () => data };
  }

  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }

  /** Oscillators and buffer sources created so far. */
  get sources(): FakeSource[] {
    return this.nodes.filter((n): n is FakeSource => n instanceof FakeSource);
  }

  count(kind: FakeKind): number {
    let n = 0;
    for (const node of this.nodes) if (node.kind === kind) n++;
    return n;
  }

  /** Every automation event and direct assignment on every parameter of every node. */
  allParamValues(): number[] {
    const values: number[] = [];
    for (const node of this.nodes) {
      for (const field of Object.values(node)) {
        if (!(field instanceof FakeParam)) continue;
        for (const e of field.events) values.push(e.value, e.time);
        values.push(...field.assigned);
      }
    }
    return values;
  }
}
