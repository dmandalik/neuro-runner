// ---------------------------------------------------------------------------
// Neuro-Runner — canvas renderer. Pure drawing: reads world state + a palette
// and paints. Minimal geometric style — thin strokes, a faint swarm, the
// current leader highlighted.
// ---------------------------------------------------------------------------

import type { Agent, Net, Palette, World } from "./types";

const AGENT_W = 9;
const AGENT_H = 13;

const IN_LABELS = ["dist", "width", "height", "speed", "vy"];

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  world: World,
  pal: Palette,
  pxW: number,
  pxH: number,
): void {
  const sx = pxW / world.width;
  const sy = pxH / world.height;
  const groundPx = world.groundY * sy;

  ctx.clearRect(0, 0, pxW, pxH);

  // ground line
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, groundPx + 0.5);
  ctx.lineTo(pxW, groundPx + 0.5);
  ctx.stroke();

  // scrolling ground ticks
  ctx.strokeStyle = pal.dim;
  ctx.globalAlpha = 0.5;
  const spacing = 26;
  const offset = world.distance % spacing;
  ctx.beginPath();
  for (let x = -offset; x < world.width; x += spacing) {
    const px = x * sx;
    ctx.moveTo(px, groundPx + 1);
    ctx.lineTo(px, groundPx + 4);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // obstacles
  ctx.fillStyle = pal.fg;
  ctx.globalAlpha = 0.85;
  for (const o of world.obstacles) {
    ctx.fillRect(o.x * sx, groundPx - o.h * sy, o.w * sx, o.h * sy);
  }
  ctx.globalAlpha = 1;

  // leader
  let leader: Agent | null = null;
  for (const a of world.agents) {
    if (a.alive && (!leader || a.fitness > leader.fitness)) leader = a;
  }

  const ax = world.agentX * sx;
  const aw = AGENT_W * sx;
  const ah = AGENT_H * sy;

  // swarm
  ctx.fillStyle = pal.accent;
  for (const a of world.agents) {
    if (!a.alive || a === leader) continue;
    ctx.globalAlpha = 0.16;
    ctx.fillRect(ax, groundPx - a.y * sy - ah, aw, ah);
  }
  ctx.globalAlpha = 1;

  // leader, solid + outlined
  if (leader) {
    const ly = groundPx - leader.y * sy - ah;
    ctx.fillStyle = pal.accent;
    ctx.fillRect(ax, ly, aw, ah);
    ctx.strokeStyle = pal.fg;
    ctx.lineWidth = 1;
    ctx.strokeRect(ax + 0.5, ly + 0.5, aw - 1, ah - 1);
  }
}

/**
 * Draw the leader's network: three columns of nodes (inputs, hidden, output)
 * wired by their weights. Edge opacity tracks |weight|; node brightness tracks
 * the latest activation, so you can literally watch the policy fire as the run
 * unfolds. `inputs / hidden / out` are the agent's last forward-pass values.
 */
export function drawNet(
  ctx: CanvasRenderingContext2D,
  net: Net,
  inputs: number[],
  hidden: number[],
  out: number[],
  pal: Palette,
  pxW: number,
  pxH: number,
): void {
  ctx.clearRect(0, 0, pxW, pxH);

  const padX = 58;
  const padY = 16;
  const counts = [net.nIn, net.nHid, net.nOut];
  const colX = [padX, pxW / 2, pxW - padX];
  const acts = [inputs, hidden, out];

  // y centre of each node, per column
  const colY = counts.map((n) => {
    const usable = pxH - padY * 2;
    const ys: number[] = [];
    for (let i = 0; i < n; i++) {
      ys.push(n === 1 ? pxH / 2 : padY + (usable * i) / (n - 1));
    }
    return ys;
  });

  // --- edges (drawn first, behind the nodes) --------------------------------
  drawLayer(ctx, net.w1, net.nIn, net.nHid, colX[0], colX[1], colY[0], colY[1], pal);
  drawLayer(ctx, net.w2, net.nHid, net.nOut, colX[1], colX[2], colY[1], colY[2], pal);

  // --- nodes ----------------------------------------------------------------
  const radius = 5;
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < counts[c]; i++) {
      const a = acts[c][i] ?? 0;
      const mag = Math.min(1, Math.abs(a));
      ctx.beginPath();
      ctx.arc(colX[c], colY[c][i], radius, 0, Math.PI * 2);
      ctx.fillStyle = pal.accent;
      ctx.globalAlpha = 0.18 + mag * 0.82;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
      ctx.strokeStyle = pal.line;
      ctx.stroke();
    }
  }

  // input labels down the left edge
  ctx.globalAlpha = 1;
  ctx.fillStyle = pal.dim;
  ctx.font = "10px ui-monospace, monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i < net.nIn && i < IN_LABELS.length; i++) {
    ctx.fillText(IN_LABELS[i], colX[0] - radius - 6, colY[0][i]);
  }
  ctx.textAlign = "left";
  ctx.fillText("jump", colX[2] + radius + 6, colY[2][0]);
}

/** Stroke every weight in a layer as an edge between two node columns. */
function drawLayer(
  ctx: CanvasRenderingContext2D,
  w: Float32Array,
  nFrom: number,
  nTo: number,
  xFrom: number,
  xTo: number,
  yFrom: number[],
  yTo: number[],
  pal: Palette,
): void {
  for (let t = 0; t < nTo; t++) {
    for (let f = 0; f < nFrom; f++) {
      const weight = w[t * nFrom + f];
      const mag = Math.min(1, Math.abs(weight) * 0.6);
      ctx.beginPath();
      ctx.moveTo(xFrom, yFrom[f]);
      ctx.lineTo(xTo, yTo[t]);
      ctx.strokeStyle = weight >= 0 ? pal.accent : pal.fg;
      ctx.globalAlpha = 0.05 + mag * 0.45;
      ctx.lineWidth = 0.5 + mag;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}
