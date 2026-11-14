"use strict";
/* Run log: renders data.json. All text from data goes in via textContent (h/s helpers), never innerHTML. */

let D = null, tab = "today", runFilter = "runs", paceMode = "hr";
const $ = (s, r = document) => r.querySelector(s);

/* ---------- tiny DOM helpers ---------- */
function h(tag, a = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(a)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(9)) if (c != null && c !== false) e.append(c);
  return e;
}
const NS = "http://www.w3.org/2000/svg";
function s(tag, a = {}, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(a)) if (v != null) e.setAttribute(k, v);
  for (const c of kids.flat(9)) if (c != null) e.append(c);
  return e;
}

/* ---------- formatting ---------- */
const pd = (str) => { const [y, m, d] = str.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const md = (str) => { const d = pd(str); return `${MON[d.getMonth()]} ${d.getDate()}`; };
const pace = (sec) => sec ? `${Math.floor(Math.round(sec) / 60)}:${String(Math.round(sec) % 60).padStart(2, "0")}` : "-";
const dur = (sec) => {
  sec = Math.round(sec || 0); const hh = Math.floor(sec / 3600), mm = Math.floor(sec % 3600 / 60), ss = sec % 60;
  return hh ? `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${mm}:${String(ss).padStart(2, "0")}`;
};
const n1 = (x) => x == null ? "-" : (Math.round(x * 10) / 10).toFixed(1);
const n0 = (x) => x == null ? "-" : Math.round(x).toLocaleString("en-US");
const label = (t) => (t || "activity").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const RUN = new Set(["running", "trail_running", "treadmill_running", "track_running", "virtual_run"]);
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

/* ---------- tooltip ---------- */
const tip = $("#tip");
function showTip(x, y, rows) {
  tip.replaceChildren(...rows.map((r) => r.nodeType ? r : h("div", {}, r)));
  tip.hidden = false;
  const w = tip.offsetWidth, vw = innerWidth;
  tip.style.left = Math.max(8, Math.min(vw - w - 8, x - w / 2)) + "px";
  tip.style.top = Math.max(8, y - tip.offsetHeight - 14) + "px";
}
const hideTip = () => { tip.hidden = true; };
document.addEventListener("pointerdown", (e) => { if (!e.target.closest(".chart")) hideTip(); });

/* ---------- charts ---------- */
function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

function barChart(o) {
  const host = h("div", { class: "chart" });
  const draw = () => {
    host.replaceChildren();
    const W = host.parentElement ? host.parentElement.clientWidth || 340 : 340, H = o.height || 170;
    const L = 30, R = 6, T = 18, B = 22, n = o.vals.length;
    const max = niceMax(Math.max(...o.vals, o.goal || 0) * 1.05);
    const y = (v) => T + (H - T - B) * (1 - v / max);
    const band = (W - L - R) / n, bw = Math.min(24, band - 4);
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": o.aria });
    [0, max / 2, max].forEach((t) => {
      svg.append(s("line", { x1: L, x2: W - R, y1: y(t), y2: y(t), class: "grid" }),
        s("text", { x: L - 6, y: y(t) + 4, "text-anchor": "end", class: "axis" }, String(Math.round(t))));
    });
    if (o.goal) svg.append(s("line", { x1: L, x2: W - R, y1: y(o.goal), y2: y(o.goal), stroke: css("--ink"), "stroke-width": 1.5, "stroke-dasharray": "4 4" }));
    o.vals.forEach((v, i) => {
      const cx = L + band * i + band / 2, x0 = cx - bw / 2, top = y(v), base = y(0), hgt = base - top, r = Math.min(4, hgt);
      const hi = i === o.hi;
      if (hgt > 0.5) svg.append(s("path", { fill: hi ? css("--orange") : css("--mark"),
        d: `M${x0},${base}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x0 + bw - r}Q${x0 + bw},${top} ${x0 + bw},${top + r}V${base}Z` }));
      if (hi) svg.append(s("text", { x: cx, y: top - 6, "text-anchor": "middle", style: `font:700 13px ${css("--text")};fill:${css("--ink")}` }, o.fmt(v)));
      if (i % o.every === (n - 1) % o.every) svg.append(s("text", { x: cx, y: H - 6, "text-anchor": "middle", class: "axis" }, o.labels[i]));
      const hit = s("rect", { x: L + band * i, y: T, width: band, height: H - T - B, fill: "transparent", tabindex: 0, "aria-label": `${o.labels[i]}: ${o.fmt(v)}` });
      const on = () => { const b = hit.getBoundingClientRect(); showTip(b.left + b.width / 2, b.top + (top - T), [h("b", {}, o.fmt(v)), (o.tipLabels || o.labels)[i]]); };
      hit.addEventListener("pointerdown", on); hit.addEventListener("pointermove", on); hit.addEventListener("focus", on);
      svg.append(hit);
    });
    host.append(svg);
  };
  host._draw = draw;
  return host;
}

function lineChart(o) {
  const host = h("div", { class: "chart" });
  const dfmt = o.dfmt || md, yfmt = o.yfmt || ((t) => String(Math.round(t)));
  const draw = () => {
    host.replaceChildren();
    const W = host.parentElement ? host.parentElement.clientWidth || 340 : 340, H = o.height || 150;
    const mini = !!o.mini, L = mini ? 4 : 40, R = mini ? 10 : 12, T = 12, B = mini ? 8 : 22, n = o.dates.length;
    const all = o.series.flatMap((s_) => s_.vals).filter((v) => v != null).concat(o.band ? o.band.filter((v) => v != null) : []);
    if (!all.length) { host.append(h("p", { class: "small muted" }, "No data yet.")); return; }
    let lo = Math.min(...all), hi = Math.max(...all);
    const pad = (hi - lo || 1) * 0.15; lo = o.zero ? 0 : lo - pad; hi = hi + pad;
    const x = (i) => L + (W - L - R) * (n === 1 ? 0.5 : i / (n - 1));
    const y = (v) => T + (H - T - B) * (o.invert ? (v - lo) / (hi - lo) : 1 - (v - lo) / (hi - lo));
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": o.aria });
    if (!mini) [lo, (lo + hi) / 2, hi].forEach((t) => svg.append(
      s("line", { x1: L, x2: W - R, y1: y(t), y2: y(t), class: "grid" }),
      s("text", { x: L - 6, y: y(t) + 4, "text-anchor": "end", class: "axis" }, yfmt(t))));
    if (o.band && o.band[0] != null && o.band[1] != null)
      svg.append(s("rect", { x: L, width: W - L - R, y: Math.min(y(o.band[0]), y(o.band[1])), height: Math.abs(y(o.band[0]) - y(o.band[1])), fill: css("--orange"), opacity: 0.12 }));
    if (!mini) o.dates.forEach((d, i) => { if (i % o.every === (n - 1) % o.every) svg.append(s("text", { x: x(i), y: H - 6, "text-anchor": "middle", class: "axis" }, dfmt(d))); });
    o.series.forEach((se) => {
      let dpath = "", pen = false;
      se.vals.forEach((v, i) => { if (v == null) { pen = false; return; } dpath += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true; });
      svg.append(s("path", { d: dpath, fill: "none", stroke: se.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
      const li = se.vals.map((v) => v != null).lastIndexOf(true);
      if (li >= 0) svg.append(s("circle", { cx: x(li), cy: y(se.vals[li]), r: 4, fill: se.color, stroke: css("--bg"), "stroke-width": 2 }));
    });
    const cross = s("line", { y1: T, y2: H - B, stroke: css("--muted"), "stroke-width": 1, visibility: "hidden" });
    const dots = o.series.map((se) => s("circle", { r: 4, fill: se.color, stroke: css("--bg"), "stroke-width": 2, visibility: "hidden" }));
    svg.append(cross, ...dots);
    const rect = s("rect", { x: L, y: 0, width: W - L - R, height: H, fill: "transparent", tabindex: 0, "aria-label": o.aria });
    const at = (cx) => {
      const b = svg.getBoundingClientRect(), px = (cx - b.left) * (W / b.width);
      const i = Math.max(0, Math.min(n - 1, Math.round((px - L) / ((W - L - R) / Math.max(1, n - 1)))));
      cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
      o.series.forEach((se, k) => { const v = se.vals[i]; if (v == null) dots[k].setAttribute("visibility", "hidden"); else { dots[k].setAttribute("cx", x(i)); dots[k].setAttribute("cy", y(v)); dots[k].setAttribute("visibility", "visible"); } });
      const rows = [h("div", { class: "small" }, dfmt(o.dates[i]))].concat(o.series.map((se) => {
        const row = h("div", {}, h("i", { style: `background:${se.color}` }), se.vals[i] == null ? `${se.name}: no data` : `${se.name} `);
        if (se.vals[i] != null) row.append(h("b", { style: "display:inline" }, o.fmt(se.vals[i])));
        return row;
      }));
      showTip(b.left + x(i) * (b.width / W), b.top + 10, rows);
    };
    rect.addEventListener("pointerdown", (e) => at(e.clientX));
    rect.addEventListener("pointermove", (e) => { if (e.pressure > 0 || e.pointerType === "mouse") at(e.clientX); });
    rect.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); dots.forEach((d) => d.setAttribute("visibility", "hidden")); });
    svg.append(rect); host.append(svg);
  };
  host._draw = draw;
  return host;
}

const legend = (items) => h("div", { class: "legend" }, items.map(([c, t]) => h("span", {}, h("i", { style: `background:${c}` }), t)));
const table = (head, rows) => h("details", { class: "tbl" }, h("summary", {}, "Show data"),
  h("table", {}, h("tr", {}, head.map((t) => h("th", {}, t))), rows.map((r) => h("tr", {}, r.map((c) => h("td", {}, c))))));

/* ---------- new chart types ---------- */
const hm = (sec) => `${Math.floor(sec / 3600).toLocaleString("en-US")}h ${String(Math.floor(sec % 3600 / 60)).padStart(2, "0")}m`;
const monLabel = (k) => { const [y, m] = k.split("-"); return `${MON[+m - 1]} ${y}`; };
const monShort = (k) => { const [y, m] = k.split("-"); return `${MON[+m - 1]} '${y.slice(2)}`; };

/* Monotone cubic through every point: smooth, and never overshoots between runs. pts = [[x, y]] with x increasing. */
function smooth(pts) {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const dx = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], q = a * a + b * b;
    if (q > 9) { const k = 3 / Math.sqrt(q); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const k = dx[i] / 3;
    d += `C${(pts[i][0] + k).toFixed(1)},${(pts[i][1] + t[i] * k).toFixed(1)} ${(pts[i + 1][0] - k).toFixed(1)},${(pts[i + 1][1] - t[i + 1] * k).toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
  }
  return d;
}

/* One dot per run on a real date axis, joined by a smooth line. Up to two series, each on its own y-axis. */
function timeChart(o) {
  const host = h("div", { class: "chart" });
  const draw = () => {
    host.replaceChildren();
    const W = host.parentElement ? host.parentElement.clientWidth || 340 : 340, H = o.height || 210;
    const L = 46, R = o.right ? 42 : 14, T = 14, B = 24;
    const t0 = pd(o.x0).getTime(), t1 = pd(o.x1).getTime(), span = Math.max(1, t1 - t0);
    const X = (d) => L + (W - L - R) * ((pd(d).getTime() - t0) / span);
    const dom = (axis, side) => {
      if (!axis) return null;
      const v = o.series.filter((se) => se.axis === side).flatMap((se) => se.pts.map((p) => p.v));
      if (!v.length) return null;
      let lo = Math.min(...v), hi = Math.max(...v); const pad = (hi - lo || 1) * 0.18; lo -= pad; hi += pad;
      const sn = axis.snap || 1; lo = Math.floor(lo / sn) * sn; hi = Math.ceil(hi / sn) * sn;
      return { ...axis, lo, hi };
    };
    const A = { l: dom(o.left, "l"), r: dom(o.right, "r") };
    if (!A.l) { host.append(h("p", { class: "small muted" }, o.empty || "No data yet.")); return; }
    const Y = (a, v) => T + (H - T - B) * (a.invert ? (v - a.lo) / (a.hi - a.lo) : 1 - (v - a.lo) / (a.hi - a.lo));
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": o.aria });
    [0, 1, 2].forEach((i) => {
      const v = A.l.lo + (A.l.hi - A.l.lo) * i / 2;
      svg.append(s("line", { x1: L, x2: W - R, y1: Y(A.l, v), y2: Y(A.l, v), class: "grid" }),
        s("text", { x: L - 6, y: Y(A.l, v) + 4, "text-anchor": "end", class: "axis" }, A.l.fmt(v)));
      if (A.r) { const r = A.r.lo + (A.r.hi - A.r.lo) * i / 2; svg.append(s("text", { x: W - R + 6, y: Y(A.r, r) + 4, class: "axis" }, A.r.fmt(r))); }
    });
    [0, 1, 2, 3].forEach((i) => {
      const dt = new Date(t0 + span * i / 3), iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      svg.append(s("text", { x: L + (W - L - R) * i / 3, y: H - 6, "text-anchor": i === 0 ? "start" : i === 3 ? "end" : "middle", class: "axis" }, md(iso)));
    });
    const all = [];
    o.series.forEach((se) => {
      const a = se.axis === "r" ? A.r : A.l; if (!a) return;
      const pts = se.pts.slice().sort((p, q) => pd(p.d) - pd(q.d));
      let prev = -1e9;
      const px = pts.map((p) => { let x = X(p.d); if (x <= prev + 0.8) x = prev + 0.8; prev = x; return [x, Y(a, p.v), p]; });
      if (px.length > 1) svg.append(s("path", { d: smooth(px.map((q) => [q[0], q[1]])), fill: "none", stroke: se.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
      px.forEach(([x, y, p]) => { svg.append(s("circle", { cx: x, cy: y, r: p.r || 4, fill: se.color, stroke: css("--bg"), "stroke-width": 2 })); all.push([x, y, p, se]); });
    });
    const ring = s("circle", { r: 8, fill: "none", stroke: css("--ink"), "stroke-width": 2, visibility: "hidden" });
    svg.append(ring);
    const rect = s("rect", { x: L, y: 0, width: W - L - R, height: H, fill: "transparent", tabindex: 0, "aria-label": o.aria });
    const near = (cx, cy) => {
      const b = svg.getBoundingClientRect(), k = W / b.width, px = (cx - b.left) * k, py = (cy - b.top) * k;
      let best = null, bd = 1e9; for (const q of all) { const d = (q[0] - px) ** 2 + ((q[1] - py) * 0.5) ** 2; if (d < bd) { bd = d; best = q; } }
      if (!best) return;
      ring.setAttribute("cx", best[0]); ring.setAttribute("cy", best[1]); ring.setAttribute("visibility", "visible");
      showTip(b.left + best[0] / k, b.top + best[1] / k, best[2].tip.map((t, i) => i === 0 ? h("b", {}, t) : t));
    };
    rect.addEventListener("pointerdown", (e) => near(e.clientX, e.clientY));
    rect.addEventListener("pointermove", (e) => { if (e.pressure > 0 || e.pointerType === "mouse") near(e.clientX, e.clientY); });
    svg.append(rect); host.append(svg);
  };
  host._draw = draw;
  return host;
}

/* Bell curve for a predicted time, with the 80% window shaded. */
function bell(o) {
  const host = h("div", { class: "chart" });
  const draw = () => {
    host.replaceChildren();
    const W = host.parentElement ? host.parentElement.clientWidth || 340 : 340, H = 200, L = 16, R = 16, T = 22, B = 50;
    const a = o.mu - 3.4 * o.sigma, b = o.mu + 3.4 * o.sigma, base = H - B;
    const X = (v) => L + (W - L - R) * ((v - a) / (b - a));
    const Yv = (v) => T + (base - T) * (1 - Math.exp(-0.5 * ((v - o.mu) / o.sigma) ** 2));
    const curve = (from, to) => { const N = 70, p = []; for (let i = 0; i <= N; i++) { const v = from + (to - from) * i / N; p.push(`${X(v).toFixed(1)},${Yv(v).toFixed(1)}`); } return p; };
    const area = (from, to) => `M${X(from).toFixed(1)},${base}L${curve(from, to).join("L")}L${X(to).toFixed(1)},${base}Z`;
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": o.aria });
    svg.append(s("path", { d: area(a, b), fill: css("--orange"), opacity: 0.14 }),
      s("path", { d: area(o.lo, o.hi), fill: css("--orange"), opacity: 0.55 }),
      s("path", { d: `M${curve(a, b).join("L")}`, fill: "none", stroke: css("--orange"), "stroke-width": 2, "stroke-linejoin": "round" }),
      s("line", { x1: L, x2: W - R, y1: base, y2: base, class: "grid" }),
      s("line", { x1: X(o.mu), x2: X(o.mu), y1: Yv(o.mu), y2: base, stroke: css("--ink"), "stroke-width": 2 }));
    [[o.lo, "middle"], [o.hi, "middle"]].forEach(([v, an]) => svg.append(
      s("line", { x1: X(v), x2: X(v), y1: Yv(v), y2: base + 5, stroke: css("--ink"), "stroke-width": 1 }),
      s("text", { x: X(v), y: base + 19, "text-anchor": an, class: "axis", style: "font-size:13px;font-weight:600" }, o.fmt(v))));
    svg.append(s("text", { x: X(o.mu), y: base + 40, "text-anchor": "middle", style: `font:700 15px ${css("--text")};fill:${css("--ink")}` }, `Most likely ${o.fmt(o.mu)}`));
    if (o.goal && o.goal > a && o.goal < b) svg.append(
      s("line", { x1: X(o.goal), x2: X(o.goal), y1: T - 6, y2: base, stroke: css("--ink"), "stroke-width": 1.5, "stroke-dasharray": "4 4" }),
      s("text", { x: X(o.goal), y: T - 9, "text-anchor": "middle", class: "axis", style: "font-weight:700" }, `Goal ${o.fmt(o.goal)}`));
    host.append(svg);
  };
  host._draw = draw;
  return host;
}

const chips = (items, cur, on) => h("div", { class: "seg", role: "group" }, items.map(([k, t]) => h("button", { "aria-pressed": String(cur === k), onclick: () => on(k) }, t)));

/* Year / month totals. Tap a row for the extras. */
let perMode = "year", showAllMonths = false, trendView = "volume";
function periodTable() {
  const P = D.periods, u = D.units, host = h("div"), body = h("div", { class: "ptab" });
  const paint = () => {
    body.replaceChildren();
    let rows = (perMode === "year" ? P.years : P.months).slice().reverse();
    const total = rows.length;
    if (perMode === "month" && !showAllMonths) rows = rows.slice(0, 24);
    body.append(h("div", { class: "r head" }, ["Period", u.dist === "mi" ? "Miles" : "Km", "Runs", "Pace", "Time"].map((t) => h("span", {}, t))));
    rows.forEach((r) => {
      const more = h("div", { class: "more", hidden: true }, [
        ["Avg HR", r.hr ? `${n0(r.hr)} bpm` : "-"], ["Climb", `${n0(r.elev)} ${u.elev}`], ["Longest run", `${n1(r.longest)} ${u.dist}`],
        ["Avg temp", r.temp != null ? `${n0(r.temp)}°` : "-"], ["Avg run", `${n1(r.dist / r.runs)} ${u.dist}`], ["Runs per week", n1(r.runs / (perMode === "year" ? 52 : 4.35))],
      ].map(([l, v]) => h("div", {}, h("b", {}, v), h("span", {}, l))));
      const btn = h("button", { class: "r", "aria-expanded": "false", onclick: () => { const o = more.hidden; more.hidden = !o; btn.setAttribute("aria-expanded", String(o)); } },
        h("span", { class: "k" }, perMode === "year" ? r.key : monLabel(r.key)), h("span", {}, n0(r.dist)), h("span", {}, String(r.runs)), h("span", {}, pace(r.pace)), h("span", {}, hm(r.dur)));
      body.append(btn, more);
    });
    if (perMode === "month" && total > 24) body.append(h("button", { class: "showall", onclick: () => { showAllMonths = !showAllMonths; paint(); } }, showAllMonths ? "Show fewer" : `Show all ${total} months`));
  };
  const segBox = h("div");
  const drawSeg = () => segBox.replaceChildren(chips([["year", "By year"], ["month", "By month"]], perMode, (k) => { perMode = k; drawSeg(); paint(); }));
  drawSeg();
  host.append(segBox, body);
  paint();
  return host;
}

/* ---------- sections ---------- */
function hero() {
  const c = D.call, r = D.recovery, dt = pd(D.today);
  const vit = [["Sleep", r.sleep_score.latest], ["HRV", r.hrv.latest], ["Ready", r.readiness.latest]];
  return h("header", { class: "hero" },
    h("div", { class: "date" }, `${DOW[dt.getDay()]}, ${MON[dt.getMonth()]} ${dt.getDate()}`),
    h("h1", { class: "d" }, c.headline),
    h("p", { class: "why" }, c.why),
    h("p", { class: "plan" }, h("b", {}, "Today: "), c.today),
    h("div", { class: "vitals" }, vit.map(([l, v]) => h("div", {}, h("span", { class: "num" }, v == null ? "-" : n0(v)), h("span", { class: "l" }, l)))));
}

function notes() {
  const items = [...D.call.watch, ...D.call.info];
  if (!items.length) return null;
  return h("ul", { class: "notes" }, items.map((t) => h("li", {}, t)));
}

function weekBlock() {
  const w = D.this_week, mx = Math.max(...w.days.map((d) => d.dist), 1), u = D.units.dist;
  const letters = ["M", "T", "W", "T", "F", "S", "S"];
  return h("section", { class: "blk" }, h("h2", {}, "This week"),
    h("div", { class: "week-top" }, h("span", { class: "num" }, n1(w.total)), h("span", { class: "unit" }, `of ${w.goal} ${u}`)),
    h("div", { class: "days" }, w.days.map((d, i) => h("div", { class: `day${d.future ? " future" : ""}${d.dist ? "" : " rest"}${d.d === D.today ? " today" : ""}`, title: `${md(d.d)}: ${n1(d.dist)} ${u}` },
      h("i", { style: `height:${d.dist ? Math.max(6, d.dist / mx * 80) : 3}px`, "aria-label": `${n1(d.dist)} ${u}` }), h("span", {}, letters[i])))),
    h("div", { class: "meter", role: "img", "aria-label": `${Math.round(w.total / w.goal * 100)}% of weekly goal` }, h("b", { style: `width:${Math.min(100, w.total / w.goal * 100)}%` })));
}

function lastRun() {
  const r = D.last_run; if (!r) return null; const u = D.units;
  return h("section", { class: "blk" }, h("h2", {}, "Last run"),
    h("div", { class: "card" },
      h("div", { class: "lr-name" }, r.name || "Run"), h("div", { class: "muted small" }, `${DOW[pd(r.start).getDay()]}, ${md(r.start)}`),
      h("div", { class: "stats" }, [
        [n1(r.dist), u.dist, "Distance"], [pace(r.pace), u.pace, "Pace"], [dur(r.dur), "", "Time"],
        [r.hr ? n0(r.hr) : "-", "bpm", "Avg HR"], [r.te ? n1(r.te) : "-", "", "Aerobic effect"], [r.elev != null ? n0(r.elev) : "-", u.elev, "Climb"],
      ].map(([v, un, l]) => h("div", {}, h("span", { class: "num" }, v, un ? h("span", { class: "unit" }, un) : null), h("span", { class: "l" }, l))))));
}

function earlier() {
  const past = D.notes.slice(1, 8); if (!past.length) return null;
  return h("section", { class: "blk" }, h("h2", {}, "Earlier calls"),
    h("div", { style: "margin-top:12px" }, past.map((n) => h("div", { style: "padding:12px 0;border-top:1px solid var(--hair)" },
      h("div", { class: "muted small" }, md(n.d)), h("div", { style: "font-weight:700" }, n.headline.replace(/\.$/, "")), h("div", { class: "small muted" }, n.today)))));
}

function todayTab() {
  return [hero(), notes(), fatigueBlock(false), weekBlock(), paceWindow(), lastRun(), earlier(), footer()];
}

/* runs */
function runsTab() {
  const u = D.units;
  const list = D.recent.filter((a) => runFilter === "all" || RUN.has(a.type));
  const filters = h("div", { class: "filters" }, [["runs", "Runs"], ["all", "All activities"]].map(([k, t]) =>
    h("button", { "aria-pressed": String(runFilter === k), onclick: () => { runFilter = k; render(); } }, t)));
  const rows = list.map((a) => {
    const isRun = RUN.has(a.type), d = pd(a.start);
    const detail = h("div", { class: "detail", hidden: true }, h("div", { class: "stats" }, [
      [dur(a.dur), "Time"], [a.hr ? `${n0(a.hr)} bpm` : "-", "Avg HR"], [a.te ? n1(a.te) : "-", "Aerobic effect"],
      [a.load ? n0(a.load) : "-", "Load"], [a.cad ? `${n0(a.cad)} spm` : "-", "Cadence"], [a.cal ? n0(a.cal) : "-", "Calories"],
    ].map(([v, l]) => h("div", {}, h("span", { class: "num", style: "font-size:26px" }, v), h("span", { class: "l" }, l)))));
    const btn = h("button", { class: "row", "aria-expanded": "false", onclick: () => { const o = detail.hidden; detail.hidden = !o; btn.setAttribute("aria-expanded", String(o)); } },
      h("div", { class: "dt" }, String(d.getDate()), h("small", {}, MON[d.getMonth()])),
      h("div", {}, h("div", { class: "nm" }, a.name || label(a.type)), h("div", { class: "ds" }, isRun ? `${pace(a.pace)}${u.pace}${a.hr ? `, ${n0(a.hr)} bpm` : ""}` : label(a.type))),
      h("div", { class: "rt" }, isRun ? n1(a.dist) : dur(a.dur), h("small", {}, isRun ? u.dist : "")));
    return [btn, detail];
  });
  return [h("h1", { class: "page-title d" }, "Runs"), h("p", { class: "pad sub", style: "margin-top:8px" }, `${n0(D.totals.runs)} runs and ${n0(D.totals.activities)} activities since ${D.totals.since ? md(D.totals.since) + ", " + D.totals.since.slice(0, 4) : "the start"}. Showing the latest ${list.length}.`),
    filters, h("div", { style: "margin-top:8px" }, rows), footer()];
}

/* ---------- pace at heart rate (now with a change-over-time chart) ---------- */
let bandSel = null;
function paceWindow() {
  const P = D.pace_hr, u = D.units;
  const host = h("section", { class: "blk" });
  const body = h("div");
  const paint = () => {
    seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === paceMode)));
    body.replaceChildren();
    if (paceMode === "hr") {
      const have = P.bands.filter((b) => b.pace);
      const fast = Math.min(...have.map((b) => b.pace)), slow = Math.max(...have.map((b) => b.pace));
      P.bands.forEach((b) => {
        if (!b.pace) { body.append(h("div", { class: "hrrow empty" }, h("div", { class: "k" }, b.hr, h("small", {}, "bpm")), h("div", { class: "v" }, `No miles near ${b.hr} bpm yet`))); return; }
        const w = slow === fast ? 70 : 30 + (slow - b.pace) / (slow - fast) * 70;
        let chip = null;
        if (b.delta != null) {
          const a = Math.abs(b.delta);
          chip = a < 2 ? h("span", { class: "chip" }, "same as before")
            : h("span", { class: `chip${b.delta < 0 ? " up" : ""}` }, `${a}s ${b.delta < 0 ? "faster" : "slower"}`);
        }
        body.append(h("div", { class: "hrrow", role: "group", "aria-label": `${b.hr} beats per minute: ${pace(b.pace)} ${u.pace}` },
          h("div", { class: "k" }, b.hr, h("small", {}, "bpm")),
          h("div", { class: "v" }, h("span", { class: "num" }, pace(b.pace)), h("span", { class: "unit", style: "margin:0" }, u.pace), chip),
          h("div", { class: "ladder" }, h("b", { style: `width:${w}%` })),
          h("div", { class: "meta" }, `${b.laps} ${u.dist === "mi" ? "miles" : "km"} logged across ${b.runs} runs`)));
      });
    } else if (!P.at_pace.length) {
      body.append(h("p", { class: "muted" }, "Not enough logged laps yet."));
    } else {
      P.at_pace.forEach((r) => body.append(h("div", { class: "hrrow" },
        h("div", { class: "k" }, pace(r.pace), h("small", {}, u.pace)),
        h("div", { class: "v" }, h("span", { class: "num" }, r.hr), h("span", { class: "unit", style: "margin:0" }, "bpm average")),
        h("div", { class: "meta" }, `${r.laps} laps within 15 sec of this pace`))));
    }
  };
  const seg = h("div", { class: "seg", role: "group", "aria-label": "View" },
    h("button", { "data-m": "hr", onclick: () => { paceMode = "hr"; paint(); } }, "Pace at HR"),
    h("button", { "data-m": "pace", onclick: () => { paceMode = "pace"; paint(); } }, "HR at pace"));
  host.append(h("h2", {}, "Pace at heart rate"),
    h("p", { class: "sub" }, `Last ${P.window_days} days, every lap within ${P.tolerance} bpm. An orange tag means faster than the 90 days before.`),
    h("div", { class: "card" }, seg, body,
      P.from_summaries ? h("p", { class: "foot" }, "Some runs had no lap data, so their whole-run averages were used.") : null));
  paint();

  // change over time: one dot per run, no averaging
  const keys = Object.keys(P.series || {});
  if (keys.length) {
    if (!bandSel || !P.series[bandSel]) bandSel = keys.includes("150") ? "150" : keys[0];
    const over = h("div"), sel = h("div");
    const drawOver = () => {
      sel.replaceChildren(chips(keys.map((k) => [k, `${k} bpm`]), bandSel, (k) => { bandSel = k; drawOver(); }));
      const S = P.series[bandSel], pts = S.points;
      over.replaceChildren();
      if (pts.length < 2) { over.append(h("p", { class: "muted" }, `Not enough runs near ${bandSel} bpm yet.`)); return; }
      const tr = S.trend;
      over.append(h("p", { class: "small", style: "margin-bottom:10px" }, tr
        ? `${Math.abs(tr.per_month)} sec${u.pace} ${tr.per_month < 0 ? "faster" : "slower"} per month${tr.r2 < 0.1 ? ", but the runs are scattered, so it's a weak trend" : ""}.`
        : "Needs 6 or more runs to show a trend."));
      const c = timeChart({ x0: addDays(D.today, -P.window_days), x1: D.today, height: 200, aria: `Pace at ${bandSel} beats per minute, one point per run`,
        left: { fmt: pace, invert: true, snap: 5 },
        series: [{ name: "Pace", color: css("--orange"), axis: "l", pts: pts.map((p) => ({ d: p.d, v: p.pace, r: 3.5 + Math.min(4, p.dist * 1.2),
          tip: [`${pace(p.pace)}${u.pace}`, md(p.d), `${p.laps} laps, ${n1(p.dist)} ${u.dist} near ${bandSel} bpm`] })) }] });
      over.append(c); requestAnimationFrame(() => c._draw());
    };
    host.append(h("h2", { style: "margin-top:36px" }, "Change over time"),
      h("p", { class: "sub" }, "One dot per run, joined by a line. Higher means faster. Bigger dots mean more distance at that heart rate."), sel, over);
    drawOver();
  }
  return host;
}
const addDays = (iso, n) => { const d = pd(iso); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };


/* ---------- v3: rolling miles, efficiency, stability, drift, recovery, fatigue ---------- */
const statRow = (items) => h("div", { class: "stats" }, items.map(([v, un, l]) => h("div", {}, h("span", { class: "num" }, v, un ? h("span", { class: "unit" }, un) : null), h("span", { class: "l" }, l))));
const sgn = (x, d = 1) => x == null ? "-" : `${x > 0 ? "+" : ""}${(Math.round(x * 10 ** d) / 10 ** d).toFixed(d)}`;
const needMore = (title, sub, msg) => h("section", { class: "blk" }, h("h2", {}, title), h("p", { class: "sub" }, sub), h("p", { class: "empty-state" }, msg));
const runDots = (pts, key, o) => timeChart({ x0: addDays(D.today, -180), x1: D.today, height: o.height || 190, aria: o.aria,
  left: { fmt: o.fmt, invert: !!o.invert, snap: o.snap || 1 },
  series: [{ name: o.name, color: css("--orange"), axis: "l", pts: pts.map((p) => ({ d: p.d, v: p[key], tip: [o.tip(p), md(p.d)] })) }] });

function rollingBlock() {
  const R = D.fx.rolling, u = D.units.dist, W = R.weeks;
  if (!W.length) return null;
  const ch = lineChart({ dates: W.map((w) => w.start), every: 5, fmt: (v) => `${n1(v)} ${u}`, aria: `Weekly ${u} and 4-week rolling average`,
    series: [{ name: "Week", color: css("--muted"), vals: W.map((w) => w.dist) }, { name: "4-week average", color: css("--orange"), vals: W.map((w) => w.avg4) }] });
  return h("section", { class: "blk" }, h("h2", {}, "4-week rolling average"),
    h("p", { class: "sub" }, "Each point averages that week and the three before it, so one big or light week doesn't change the picture. Finished weeks only, last 26 weeks."),
    statRow([[n1(R.now), u + "/wk", "Now"], [n1(R.prev), u + "/wk", "4 weeks ago"], [sgn(R.change), u, "Change"]]),
    legend([[css("--muted"), "Each week"], [css("--orange"), "4-week average"]]), ch,
    table(["Week of", u, "4-wk avg"], W.slice().reverse().slice(0, 16).map((w) => [md(w.start), n1(w.dist), n1(w.avg4)])));
}

function effBlocks() {
  const F = D.fx, out = [];
  const E = F.ef;
  if (!E.ready) out.push(needMore("Aerobic efficiency", "How far you travel for every heartbeat, on steady aerobic runs.", `Needs ${E.need}.`));
  else {
    const ch = lineChart({ dates: E.weekly.map((w) => w.start), every: 5, fmt: (v) => n1(v), aria: "Aerobic efficiency index by week",
      series: [{ name: "Efficiency", color: css("--orange"), vals: E.weekly.map((w) => w.idx) }] });
    out.push(h("section", { class: "blk" }, h("h2", {}, "Aerobic efficiency"),
      h("p", { class: "sub" }, "Distance covered per heartbeat on steady runs (3 km or more, under 85% of max heart rate). Scored against your first month here, which is 100. Higher means more speed for the same heart work. Pace and heart rate only; power isn't used."),
      statRow([[n0(E.score), "", "Score now"], [E.change == null ? "-" : `${sgn(E.change)}%`, "", "vs 12 weeks ago"], [n1(E.now_ef), "m/beat", "Last 4 weeks"]]), ch,
      table(["Date", "Index", "Meters per beat"], E.points.slice().reverse().slice(0, 25).map((p) => [md(p.d), n1(p.idx), String(p.ef)]))));
  }
  const S = F.stability;
  if (!S.ready) out.push(needMore("Pace stability", "How evenly you hold pace through a run.", "Needs about 5 runs with mile splits. They build up as you run."));
  else out.push(h("section", { class: "blk" }, h("h2", {}, "Pace stability"),
    h("p", { class: "sub" }, "Each run scored from 0 to 100 by how much your mile pace varies. 100 is metronome steady. The warm-up mile and a short last lap are left out, so intervals and hilly runs score lower on purpose."),
    statRow([[String(S.avg_score), "", "Average score"], [`${S.avg_cv}%`, "", "Typical swing"], [`${n0(S.neg_share)}%`, "", "Negative splits"]]),
    runDots(S.points, "score", { aria: "Pace stability score for each run", fmt: (v) => String(Math.round(v)), name: "Stability", tip: (p) => `Score ${p.score} (swing ${p.cv}%)${p.neg ? ", negative split" : ""}` }),
    table(["Date", "Score", "Swing"], S.points.slice().reverse().slice(0, 25).map((p) => [md(p.d), String(p.score), `${p.cv}%`]))));
  const Dr = F.drift;
  if (!Dr.ready) out.push(needMore("Heart rate drift", "How much your heart rate climbs relative to pace in the second half of a long run.", "Needs about 3 steady runs of 35 minutes or more with mile splits."));
  else out.push(h("section", { class: "blk" }, h("h2", {}, "Heart rate drift"),
    h("p", { class: "sub" }, "On steady runs of 35 minutes or more: how much less distance you cover per heartbeat in the second half than the first. Under 5% is a common sign of a solid aerobic base. Heat and dehydration push it up."),
    statRow([[`${sgn(Dr.median)}%`, "", "Typical drift"], [`${n0(Dr.good_share)}%`, "", "Runs under 5%"], [String(Dr.points.length), "", "Runs counted"]]),
    runDots(Dr.points, "drift", { aria: "Heart rate drift for each long run", fmt: (v) => `${Math.round(v)}%`, name: "Drift", tip: (p) => `${sgn(p.drift)}% drift over ${p.mins} min` }),
    table(["Date", "Drift", "Minutes"], Dr.points.slice().reverse().slice(0, 25).map((p) => [md(p.d), `${sgn(p.drift)}%`, String(p.mins)]))));
  const H_ = F.hrr;
  if (!H_.ready) out.push(needMore("Heart rate recovery", "How many beats per minute your heart rate drops in the minute after hard effort.", "Needs about 4 runs where you stopped or walked after a hard stretch (interval rests or a recorded cooldown). Easy steady runs don't have one to measure."));
  else out.push(h("section", { class: "blk" }, h("h2", {}, "Heart rate recovery"),
    h("p", { class: "sub" }, "Beats per minute your heart rate falls in the 60 seconds after a hard effort ends in a stop or walk. A bigger drop is better. Compare against your own past, since where you stop changes the number."),
    statRow([[n0(H_.avg), "bpm", "Last 90 days"], [H_.prev == null ? "-" : n0(H_.prev), "bpm", "Before that"], [String(H_.points.length), "", "Readings"]]),
    runDots(H_.points, "hrr", { aria: "Heart rate recovery after hard efforts", fmt: (v) => String(Math.round(v)), name: "Recovery", tip: (p) => `${p.hrr} bpm drop from ${p.peak}` }),
    table(["Date", "Drop", "From"], H_.points.slice().reverse().slice(0, 25).map((p) => [md(p.d), `${p.hrr} bpm`, `${p.peak} bpm`]))));
  return out;
}

function fatigueBlock(full) {
  const F = D.fx.fatigue;
  if (!F.ready) return full ? needMore("Fatigue check", "Looks for resting heart rate up, HRV down and efficiency sliding at the same time.", `Needs ${F.need}.`) : null;
  if (!full && F.flags < 2) return null;
  const sig = F.signals.map((x) => h("li", { class: x.flag ? "flag" : "" }, h("b", {}, x.label), h("span", {}, x.text)));
  const ch = full ? lineChart({ dates: F.series.map((p) => p.d), every: 9, fmt: (v) => n0(v), aria: "Fatigue index, last 28 days", zero: true,
    series: [{ name: "Fatigue index", color: css("--orange"), vals: F.series.map((p) => p.idx) }] }) : null;
  return h("section", { class: "blk" }, h("h2", {}, "Fatigue check"),
    h("div", { class: "card" }, h("div", { class: "lr-name" }, F.level),
      h("p", { class: "small muted", style: "margin:2px 0 10px" }, F.flags ? `${F.flags} of 3 signals are off your normal. Two or more together is what matters; one alone is usually noise.` : "Nothing is off your normal."),
      h("ul", { class: "sigs" }, sig)),
    full ? h("p", { class: "sub", style: "margin-top:14px" }, "Index from 0 to 100 over the last 28 days. It blends 3-day resting heart rate and HRV against your own 30-day norm, plus the trend in aerobic efficiency. Compared with you, not with anyone else.") : null, ch);
}

/* ---------- trends ---------- */
function trendsTab() {
  const u = D.units, W = D.weeks, L = D.load, R = D.recovery;
  const ink = css("--ink"), orange = css("--orange");
  const out = [h("h1", { class: "page-title d" }, "Trends")];
  const G = { volume: [], eff: [], body: [] };

  const wk = barChart({ vals: W.map((w) => w.dist), labels: W.map((w) => md(w.start)), hi: W.length - 1, goal: D.this_week.goal, every: 3,
    fmt: (v) => `${n1(v)} ${u.dist}`, aria: `Weekly ${u.dist} for the last ${W.length} weeks` });
  G.volume.push(h("section", { class: "blk" }, h("h2", {}, "Weekly mileage"), h("p", { class: "sub" }, `Last 12 weeks, Monday to Sunday. Orange is this week so far. The dashed line is your ${D.this_week.goal} ${u.dist} goal.`),
    wk, table(["Week of", u.dist, "Runs"], W.map((w) => [md(w.start), n1(w.dist), String(w.runs)]).reverse())));

  // 1) pace and heart rate, every run, two axes
  const RS = D.run_series;
  const tipFor = (r) => [`${pace(r.pace)}${u.pace} at ${r.hr} bpm`, md(r.d), `${n1(r.dist)} ${u.dist}` + (r.temp != null ? `, ${r.temp}°` : "")];
  const dual = timeChart({ x0: addDays(D.today, -90), x1: D.today, height: 230, right: true, aria: "Pace and average heart rate for every run in the last 3 months",
    left: { fmt: pace, invert: true, snap: 5 }, right: { fmt: (v) => String(Math.round(v)), snap: 2 },
    series: [{ name: "Pace", color: orange, axis: "l", pts: RS.map((r) => ({ d: r.d, v: r.pace, tip: tipFor(r) })) },
             { name: "Heart rate", color: ink, axis: "r", pts: RS.map((r) => ({ d: r.d, v: r.hr, tip: tipFor(r) })) }] });
  G.eff.push(h("section", { class: "blk" }, h("h2", {}, "Pace and heart rate"),
    h("p", { class: "sub" }, `Every run from the last 3 months. Pace uses the left axis (higher is faster). Heart rate uses the right axis. The two scales are independent, so read each line against its own axis. When the lines drift apart, you're getting faster for the same effort.`),
    legend([[orange, `Pace, left axis (${u.pace})`], [ink, "Heart rate, right axis (bpm)"]]), dual,
    table(["Date", "Pace", "HR", u.dist], RS.slice().reverse().slice(0, 30).map((r) => [md(r.d), pace(r.pace), String(r.hr), n1(r.dist)]))));

  // 2) climb per week
  const C = D.climb, tot = C.reduce((a, c) => a + (c.elev || 0), 0);
  G.volume.push(h("section", { class: "blk" }, h("h2", {}, "Climbing"), h("p", { class: "sub" }, `${n0(tot)} ${u.elev} climbed in the last 13 weeks. Elevation gain per week, runs only.`),
    barChart({ vals: C.map((c) => c.elev || 0), labels: C.map((c) => md(c.start)), hi: C.length - 1, every: 3, fmt: (v) => `${n0(v)} ${u.elev}`, aria: `${u.elev} climbed per week, last 13 weeks` }),
    table(["Week of", `Climb (${u.elev})`, "Runs"], C.map((c) => [md(c.start), n0(c.elev), String(c.runs)]).reverse())));

  const last = L[L.length - 1];
  const ld = lineChart({ dates: L.map((p) => p.d), every: 14, fmt: (v) => n0(v), aria: "Training load, last 8 weeks",
    series: [{ name: "This week", color: orange, vals: L.map((p) => p.acute) }, { name: "4-week average", color: ink, vals: L.map((p) => p.chronic) }] });
  G.volume.push(h("section", { class: "blk" }, h("h2", {}, "Training load"),
    h("p", { class: "sub" }, last.acwr ? `This week is ${last.acwr}x your 4-week average. Staying between 0.8 and 1.3 is the steady zone.` : "Not enough history yet."),
    legend([[orange, "This week"], [ink, "4-week average"]]), ld,
    table(["Date", "This week", "4-wk avg", "Ratio"], L.slice(-14).map((p) => [md(p.d), n0(p.acute), n0(p.chronic), p.acwr ?? "-"]).reverse())));

  const card = (title, key, unit, band) => {
    const r = R[key], dates = r.series.map((p) => p.d);
    return h("div", { class: "vcard" },
      h("div", { class: "top" }, h("span", { class: "l" }, title), h("span", { class: "small muted" }, r.base != null ? `4-week norm ${n0(r.base)}` : "")),
      h("div", {}, h("span", { class: "num" }, r.latest == null ? "-" : n0(r.latest)), h("span", { class: "unit" }, unit)),
      lineChart({ mini: true, height: 64, dates, every: 99, band, fmt: (v) => `${n0(v)} ${unit}`.trim(), aria: `${title}, last 14 days`,
        series: [{ name: title, color: orange, vals: r.series.map((p) => p.v) }] }));
  };
  G.body.push(h("section", { class: "blk" }, h("h2", {}, "Recovery"), h("p", { class: "sub" }, "Last 14 days. Tap a line to read a day."),
    h("div", { class: "vcards" }, card("Sleep score", "sleep_score", "", null), card("HRV, overnight", "hrv", "ms", R.hrv_band), card("Resting heart rate", "rhr", "bpm", null))));

  if (R.vo2.length > 3) G.body.push(h("section", { class: "blk" }, h("h2", {}, "VO2 max"), h("p", { class: "sub" }, "Garmin's estimate, last 4 months."),
    lineChart({ dates: R.vo2.map((p) => p.d), every: 40, fmt: (v) => n1(v), aria: "VO2 max, last 4 months", series: [{ name: "VO2 max", color: orange, vals: R.vo2.map((p) => p.v) }] })));

  // 8) weather
  const Wx = D.weather;
  if (Wx && Wx.months.length > 1) {
    const sym = `°${Wx.unit}`;
    const wl = lineChart({ dates: Wx.months.map((m) => m.m), every: 4, dfmt: monShort, fmt: (v) => `${Math.round(v)}${sym}`, yfmt: (t) => `${Math.round(t)}°`, aria: "Average temperature of your runs, by month",
      series: [{ name: "Run temperature", color: orange, vals: Wx.months.map((m) => m.temp) }] });
    const rows = Wx.buckets.map((b) => h("tr", {}, h("td", {}, `${b.label}${sym}`), h("td", {}, b.pace ? pace(b.pace) : "-"), h("td", {}, b.hr ? String(b.hr) : "-"), h("td", {}, String(b.runs))));
    G.eff.push(h("section", { class: "blk" }, h("h2", {}, "Weather"), h("p", { class: "sub" }, "Average air temperature during your runs, by month. Looked up for your home area, so runs while traveling are approximate."),
      wl, h("p", { class: "small", style: "margin:18px 0 8px;font-weight:600" }, `How heat changes your pace, last 12 months`),
      h("p", { class: "small muted", style: "margin-bottom:8px" }, Wx.adjusted ? `Pace is restated to ${Wx.ref_hr} bpm for every run, so easy days and hard days compare fairly.` : "Raw average pace; not enough heart rate data to adjust."),
      h("table", { class: "tbl2" }, h("tr", {}, ["Temperature", `Pace at ${Wx.ref_hr} bpm`, "Avg HR", "Runs"].map((t) => h("td", { class: "small muted" }, t))), rows)));
  } else {
    G.eff.push(h("section", { class: "blk" }, h("h2", {}, "Weather"), h("p", { class: "empty-state" }, "Temperature fills in after the next sync. It's looked up for each run from your home area.")));
  }
  G.volume.unshift(rollingBlock());
  G.eff.unshift(...effBlocks());
  G.body.unshift(fatigueBlock(true));
  out.push(h("div", { style: "margin:4px 0 6px" }, chips([["volume", "Volume"], ["eff", "Efficiency"], ["body", "Body"]], trendView, (k) => { trendView = k; render(); })));
  out.push(...G[trendView].filter(Boolean));
  out.push(footer());
  return out;
}

/* ---------- all time ---------- */
function allTab() {
  const u = D.units, T = D.totals, P = D.periods, Rc = D.records, out = [h("h1", { class: "page-title d" }, "All time")];
  const sum = (k) => P.years.reduce((a, y) => a + (y[k] || 0), 0);
  const totDur = sum("dur"), totDist = sum("dist"), totElev = sum("elev");
  const avgPace = totDist ? totDur / totDist : null;
  out.push(h("section", { class: "blk" }, h("p", { class: "sub", style: "margin-bottom:0" }, `Every run Garmin has recorded${T.since ? ", since " + md(T.since) + ", " + T.since.slice(0, 4) : ""}.`),
    h("div", { class: "stats big" }, [
      [n0(totDist), u.dist, "Total distance"], [n0(T.runs), "", "Runs"], [n0(totDur / 3600), "hrs", "Time running"],
      [pace(avgPace), u.pace, "Average pace"], [n0(totElev), u.elev, "Climbed"], [n1(totDist / Math.max(1, T.runs)), u.dist, "Average run"],
    ].map(([v, un, l]) => h("div", {}, h("span", { class: "num" }, v, un ? h("span", { class: "unit" }, un) : null), h("span", { class: "l" }, l))))));

  const recs = [];
  if (Rc.longest) recs.push([`${n1(Rc.longest.v)} ${u.dist}`, "Longest run", md(Rc.longest.d) + ", " + Rc.longest.d.slice(0, 4)]);
  if (Rc.fastest) recs.push([`${pace(Rc.fastest.pace)}${u.pace}`, `Fastest run over 5K`, `${n1(Rc.fastest.dist)} ${u.dist}, ${md(Rc.fastest.d)} ${Rc.fastest.d.slice(0, 4)}`]);
  if (Rc.week) recs.push([`${n1(Rc.week.v)} ${u.dist}`, "Biggest week", `Week of ${md(Rc.week.d)} ${Rc.week.d.slice(0, 4)}`]);
  if (Rc.month) recs.push([`${n0(Rc.month.v)} ${u.dist}`, "Biggest month", monLabel(Rc.month.d)]);
  if (Rc.climb) recs.push([`${n0(Rc.climb.v)} ${u.elev}`, "Most climbing in a run", md(Rc.climb.d) + ", " + Rc.climb.d.slice(0, 4)]);
  if (recs.length) out.push(h("section", { class: "blk" }, h("h2", {}, "Records"),
    h("div", { class: "recs" }, recs.map(([v, l, w]) => h("div", { class: "card" }, h("span", { class: "num" }, v), h("span", { class: "l" }, l), h("span", { class: "small muted" }, w))))));

  const Y = P.years;
  out.push(h("section", { class: "blk" }, h("h2", {}, `${u.dist === "mi" ? "Miles" : "Kilometers"} per year`),
    barChart({ vals: Y.map((y) => y.dist), labels: Y.map((y) => y.key), hi: Y.length - 1, every: Math.ceil(Y.length / 6), fmt: (v) => `${n0(v)} ${u.dist}`, aria: `Running ${u.dist} per year` })));

  const M = P.months;
  if (M.length > 2) {
    out.push(h("section", { class: "blk" }, h("h2", {}, "Every month"), h("p", { class: "sub" }, `${u.dist === "mi" ? "Miles" : "Kilometers"} run each month, ${M.length} months. Tap a bar for the month.`),
      barChart({ vals: M.map((m) => m.dist), labels: M.map((m) => monShort(m.key)), hi: M.length - 1, every: Math.max(1, Math.ceil(M.length / 6)), fmt: (v) => `${n0(v)} ${u.dist}`, aria: "Monthly distance", tipLabels: M.map((m) => monLabel(m.key)) })));
    const pm = M.filter((m) => m.pace);
    out.push(h("section", { class: "blk" }, h("h2", {}, "Average pace by month"), h("p", { class: "sub" }, "Higher on the chart means faster. Each point is one month of running."),
      lineChart({ dates: pm.map((m) => m.key), every: Math.max(1, Math.ceil(pm.length / 5)), dfmt: monShort, fmt: (v) => `${pace(v)}${u.pace}`, yfmt: pace, invert: true,
        aria: "Average pace for each month", series: [{ name: "Pace", color: css("--orange"), vals: pm.map((m) => m.pace) }] })));
  }
  out.push(h("section", { class: "blk" }, h("h2", {}, "Totals"), h("p", { class: "sub" }, "Tap a row for heart rate, climbing, longest run and temperature."), periodTable()));
  out.push(footer());
  return out;
}

/* ---------- race ---------- */
let winSel = null;
function raceTab() {
  const r = D.race, u = D.units, out = [h("h1", { class: "page-title d" }, "Race")];
  if (!r) {
    out.push(h("section", { class: "blk" }, h("p", { class: "empty-state" }, "No race set. Add your race date in "), h("p", { class: "empty-state" }, h("code", {}, "config.json"), " under ", h("code", {}, "race"), ", or set a primary event in Garmin Connect, and this page fills in.")));
  } else {
    const phases = ["Base", "Build", "Peak", "Taper"], cur = r.phase === "Race week" ? "Taper" : r.phase;
    out.push(h("section", { class: "blk" }, h("p", { class: "lr-name" }, r.name), h("p", { class: "muted small" }, `${DOW[pd(r.date).getDay()]}, ${md(r.date)}, ${n1(r.distance)} ${u.dist}`),
      h("div", { style: "margin-top:14px" }, h("span", { class: "num count" }, String(r.days)), h("span", { class: "unit", style: "font-size:20px" }, r.days === 1 ? "day to go" : "days to go")),
      h("div", { class: "phases", role: "img", "aria-label": `Current phase: ${r.phase}` }, phases.map((p) => h("div", { class: p === cur ? "on" : "" }, h("i"), h("span", {}, p))))));
    if (r.goal) out.push(h("section", { class: "blk" }, h("h2", {}, "Goal"),
      h("div", { class: "card" }, h("div", {}, h("span", { class: "num", style: "font-size:56px" }, r.goal_text), h("span", { class: "unit" }, `${pace(r.goal_pace)}${u.pace}`)),
        r.pred ? h("p", { class: "small", style: "margin-top:10px" }, `Garmin predicts ${r.pred_text} today. ` + (r.gap > 0 ? `That's ${dur(r.gap)} slower than your goal.` : r.gap < 0 ? `That's ${dur(-r.gap)} faster than your goal.` : "Right on goal.")) : null)));
  }

  // 6) race window
  const Wd = (D.window && D.window.distances || []).filter((x) => x.mu);
  if (Wd.length) {
    const names = Wd.map((x) => x.name);
    if (!winSel || !names.includes(winSel)) winSel = r ? Wd.reduce((b, x) => Math.abs(x.km - r.distance * (u.dist === "mi" ? 1.609344 : 1)) < Math.abs(b.km - r.distance * (u.dist === "mi" ? 1.609344 : 1)) ? x : b).name : names[Math.min(2, names.length - 1)];
    const body = h("div"), selBox = h("div");
    const draw = () => {
      selBox.replaceChildren(chips(names.map((n) => [n, n.replace(" marathon", "")]), winSel, (k) => { winSel = k; draw(); }));
      const x = Wd.find((z) => z.name === winSel);
      body.replaceChildren();
      const c = bell({ mu: x.mu, sigma: x.sigma, lo: x.lo, hi: x.hi, fmt: dur, goal: x.p_goal != null && r ? r.goal : null, aria: `${x.name} prediction: most likely ${dur(x.mu)}, 80 percent window ${dur(x.lo)} to ${dur(x.hi)}` });
      body.append(h("div", { class: "card" },
        h("div", { class: "win" }, h("span", { class: "num" }, dur(x.lo), h("small", {}, " to "), dur(x.hi)), h("span", { class: `chip${x.conf === "High" ? " up" : ""}` }, `${x.conf} confidence`)),
        h("p", { class: "small muted", style: "margin:6px 0 4px" }, `About 8 in 10 outcomes land inside this window. The middle of the curve is the most likely time.`),
        c,
        x.p_goal != null && r && r.goal ? h("p", { style: "margin-top:6px;font-weight:600" }, `Chance of beating your ${r.goal_text} goal: about ${Math.round(x.p_goal * 100)}%.`) : null,
        ...x.notes.map((n) => h("p", { class: "small muted", style: "margin-top:8px" }, n)),
        h("details", { class: "tbl" }, h("summary", {}, "Where this comes from"),
          h("table", {}, x.sources.map((s_) => h("tr", {}, h("td", {}, s_.name), h("td", {}, dur(s_.time)))))),
        h("p", { class: "small muted", style: "margin-top:6px" }, `Blends these sources, then widens the window for how much they disagree and for training that is short of the distance. It assumes a typical share of your max heart rate for each distance${D.window.max_hr ? ` (max ${D.window.max_hr} bpm)` : ""}, so treat it as a guide.`)));
      requestAnimationFrame(() => body.querySelectorAll(".chart").forEach((q) => q._draw && q._draw()));
    };
    out.push(h("section", { class: "blk" }, h("h2", {}, "Race window"), h("p", { class: "sub" }, "A range, not a single number, built from your recent runs, paces and heart rates."), selBox, body));
    draw();
  }

  // 7) critical speed
  const cs = D.cs;
  if (cs) out.push(h("section", { class: "blk" }, h("h2", {}, "Critical speed"),
    h("p", { class: "sub" }, "The fastest pace you can hold for about 30 to 60 minutes. It sits close to your lactate threshold."),
    h("div", { class: "card" },
      h("div", { class: "win" }, h("span", { class: "num" }, pace(cs.pace), h("small", {}, u.pace)), h("span", { class: `chip${cs.conf === "High" ? " up" : ""}` }, `${cs.conf} confidence`)),
      h("p", { class: "small muted", style: "margin:6px 0 14px" }, `Likely range ${pace(cs.pace_fast)} to ${pace(cs.pace_slow)}${u.pace}.`),
      h("div", { class: "stats" }, [[String(cs.hr), "bpm", "Heart rate at threshold"], [cs.garmin_lthr ? String(cs.garmin_lthr) : "-", cs.garmin_lthr ? "bpm" : "", "Garmin's threshold HR"], [String(cs.points), "", "Efforts used"]]
        .map(([v, un, l]) => h("div", {}, h("span", { class: "num" }, v, un ? h("span", { class: "unit" }, un) : null), h("span", { class: "l" }, l)))),
      ...cs.notes.map((n) => h("p", { class: "small muted", style: "margin-top:12px" }, n)),
      h("p", { class: "small muted", style: "margin-top:10px" }, "Estimated from the best sustained stretches in your last 6 months of runs, not from a lab test."))));

  const P = D.predictions, names2 = [["p5k", "5K", 5], ["p10k", "10K", 10], ["phalf", "Half marathon", 21.0975], ["pmar", "Marathon", 42.195]];
  const rows = names2.filter(([k]) => P[k]).map(([k, n, km]) => h("tr", {}, h("td", {}, n), h("td", {}, h("span", { class: "num" }, dur(P[k])), h("span", { class: "unit" }, `${pace(P[k] / (km * 1000 / (u.dist === "mi" ? 1609.344 : 1000)))}${u.pace}`))));
  out.push(h("section", { class: "blk" }, h("h2", {}, "Garmin predictions"), h("p", { class: "sub" }, "Garmin's own single-number estimates. These move as your training does."),
    rows.length ? h("table", { class: "tbl2" }, rows) : h("p", { class: "muted" }, "No predictions yet.")), footer());
  return out;
}

function footer() {
  const t = D.last_sync ? new Date(D.last_sync).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }) : "unknown";
  return h("p", { class: "pad small muted", style: "margin-top:40px" }, `Updated ${t}. ${n0(D.totals.activities)} activities stored.`);
}

/* ---------- shell ---------- */
function render() {
  const app = $("#app");
  const view = { today: todayTab, trends: trendsTab, runs: runsTab, all: allTab, race: raceTab }[tab]();
  app.replaceChildren(...view.flat().filter(Boolean));
  document.querySelectorAll("#tabs button").forEach((b) => b.toggleAttribute("aria-current", b.dataset.tab === tab) || (b.removeAttribute("aria-current")));
  document.querySelectorAll("#tabs button").forEach((b) => { if (b.dataset.tab === tab) b.setAttribute("aria-current", "page"); });
  requestAnimationFrame(() => app.querySelectorAll(".chart").forEach((c) => c._draw && c._draw()));
  hideTip();
}
document.querySelectorAll("#tabs button").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; render(); scrollTo(0, 0); }));
let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => document.querySelectorAll(".chart").forEach((c) => c._draw && c._draw()), 120); });

/* ---------- load + optional decrypt ---------- */
const b64 = (x) => Uint8Array.from(atob(x), (c) => c.charCodeAt(0));
async function decrypt(box, pass) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(box.salt), iterations: box.iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(box.iv) }, key, b64(box.ct))));
}
function start(data) { D = data; $("#lock").hidden = true; $("#tabs").hidden = false; render(); }
async function boot() {
  let box;
  try { box = await (await fetch("data.json", { cache: "no-cache" })).json(); }
  catch { $("#app").replaceChildren(h("p", { class: "pad", style: "padding-top:80px" }, "Couldn't load data.json. Check that the daily run has finished and reload.")); return; }
  if (!box.enc) return start(box);
  const tryPass = async (p) => { try { start(await decrypt(box, p)); try { localStorage.setItem("rl", p); } catch {} return true; } catch { return false; } };
  let saved = null; try { saved = localStorage.getItem("rl"); } catch {}
  if (saved && await tryPass(saved)) return;
  $("#lock").hidden = false;
  $("#lock-form").addEventListener("submit", async (e) => { e.preventDefault(); $("#lock-err").textContent = (await tryPass($("#pass").value)) ? "" : "That passphrase didn't work."; });
}
boot();
