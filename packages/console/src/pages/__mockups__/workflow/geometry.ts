import { END_H, NODE_H, NODE_W, PORT_DIR } from './constants';
import type { Port, Pt } from './types';

export const ROUTE_STUB = 26; // straight segment leaving a port before the first bend
export const CORNER_RADIUS = 10;

export function portPos(p: Pt, port: Port, w = NODE_W, h = NODE_H): Pt {
  switch (port) {
    case 'top': return { x: p.x + w / 2, y: p.y };
    case 'right': return { x: p.x + w, y: p.y + h / 2 };
    case 'bottom': return { x: p.x + w / 2, y: p.y + h };
    case 'left': return { x: p.x, y: p.y + h / 2 };
  }
}

/** Orthogonal (Manhattan) route points between two ports. */
export function orthogonalPoints(
  a: Pt, b: Pt,
  fromPort: Port, toPort: Port,
  aW = NODE_W, aH = NODE_H, bW = NODE_W, bH = NODE_H,
): Pt[] {
  const s = portPos(a, fromPort, aW, aH);
  const e = portPos(b, toPort, bW, bH);
  const ds = PORT_DIR[fromPort];
  const de = PORT_DIR[toPort];
  const s1 = { x: s.x + ds.x * ROUTE_STUB, y: s.y + ds.y * ROUTE_STUB };
  const e1 = { x: e.x + de.x * ROUTE_STUB, y: e.y + de.y * ROUTE_STUB };
  const sH = ds.x !== 0; // start exits horizontally
  const eH = de.x !== 0; // end enters horizontally
  let pts: Pt[];
  if (sH && eH) {
    if (Math.abs(s1.y - e1.y) < 30) {
      pts = [s, s1, e1, e];
    } else {
      const midY = (s1.y + e1.y) / 2;
      pts = [s, s1, { x: s1.x, y: midY }, { x: e1.x, y: midY }, e1, e];
    }
  } else if (!sH && !eH) {
    if (Math.abs(s1.x - e1.x) < 30) {
      pts = [s, s1, e1, e];
    } else {
      const midX = (s1.x + e1.x) / 2;
      pts = [s, s1, { x: midX, y: s1.y }, { x: midX, y: e1.y }, e1, e];
    }
  } else if (sH) {
    pts = [s, s1, { x: e1.x, y: s1.y }, e1, e];
  } else {
    pts = [s, s1, { x: s1.x, y: e1.y }, e1, e];
  }
  // Remove duplicate consecutive points
  const out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) out.push(p);
  }
  return out;
}

/** SVG path with rounded corners from an orthogonal polyline. */
export function roundedOrthogonalPath(pts: Pt[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    const lenIn = Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
    const lenOut = Math.abs(next.x - cur.x) + Math.abs(next.y - cur.y);
    const r = Math.max(0, Math.min(CORNER_RADIUS, lenIn / 2, lenOut / 2));
    if (r === 0) { d += ` L ${cur.x} ${cur.y}`; continue; }
    const dx1 = Math.sign(cur.x - prev.x) || 0;
    const dy1 = Math.sign(cur.y - prev.y) || 0;
    const dx2 = Math.sign(next.x - cur.x) || 0;
    const dy2 = Math.sign(next.y - cur.y) || 0;
    const c1 = { x: cur.x - dx1 * r, y: cur.y - dy1 * r };
    const c2 = { x: cur.x + dx2 * r, y: cur.y + dy2 * r };
    d += ` L ${c1.x} ${c1.y}`;
    d += ` Q ${cur.x} ${cur.y}, ${c2.x} ${c2.y}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export function edgePath(
  a: Pt, b: Pt,
  fromPort: Port = 'bottom', toPort: Port = 'top',
  aW = NODE_W, aH = NODE_H, bW = NODE_W, bH = NODE_H,
): string {
  return roundedOrthogonalPath(orthogonalPoints(a, b, fromPort, toPort, aW, aH, bW, bH));
}

export function edgeMidpoint(
  a: Pt, b: Pt,
  fromPort: Port = 'bottom', toPort: Port = 'top',
  aW = NODE_W, aH = NODE_H, bW = NODE_W, bH = NODE_H,
): Pt {
  const pts = orthogonalPoints(a, b, fromPort, toPort, aW, aH, bW, bH);
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    total += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  }
  let target = total / 2;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    if (target <= len || i === pts.length - 2) {
      const t = len === 0 ? 0 : target / len;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t };
    }
    target -= len;
  }
  return pts[pts.length - 1];
}

/** Pick sensible default ports based on relative position. */
export function defaultPorts(a: Pt, b: Pt): { fromPort: Port; toPort: Port } {
  if (b.y > a.y + 40) return { fromPort: 'bottom', toPort: 'top' };
  if (b.y < a.y - 40) return { fromPort: 'top', toPort: 'bottom' };
  if (b.x >= a.x) return { fromPort: 'right', toPort: 'left' };
  return { fromPort: 'left', toPort: 'right' };
}

export function endPortPos(p: Pt, port: Port): Pt {
  return portPos(p, port, NODE_W, END_H);
}
