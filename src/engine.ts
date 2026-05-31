// ---------------------------------------------------------------------------
// Neuro-Runner — the simulation + neuroevolution loop.
// A population of agents runs the SAME obstacle course at once. Fitness is the
// distance survived; when the last agent dies the generation is bred anew with
// elitism + crossover + mutation. Everything is deterministic given the seed.
// ---------------------------------------------------------------------------

import type { Agent, World, WorldConfig } from "./types";
import { cloneNet, crossover, forward, makeNet, mutate } from "./net";

// --- network shape ----------------------------------------------------------
export const N_IN = 5; // [dist, width, height, speed, vy]
export const N_HID = 6;
export const N_OUT = 1; // jump probability

// --- logical world dimensions (renderer scales these to pixels) -------------
const W = 300;
const H = 120;
const GROUND_Y = H - 16;
const AGENT_X = W * 0.16;
const AGENT_W = 9;
const AGENT_H = 13;

const OBS_MIN_W = 7;
const OBS_MAX_W = 15;
const OBS_MIN_H = 14;
const OBS_MAX_H = 30;
const GAP_MIN = 95; // min horizontal distance between obstacles
const GAP_RAND = 90; // + up to this much (scaled by speed)

export const DEFAULT_CONFIG: WorldConfig = {
  populationSize: 80,
  eliteCount: 4,
  mutationRate: 0.1,
  mutationScale: 0.5,
  gravity: 1150,
  jumpImpulse: 360,
  startSpeed: 92,
  maxSpeed: 240,
  accel: 5,
  seed: 0x9e3779b9,
};

/** mulberry32 — small, fast, seedable PRNG. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function freshAgent(net: Agent["net"], rng: () => number): Agent {
  return {
    net,
    y: 0,
    vy: 0,
    alive: true,
    fitness: 0,
    cleared: 0,
    act: { inputs: new Array(N_IN).fill(0), hidden: new Array(N_HID).fill(0), out: new Array(N_OUT).fill(0) },
    hue: rng() * 0.5 - 0.25,
  };
}

export function createWorld(config: WorldConfig = DEFAULT_CONFIG): World {
  const rng = makeRng(config.seed);
  const agents: Agent[] = [];
  for (let i = 0; i < config.populationSize; i++) {
    agents.push(freshAgent(makeNet(N_IN, N_HID, N_OUT, rng), rng));
  }
  const world: World = {
    config,
    agents,
    obstacles: [],
    generation: 1,
    aliveCount: agents.length,
    best: 0,
    bestEver: 0,
    speed: config.startSpeed,
    distance: 0,
    spawnGap: 60,
    history: [],
    rng,
    width: W,
    height: H,
    groundY: GROUND_Y,
    agentX: AGENT_X,
  };
  return world;
}

function spawnObstacle(world: World) {
  const r = world.rng;
  world.obstacles.push({
    x: W + 8,
    w: OBS_MIN_W + r() * (OBS_MAX_W - OBS_MIN_W),
    h: OBS_MIN_H + r() * (OBS_MAX_H - OBS_MIN_H),
    scored: false,
  });
  // Faster scroll => wider gaps so the course stays clearable.
  const speedFactor = world.speed / world.config.startSpeed;
  world.spawnGap = GAP_MIN + r() * GAP_RAND * speedFactor;
}

/** Build the (normalised) sensor vector for one agent. */
function sense(world: World, agent: Agent, out: number[]) {
  // nearest obstacle whose right edge is still ahead of the agent
  let next = null as World["obstacles"][number] | null;
  for (let i = 0; i < world.obstacles.length; i++) {
    const o = world.obstacles[i];
    if (o.x + o.w >= AGENT_X) {
      next = o;
      break;
    }
  }
  const dist = next ? (next.x - AGENT_X) / W : 1;
  out[0] = dist < 0 ? 0 : dist > 1 ? 1 : dist;
  out[1] = next ? (next.w - OBS_MIN_W) / (OBS_MAX_W - OBS_MIN_W) : 0;
  out[2] = next ? (next.h - OBS_MIN_H) / (OBS_MAX_H - OBS_MIN_H) : 0;
  out[3] = (world.speed - world.config.startSpeed) / (world.config.maxSpeed - world.config.startSpeed);
  out[4] = agent.vy / world.config.jumpImpulse; // ~[-1, 1]
}

/** Advance the world by a fixed timestep `dt` (seconds). */
export function step(world: World, dt: number): void {
  const { config } = world;
  world.speed = Math.min(config.maxSpeed, world.speed + config.accel * dt);
  const dx = world.speed * dt;
  world.distance += dx;

  // scroll + recycle obstacles
  for (let i = 0; i < world.obstacles.length; i++) world.obstacles[i].x -= dx;
  if (world.obstacles.length && world.obstacles[0].x + world.obstacles[0].w < -4) {
    world.obstacles.shift();
  }
  world.spawnGap -= dx;
  if (world.spawnGap <= 0) spawnObstacle(world);

  let alive = 0;
  let best = 0;
  for (let a = 0; a < world.agents.length; a++) {
    const agent = world.agents[a];
    if (!agent.alive) continue;

    sense(world, agent, agent.act.inputs);
    const o = forward(agent.net, agent.act.inputs, agent.act.hidden, agent.act.out);
    if (o[0] > 0.5 && agent.y <= 0.0001) agent.vy = config.jumpImpulse;

    // physics
    agent.vy -= config.gravity * dt;
    agent.y += agent.vy * dt;
    if (agent.y < 0) {
      agent.y = 0;
      agent.vy = 0;
    }
    if (!Number.isFinite(agent.y)) {
      agent.y = 0;
      agent.vy = 0;
    }

    // collision (AABB) against any overlapping obstacle
    const ax0 = AGENT_X;
    const ax1 = AGENT_X + AGENT_W;
    const aBot = GROUND_Y - agent.y;
    for (let i = 0; i < world.obstacles.length; i++) {
      const ob = world.obstacles[i];
      const ox0 = ob.x;
      const ox1 = ob.x + ob.w;
      if (ax1 > ox0 + 1 && ax0 < ox1 - 1) {
        const oTop = GROUND_Y - ob.h;
        if (aBot > oTop + 1) {
          agent.alive = false;
          break;
        }
      }
      if (!ob.scored && ox1 < ax0) {
        ob.scored = true;
      }
      if (ox1 < ax0 && ox1 > ax0 - dx - 1) agent.cleared++;
    }

    if (agent.alive) {
      agent.fitness += dx;
      alive++;
      if (agent.fitness > best) best = agent.fitness;
    }
  }

  world.aliveCount = alive;
  world.best = best;
  if (best > world.bestEver) world.bestEver = best;

  if (alive === 0) evolve(world);
}

/** Breed the next generation: elitism + fitness-weighted crossover + mutation. */
function evolve(world: World): void {
  const { config, rng } = world;
  const ranked = [...world.agents].sort(
    (a, b) => b.fitness - a.fitness || b.cleared - a.cleared,
  );
  const genBest = ranked[0]?.fitness ?? 0;
  world.history.push(genBest);
  if (world.history.length > 240) world.history.shift();

  // roulette selection weighted by fitness (+1 so a zero-fitness gen still breeds)
  const weights = ranked.map((a) => a.fitness + 1);
  const total = weights.reduce((s, w) => s + w, 0);
  const pick = () => {
    let r = rng() * total;
    for (let i = 0; i < ranked.length; i++) {
      r -= weights[i];
      if (r <= 0) return ranked[i];
    }
    return ranked[0];
  };

  const next: Agent[] = [];
  for (let i = 0; i < config.eliteCount && i < ranked.length; i++) {
    next.push(freshAgent(cloneNet(ranked[i].net), rng)); // elites carried unchanged
  }
  while (next.length < config.populationSize) {
    const childNet = crossover(pick().net, pick().net, rng);
    mutate(childNet, config.mutationRate, config.mutationScale, rng);
    next.push(freshAgent(childNet, rng));
  }

  world.agents = next;
  world.obstacles = [];
  world.generation += 1;
  world.aliveCount = next.length;
  world.best = 0;
  world.speed = config.startSpeed;
  world.distance = 0;
  world.spawnGap = 60;
}

/** Hard reset with an optional new seed (used by the "reset" control). */
export function resetWorld(world: World, seed?: number): World {
  return createWorld({ ...world.config, seed: seed ?? (Math.random() * 0xffffffff) >>> 0 });
}
