// ---------------------------------------------------------------------------
// Neuro-Runner — shared types for the framework-agnostic simulation core.
// No DOM imports live here (or in net.ts / engine.ts) so the same engine runs
// anywhere: this vanilla demo, a React app, a worker, or Node.
// ---------------------------------------------------------------------------

/** A tiny fully-connected net: in -> hidden (tanh) -> out (sigmoid). */
export interface Net {
  nIn: number;
  nHid: number;
  nOut: number;
  w1: Float32Array; // [nHid * nIn]  hidden <- input weights
  b1: Float32Array; // [nHid]        hidden bias
  w2: Float32Array; // [nOut * nHid] output <- hidden weights
  b2: Float32Array; // [nOut]        output bias
}

/** Last forward-pass activations, kept on each agent for the NN visualiser. */
export interface Activation {
  inputs: number[];
  hidden: number[];
  out: number[];
}

export interface Agent {
  net: Net;
  y: number; // height above ground (0 = grounded), logical units
  vy: number; // vertical velocity (units/s), +up
  alive: boolean;
  fitness: number; // distance survived this generation
  cleared: number; // obstacles cleared (tie-breaker / score)
  act: Activation; // last activations (for the best-agent diagram)
  hue: number; // small per-agent jitter so the swarm reads as individuals
}

export interface Obstacle {
  x: number; // left edge, logical units
  w: number;
  h: number;
  scored: boolean;
}

export interface WorldConfig {
  populationSize: number;
  eliteCount: number; // top performers copied unchanged into next gen
  mutationRate: number; // probability each weight mutates
  mutationScale: number; // std-dev of the gaussian nudge
  gravity: number; // units/s^2
  jumpImpulse: number; // initial upward velocity on jump
  startSpeed: number; // initial scroll speed (units/s)
  maxSpeed: number;
  accel: number; // speed gained per second alive
  seed: number; // deterministic first run; reset() can reseed
}

export interface World {
  config: WorldConfig;
  agents: Agent[];
  obstacles: Obstacle[];
  generation: number;
  aliveCount: number;
  best: number; // best fitness among CURRENT generation
  bestEver: number; // best fitness across all generations
  speed: number;
  distance: number; // distance scrolled this generation
  spawnGap: number; // distance until next obstacle spawn
  history: number[]; // best fitness per COMPLETED generation (learning curve)
  rng: () => number; // seeded PRNG in [0, 1)
  // logical layout (renderer scales these to device pixels)
  width: number;
  height: number;
  groundY: number;
  agentX: number;
}

/** Theme colours handed to the renderer. */
export interface Palette {
  accent: string;
  fg: string;
  bg: string;
  line: string;
  dim: string; // faint fg, for the swarm
}
