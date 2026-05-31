// ---------------------------------------------------------------------------
// Neuro-Runner — canvas renderer. Pure drawing: reads world state + a palette
// and paints. Minimal geometric style — thin strokes, a faint swarm, the
// current leader highlighted.
// ---------------------------------------------------------------------------

import type { Agent, Palette, World } from "./types";

const AGENT_W = 9;
const AGENT_H = 13;

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
