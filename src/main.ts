// ---------------------------------------------------------------------------
// Neuro-Runner — vanilla demo entry point. Wires the framework-agnostic engine
// to a canvas with a fixed-timestep RAF loop, a small HUD, and speed / reset
// controls. Auto-pauses when the tab is hidden.
// ---------------------------------------------------------------------------

import type { Palette, World } from "./types";
import { createWorld, resetWorld, step } from "./engine";
import { drawWorld } from "./render";

const PALETTE: Palette = {
  accent: getCssVar("--accent", "#6ea8fe"),
  fg: getCssVar("--fg", "#e7e9ee"),
  bg: getCssVar("--bg", "#0a0d12"),
  line: getCssVar("--line", "rgba(255,255,255,0.1)"),
  dim: getCssVar("--dim", "#6b7280"),
};

function getCssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

const canvas = document.getElementById("sim") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

const $ = (id: string) => document.getElementById(id)!;
const SPEEDS = [1, 2, 4, 8];
let speedIdx = 0;

let world: World = createWorld();

// --- canvas sizing (DPR-aware) ---------------------------------------------
function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// --- fixed-timestep loop ----------------------------------------------------
const FIXED = 1 / 120;
let acc = 0;
let last = performance.now();
let raf: number | null = null;

function frame(now: number) {
  const real = Math.min(0.05, (now - last) / 1000);
  last = now;
  acc += real * SPEEDS[speedIdx];
  let steps = 0;
  while (acc >= FIXED && steps < 800) {
    step(world, FIXED);
    acc -= FIXED;
    steps++;
  }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  drawWorld(ctx, world, PALETTE, canvas.width / dpr, canvas.height / dpr);
  updateHud();
  raf = requestAnimationFrame(frame);
}

function start() {
  if (raf != null || document.visibilityState !== "visible") return;
  last = performance.now();
  acc = 0;
  raf = requestAnimationFrame(frame);
}

function stop() {
  if (raf != null) {
    cancelAnimationFrame(raf);
    raf = null;
  }
}

function updateHud() {
  $("gen").textContent = String(world.generation);
  $("alive").textContent = `${world.aliveCount}/${world.agents.length}`;
  $("best").textContent = String(Math.round(world.best));
  $("record").textContent = String(Math.round(world.bestEver));
}

// --- controls ---------------------------------------------------------------
$("speed").addEventListener("click", () => {
  speedIdx = (speedIdx + 1) % SPEEDS.length;
  $("speed").textContent = `Speed: ${SPEEDS[speedIdx]}×`;
});

$("reset").addEventListener("click", () => {
  world = resetWorld(world);
  acc = 0;
  updateHud();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") start();
  else stop();
});

updateHud();
start();
