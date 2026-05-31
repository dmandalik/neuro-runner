// ---------------------------------------------------------------------------
// Neuro-Runner — the neural network + genetic operators.
// Hand-rolled (no TensorFlow / no deps): a single hidden layer evaluated with
// plain loops. Forward passes are cheap enough to run a whole population every
// frame. Weights are evolved, never back-propagated.
// ---------------------------------------------------------------------------

import type { Net } from "./types";

const tanh = Math.tanh;
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** Gaussian sample (Box–Muller) using the provided uniform PRNG. */
function randn(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function fill(n: number, rng: () => number): Float32Array {
  const a = new Float32Array(n);
  // Xavier-ish init keeps early activations in a sane range.
  for (let i = 0; i < n; i++) a[i] = randn(rng) * 0.8;
  return a;
}

export function makeNet(
  nIn: number,
  nHid: number,
  nOut: number,
  rng: () => number,
): Net {
  return {
    nIn,
    nHid,
    nOut,
    w1: fill(nHid * nIn, rng),
    b1: fill(nHid, rng),
    w2: fill(nOut * nHid, rng),
    b2: fill(nOut, rng),
  };
}

export function cloneNet(n: Net): Net {
  return {
    nIn: n.nIn,
    nHid: n.nHid,
    nOut: n.nOut,
    w1: n.w1.slice(),
    b1: n.b1.slice(),
    w2: n.w2.slice(),
    b2: n.b2.slice(),
  };
}

/**
 * Forward pass. Writes hidden + output activations into the supplied scratch
 * arrays (so the caller can render them) and returns the output array.
 */
export function forward(
  net: Net,
  inputs: number[],
  hidden: number[],
  out: number[],
): number[] {
  const { nIn, nHid, nOut, w1, b1, w2, b2 } = net;
  for (let h = 0; h < nHid; h++) {
    let sum = b1[h];
    const base = h * nIn;
    for (let i = 0; i < nIn; i++) sum += w1[base + i] * inputs[i];
    hidden[h] = tanh(sum);
  }
  for (let o = 0; o < nOut; o++) {
    let sum = b2[o];
    const base = o * nHid;
    for (let h = 0; h < nHid; h++) sum += w2[base + h] * hidden[h];
    out[o] = sigmoid(sum);
  }
  return out;
}

/** In-place gaussian mutation; each weight has `rate` chance to be nudged. */
export function mutate(
  net: Net,
  rate: number,
  scale: number,
  rng: () => number,
): void {
  const nudge = (a: Float32Array) => {
    for (let i = 0; i < a.length; i++) {
      if (rng() < rate) a[i] += randn(rng) * scale;
    }
  };
  nudge(net.w1);
  nudge(net.b1);
  nudge(net.w2);
  nudge(net.b2);
}

/** Uniform crossover: each weight is taken from one of the two parents. */
export function crossover(a: Net, b: Net, rng: () => number): Net {
  const child = cloneNet(a);
  const mix = (dst: Float32Array, src: Float32Array) => {
    for (let i = 0; i < dst.length; i++) if (rng() < 0.5) dst[i] = src[i];
  };
  mix(child.w1, b.w1);
  mix(child.b1, b.b1);
  mix(child.w2, b.w2);
  mix(child.b2, b.b2);
  return child;
}
