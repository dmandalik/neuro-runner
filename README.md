# Neuro-Runner

A population of tiny neural networks learns to clear an endless obstacle course
by **neuroevolution** — no training data, no labels, no machine-learning
libraries. Just a genetic algorithm, a few hundred lines of TypeScript, and a
canvas.

Each agent is controlled by a small feedforward network. Fitness is the
distance it survives. When the whole population dies, the next generation is
bred from the survivors — keep the elites, then fill the rest with
fitness-weighted crossover and Gaussian mutation. Repeat. Watch it get good.

## Why it's interesting

- **No backpropagation.** The networks never see a gradient. Behaviour emerges
  purely from selection pressure over generations.
- **Zero dependencies in the core.** `net.ts`, `engine.ts`, and `types.ts` have
  no DOM or framework imports, so the same engine runs in the browser, a Web
  Worker, or Node.
- **Deterministic.** A seeded `mulberry32` PRNG drives initialisation, obstacle
  spawning, and breeding, so a given seed always produces the same run.
- **Cheap.** The whole population is forward-passed every frame with plain
  loops over `Float32Array`s — no allocations in the hot path.

## The network

```
  inputs (5)            hidden (6)        output (1)
  ───────────           ──────────        ──────────
  distance to obstacle
  obstacle width    ──▶  tanh layer  ──▶  sigmoid  ──▶  jump if > 0.5
  obstacle height
  scroll speed
  vertical velocity
```

All five inputs are normalised to roughly `[0, 1]` (or `[-1, 1]` for velocity)
so no single sensor dominates early on.

## The genetic algorithm

Each generation:

1. **Rank** agents by fitness (distance survived), breaking ties by obstacles
   cleared.
2. **Elitism** — copy the top `eliteCount` networks into the next generation
   unchanged, so the best behaviour is never lost.
3. **Selection** — pick parents with roulette-wheel sampling weighted by
   `fitness + 1` (the `+1` lets a generation that scored nothing still breed).
4. **Crossover** — uniform: each weight in the child is copied from one of the
   two parents at random.
5. **Mutation** — each weight has `mutationRate` chance of a Gaussian nudge of
   standard deviation `mutationScale`.

Difficulty ramps over a run: scroll speed accelerates, and obstacle gaps widen
with speed so the course stays clearable.

## Project layout

```
src/
  types.ts    shared interfaces (no imports)
  net.ts      network: make / clone / forward / mutate / crossover
  engine.ts   world: createWorld / step / evolve / resetWorld  (the GA lives here)
  render.ts   canvas drawing — pure, takes a palette
  main.ts     vanilla demo: DPR canvas, fixed-timestep RAF loop, HUD, controls
index.html    the demo page
```

The `types.ts` / `net.ts` / `engine.ts` trio is the reusable core. `render.ts`
and `main.ts` are one possible front-end; swap them for React, a worker, or a
headless Node harness without touching the simulation.

## Run it

```bash
npm install
npm run dev      # vite dev server
npm run build    # type-check + production build to dist/
```

## Tuning

All knobs live in `DEFAULT_CONFIG` in `src/engine.ts`:

| field            | meaning                                   |
| ---------------- | ----------------------------------------- |
| `populationSize` | agents per generation                     |
| `eliteCount`     | top performers carried over unchanged     |
| `mutationRate`   | probability each weight mutates           |
| `mutationScale`  | std-dev of the Gaussian nudge             |
| `gravity` / `jumpImpulse` | jump feel                        |
| `startSpeed` / `maxSpeed` / `accel` | difficulty ramp        |
| `seed`           | deterministic run seed                    |

## License

MIT
