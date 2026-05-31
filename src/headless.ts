// ---------------------------------------------------------------------------
// Neuro-Runner — headless trainer / benchmark.
//
// Runs the simulation core with NO canvas and NO DOM: just the seeded engine,
// stepped at a fixed timestep until a target number of generations have been
// bred. Proves the `types / net / engine` trio really is framework-agnostic,
// and gives a quick way to watch the learning curve from a terminal.
//
//   npm run train                  # 60 generations, default config
//   npm run train -- --gens 200    # run longer
//   npm run train -- --seed 7      # different deterministic run
//   npm run train -- --pop 150     # bigger population
// ---------------------------------------------------------------------------

import { DEFAULT_CONFIG, createWorld, step } from "./engine";
import type { World } from "./types";

const FIXED = 1 / 120; // same timestep the browser demo integrates at
const MAX_STEPS_PER_GEN = 200_000; // safety valve against a non-terminating gen

interface Args {
  gens: number;
  seed: number;
  pop: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    gens: 60,
    seed: DEFAULT_CONFIG.seed,
    pop: DEFAULT_CONFIG.populationSize,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--gens" && value) (args.gens = +value), i++;
    else if (flag === "--seed" && value) (args.seed = +value), i++;
    else if (flag === "--pop" && value) (args.pop = +value), i++;
  }
  return args;
}

/** Run a single generation to extinction; return that generation's best. */
function runGeneration(world: World): number {
  const startGen = world.generation;
  let steps = 0;
  // step() calls evolve() (which bumps `generation`) the instant the last
  // agent dies, so the generation is over as soon as the counter moves.
  while (world.generation === startGen && steps < MAX_STEPS_PER_GEN) {
    step(world, FIXED);
    steps++;
  }
  // history holds best-per-completed-gen; the just-finished one is last.
  return world.history[world.history.length - 1] ?? world.best;
}

function bar(value: number, max: number, width = 32): string {
  const filled = max > 0 ? Math.round((value / max) * width) : 0;
  return "█".repeat(filled) + "·".repeat(Math.max(0, width - filled));
}

function train({ gens, seed, pop }: Args): void {
  const world = createWorld({
    ...DEFAULT_CONFIG,
    seed,
    populationSize: pop,
  });

  console.log(
    `neuro-runner · ${pop} agents · seed ${seed >>> 0} · ${gens} generations\n`,
  );

  const bests: number[] = [];
  for (let g = 0; g < gens; g++) {
    bests.push(runGeneration(world));
  }

  const peak = Math.max(...bests);
  const stride = Math.max(1, Math.ceil(gens / 24)); // ~24 printed rows max
  for (let g = 0; g < bests.length; g += stride) {
    const gen = String(g + 1).padStart(4, " ");
    const score = String(Math.round(bests[g])).padStart(6, " ");
    console.log(`gen ${gen} | ${bar(bests[g], peak)} | ${score}`);
  }

  const first = bests[0] || 1;
  console.log(
    `\nbest ever: ${Math.round(world.bestEver)} · ` +
      `gen 1 best: ${Math.round(bests[0])} · ` +
      `final best: ${Math.round(bests[bests.length - 1])} · ` +
      `${(peak / first).toFixed(1)}× improvement`,
  );
}

train(parseArgs(process.argv.slice(2)));
