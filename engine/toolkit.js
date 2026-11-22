/* Study OS game toolkit: the stage, light, particles, dragging, levels and celebration every game shares. */
(function () {
  var cv = document.createElement('canvas'), c = cv.getContext('2d'), G = (window.G = {});
  document.documentElement.style.cssText = 'height:100%';
  document.body.style.cssText = 'margin:0;height:100%;overflow:hidden;background:#faf8f3;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab';
  document.body.appendChild(cv);
  var INK = '#121212', P = [], motes = [], bodies = {}, shake = 0, toast = null, goal = '', goalAt = 0, gauge = null, hint = null, done = false, changing = false, flash = 0, again = null, zoom = 1;
  G.c = c; G.t = 0; G.level = 1; G.W = 900; G.H = 560; G.colors = { blue: '#2f3cdc', yellow: '#ffc93c', pink: '#f39ac3', sky: '#8f9cff', orange: '#f26b2e', green: '#1a7748', ink: INK, paper: '#faf8f3' };
  G.ease = function (p) { p = p < 0 ? 0 : p > 1 ? 1 : p; return 1 - Math.pow(1 - p, 3); };
  G.lerp = function (a, b, p) { return a + (b - a) * p; };
  G.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  G.rand = function (a, b) { return a + Math.random() * (b - a); };
  G.dist = function (x, y, a, b) { return Math.hypot(x - a, y - b); };
  var ptr = (G.pointer = { x: 450, y: 280, down: false, vx: 0, vy: 0, dx: 0, dy: 0 });
  // Everything is drawn in a 900 x 560 world (or 560 x 800 on a tall screen) that fills the window.
  function fit() {
    var d = Math.min(2, window.devicePixelRatio || 1), w = window.innerWidth || 900, h = window.innerHeight || 560, tall = h > w;
    G.W = tall ? 560 : 900; G.H = tall ? 800 : 560;
    var k = Math.min(w / G.W, h / G.H);
    G.H = h / k; G.W = w / k; G.tall = tall; zoom = k * d;
    cv.width = w * d; cv.height = h * d; cv.style.cssText = 'display:block;width:' + w + 'px;height:' + h + 'px';
  }
  function at(e) { var d = Math.min(2, window.devicePixelRatio || 1); return [e.clientX * d / zoom, e.clientY * d / zoom]; }
  window.addEventListener('resize', fit); fit();
  for (var i = 0; i < 34; i++) motes.push([Math.random(), Math.random(), Math.random()]);
  function move(e) { var a = at(e); ptr.vx = a[0] - ptr.x; ptr.vy = a[1] - ptr.y; ptr.x = a[0]; ptr.y = a[1]; }
  cv.addEventListener('pointerdown', function (e) {
    move(e); ptr.down = true; ptr.vx = ptr.vy = 0; hint = null; document.body.style.cursor = 'grabbing';
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    if (again && G.dist(ptr.x, ptr.y, G.W / 2, G.H / 2 + 120) < 130) { again = null; done = false; G.level = 1; start(); return; }
    var best = null, bd = 1e9;
    for (var k in bodies) { var b = bodies[k]; if (b.seen < G.frame - 2) continue; var q = G.dist(ptr.x, ptr.y, b.x, b.y); if (q < b.r + 22 && q < bd) { bd = q; best = b; } }
    if (best) { best.held = true; best.ox = best.x - ptr.x; best.oy = best.y - ptr.y; best.sq = 0.18; }
  });
  window.addEventListener('pointermove', move);
  function up() { ptr.down = false; document.body.style.cursor = 'grab'; for (var k in bodies) if (bodies[k].held) { bodies[k].held = false; bodies[k].sq = -0.14; bodies[k].dropped = true; } }
  window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);

  /* ---- scene ---- */
  G.room = function (top, bottom, floor) {
    c.fillStyle = top || '#dfe3ff'; c.fillRect(-30, -30, G.W + 60, G.H + 60);
    c.fillStyle = bottom || '#faf8f3'; c.beginPath(); c.moveTo(-30, G.H * 0.62); for (var bx = 0; bx <= 12; bx++) c.lineTo(bx / 12 * (G.W + 60) - 30, G.H * 0.62 + Math.sin(bx * 1.1 + G.t * 0.25) * 16); c.lineTo(G.W + 30, G.H + 30); c.lineTo(-30, G.H + 30); c.fill();
    for (var i = 0; i < motes.length; i++) { var m = motes[i], x = (m[0] * G.W + Math.sin(G.t * 0.3 + i) * 26 + G.t * 6 * m[2]) % G.W, y = (m[1] * G.H - G.t * (4 + m[2] * 9)) % G.H; if (y < 0) y += G.H; c.globalAlpha = 0.16 + 0.22 * m[2]; c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 1.5 + m[2] * 3, 0, 7); c.fill(); } c.globalAlpha = 1;
    if (floor) { var fy = G.H * 0.84; c.fillStyle = floor; c.fillRect(-30, fy, G.W + 60, G.H); c.fillStyle = INK; c.fillRect(-30, fy - 1.5, G.W + 60, 3); }
  };
  G.night = function (floor) { G.room('#1d2266', '#2b2f86', floor || '#15184a'); };
  G.glow = function (x, y, r, color, a) { var o = c.globalAlpha, k = a == null ? 0.5 : a; c.fillStyle = color; [1, 0.7, 0.42].forEach(function (q, i) { c.globalAlpha = o * k * 0.3; c.beginPath(); c.arc(x, y, r * q * (1 + Math.sin(G.t * 3 + i) * 0.025), 0, 7); c.fill(); }); c.globalAlpha = o; };
  /** A sticker: outline, flat or gradient fill, hard shadow. path(c) draws the shape. */
  G.sticker = function (path, fill, o) {
    o = o || {}; var s = o.shadow == null ? 5 : o.shadow;
    if (s) { c.save(); c.translate(s, s); c.beginPath(); path(c); c.fillStyle = INK; c.fill(); c.restore(); }
    c.beginPath(); path(c); c.fillStyle = fill; c.fill();
    if (o.shine !== false) { c.save(); c.clip(); c.globalAlpha = 0.3; c.fillStyle = '#fff'; c.beginPath(); var b = o.box; if (b) { c.ellipse(b[0] + b[2] * 0.3, b[1] + b[3] * 0.22, b[2] * 0.26, b[3] * 0.13, -0.5, 0, 7); c.fill(); } c.restore(); }
    c.lineWidth = o.line || 3.5; c.lineJoin = 'round'; c.strokeStyle = INK; c.beginPath(); path(c); c.stroke();
  };
  G.box = function (x, y, w, h, r, fill, o) { G.sticker(function (k) { k.roundRect(x, y, w, h, r); }, fill, Object.assign({ box: [x, y, w, h] }, o)); };
  G.ball = function (x, y, r, fill, o) { G.sticker(function (k) { k.arc(x, y, r, 0, Math.PI * 2); }, fill, Object.assign({ box: [x - r, y - r, r * 2, r * 2] }, o)); };
  G.grad = function (x, y, x2, y2, a) { return a; }; // flat on purpose
  G.flame = function (x, y, s, heat) {
    heat = heat == null ? 1 : heat; if (heat <= 0.02) return; var f = Math.sin(G.t * 11) * 0.05 + Math.sin(G.t * 23) * 0.03, h = s * (0.8 + heat * 0.9) * (1 + f);
    G.glow(x, y - h * 0.45, s * (1.6 + heat * 2.4), '#ffb03b', 0.55); G.glow(x, y - h * 0.4, s * 1.2, '#fff3c4', 0.6);
    [[1, '#f26b2e'], [0.68, '#ffc93c'], [0.38, '#fff7d6']].forEach(function (l, i) {
      var k = l[0], w = s * 0.42 * k, lean = Math.sin(G.t * 5 + i) * s * 0.06; c.beginPath(); c.moveTo(x - w, y - h * 0.12 * k); c.bezierCurveTo(x - w * 1.35, y - h * 0.5 * k, x - w * 0.2 + lean, y - h * 0.65 * k, x + lean, y - h * k); c.bezierCurveTo(x + w * 0.35 + lean, y - h * 0.62 * k, x + w * 1.35, y - h * 0.45 * k, x + w, y - h * 0.12 * k); c.quadraticCurveTo(x, y + w * 0.75, x - w, y - h * 0.12 * k); c.fillStyle = l[1]; c.fill(); if (!i) { c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); }
    });
    c.globalAlpha = 0.75; c.fillStyle = '#8f9cff'; c.beginPath(); c.ellipse(x, y - s * 0.04, s * 0.2, s * 0.13, 0, 0, 7); c.fill(); c.globalAlpha = 1;
  };
  G.text = function (s, x, y, size, color, align) { c.font = '800 ' + (size || 20) + 'px "SO Inter",Inter,system-ui,sans-serif'; c.textAlign = align || 'center'; c.textBaseline = 'middle'; c.fillStyle = color || INK; c.fillText(s, x, y); };
  G.label = function (s, x, y, size) { c.font = '700 ' + (size || 17) + 'px Inter,system-ui,sans-serif'; var w = c.measureText(s).width + 22, h = (size || 17) + 14; c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, h / 2); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke(); G.text(s, x, y + 1, size || 17); };

  /* ---- particles: 'spark' 'smoke' 'bubble' 'drop' 'star' 'dot' ---- */
  G.puff = function (x, y, o) {
    o = o || {}; for (var i = 0; i < (o.n || 8); i++) { if (P.length > 420) P.shift(); var a = o.angle == null ? G.rand(0, 6.28) : o.angle + G.rand(-1, 1) * (o.spread == null ? 0.5 : o.spread), v = G.rand(0.35, 1) * (o.speed || 120); P.push({ x: x + G.rand(-1, 1) * (o.around || 0), y: y + G.rand(-1, 1) * (o.around || 0), vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: o.gravity == null ? 0 : o.gravity, r: G.rand(0.6, 1.2) * (o.size || 7), l: 1, d: 1 / (o.life || 0.9), k: o.kind || 'dot', c: Array.isArray(o.color) ? o.color[Math.floor(Math.random() * o.color.length)] : o.color || '#ffc93c', s: G.rand(-4, 4), q: G.rand(0, 6) }); }
  };
  /** Emits steadily: call every frame with a rate per second. */
  G.stream = function (x, y, rate, o) { if (Math.random() < rate / 60) G.puff(x, y, Object.assign({ n: 1 }, o)); };
  function parts(dt) {
    for (var i = P.length - 1; i >= 0; i--) {
      var p = P[i]; p.l -= dt * p.d; if (p.l <= 0) { P.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985; p.q += p.s * dt; var e = Math.min(1, p.l * 2.2);
      c.globalAlpha = p.k === 'smoke' ? e * 0.35 : e; c.fillStyle = p.c;
      if (p.k === 'smoke') { c.beginPath(); c.arc(p.x + Math.sin(p.q) * 5, p.y, p.r * (2.2 - p.l), 0, 7); c.fill(); }
      else if (p.k === 'bubble') { c.lineWidth = 2; c.strokeStyle = p.c; c.beginPath(); c.arc(p.x + Math.sin(p.q) * 3, p.y, p.r, 0, 7); c.stroke(); }
      else if (p.k === 'drop') { c.beginPath(); c.moveTo(p.x, p.y - p.r * 1.7); c.quadraticCurveTo(p.x + p.r * 1.2, p.y, p.x, p.y + p.r * 0.9); c.quadraticCurveTo(p.x - p.r * 1.2, p.y, p.x, p.y - p.r * 1.7); c.fill(); }
      else if (p.k === 'spark') { c.lineWidth = p.r * 0.5; c.strokeStyle = p.c; c.lineCap = 'round'; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05); c.stroke(); }
      else if (p.k === 'star') { c.save(); c.translate(p.x, p.y); c.rotate(p.q); c.beginPath(); for (var j = 0; j < 10; j++) { var rr = j % 2 ? p.r * 0.45 : p.r; c.lineTo(Math.cos(j * 0.628) * rr, Math.sin(j * 0.628) * rr); } c.closePath(); c.fill(); c.lineWidth = 1.6; c.strokeStyle = INK; c.stroke(); c.restore(); }
      else if (p.k === 'paper') { c.save(); c.translate(p.x, p.y); c.rotate(p.q); c.scale(1, Math.cos(p.q * 2)); c.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2); c.restore(); }
      else { c.beginPath(); c.arc(p.x, p.y, p.r * (0.4 + 0.6 * p.l), 0, 7); c.fill(); }
    }
    c.globalAlpha = 1;
  }
  G.confetti = function () { for (var k = 0; k < 2; k++) G.puff(k ? G.W : 0, G.H * 0.7, { n: 60, angle: k ? -2.2 : -0.95, spread: 0.55, speed: 820, gravity: 900, size: 8, life: 2, kind: 'paper', color: ['#2f3cdc', '#ffc93c', '#f39ac3', '#f26b2e', '#1a7748', '#8f9cff'] }); };
  G.shake = function (n) { shake = Math.max(shake, n || 8); };

  /** A thing to drag. Returns {x, y, held, dropped, squash}. keep(b) may clamp it. */
  G.drag = function (id, x, y, r, keep) {
    var b = bodies[id]; if (!b) b = bodies[id] = { x: x, y: y, r: r, sq: 0, sv: 0 }; b.r = r; b.seen = G.frame; b.dropped = b.dropped && !b.used ? ((b.used = true), true) : ((b.used = false), false);
    if (b.held && !changing) { b.x = ptr.x + b.ox; b.y = ptr.y + b.oy; } if (keep) keep(b);
    b.sv += (-b.sq * 260 - b.sv * 16) * G.dt; b.sq += b.sv * G.dt; b.squash = b.sq; return b;
  };
  G.place = function (id, x, y) { if (bodies[id]) { bodies[id].x = x; bodies[id].y = y; bodies[id].held = false; } };
  /** Draws squashed around a point, for juice. */
  G.squashed = function (b, draw) { c.save(); c.translate(b.x, b.y); c.scale(1 + b.squash, 1 - b.squash); c.translate(-b.x, -b.y); draw(); c.restore(); };

  G.goal = function (s) { if (s !== goal) { goal = s; goalAt = G.t; } };
  G.toast = function (s, secs) { toast = { s: s, t: G.t, d: secs || 1.9 }; };
  G.gauge = function (v, label, color, zone) { gauge = { v: gauge ? G.lerp(gauge.v, v, Math.min(1, G.dt * 9)) : v, label: label, color: color || '#2f3cdc', zone: zone }; };
  G.hint = function (x, y, x2, y2) { hint = [x, y, x2 == null ? x : x2, y2 == null ? y : y2]; };
  function start() { changing = false; gauge = null; for (var k in bodies) delete bodies[k]; if (G.onLevel) G.onLevel(G.level); }
  G.win = function (s) {
    if (changing || done) return; changing = true; flash = 1; G.confetti(); G.shake(7); G.toast(s || 'Yes!', 2.4); try { parent.postMessage({ game: 'level', level: G.level }, '*'); } catch (e) {}
    setTimeout(function () { if (G.level >= 3) { done = true; again = true; G.confetti(); try { parent.postMessage({ game: 'won' }, '*'); } catch (e) {} } else { G.level++; start(); } }, 2300);
  };
  G.fail = function (s) { if (changing || done) return; changing = true; G.shake(13); G.toast(s || 'Try that again', 1.7); setTimeout(start, 1500); };
  G.playing = function () { return !changing && !done; };

  function hud(dt) {
    var p = G.ease((G.t - goalAt) / 0.5); if (goal) { c.save(); c.globalAlpha = p; c.translate(0, (1 - p) * -24); var fs = G.tall ? 21 : 24; c.font = '800 ' + fs + 'px Inter,system-ui,sans-serif'; var w = Math.min(G.W - 40, c.measureText(goal).width + 44); G.box(G.W / 2 - w / 2, 18, w, fs + 24, 22, '#fff', { shadow: 4, shine: false, line: 3 }); G.text(goal, G.W / 2, 18 + (fs + 24) / 2 + 1, fs); c.restore(); }
    for (var i = 1; i <= 3; i++) { var x = 34 + (i - 1) * 30, y = G.H - 32; c.beginPath(); c.arc(x, y, 10, 0, 7); c.fillStyle = i < G.level || done ? '#1a7748' : i === G.level ? '#ffc93c' : '#fff'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); }
    if (gauge) { var h = Math.min(270, G.H * 0.46), x0 = G.W - 62, y0 = G.H / 2 - h / 2 + 12; G.box(x0, y0, 30, h, 15, '#fff', { shadow: 4, shine: false }); c.save(); c.beginPath(); c.roundRect(x0 + 2, y0 + 2, 26, h - 4, 13); c.clip(); if (gauge.zone) { c.fillStyle = 'rgba(26,119,72,.25)'; c.fillRect(x0, y0 + h * (1 - gauge.zone[1]), 30, h * (gauge.zone[1] - gauge.zone[0])); } var v = G.clamp(gauge.v, 0, 1), ty = y0 + h * (1 - v); c.fillStyle = gauge.color; c.beginPath(); c.moveTo(x0, y0 + h); c.lineTo(x0, ty); for (var k = 0; k <= 30; k += 5) c.lineTo(x0 + k, ty + Math.sin(G.t * 5 + k * 0.4) * 3); c.lineTo(x0 + 30, y0 + h); c.fill(); c.restore(); if (gauge.label) G.label(gauge.label, Math.min(G.W - 60, x0 + 15), y0 - 24, 15); }
    if (hint && G.playing()) { var q = (G.t * 0.7) % 1, hx = G.lerp(hint[0], hint[2], G.ease(q)), hy = G.lerp(hint[1], hint[3], G.ease(q)); c.globalAlpha = 1 - q * 0.75; c.lineWidth = 4; c.strokeStyle = '#2f3cdc'; c.beginPath(); c.arc(hint[0], hint[1], 30 + q * 24, 0, 7); c.stroke(); c.globalAlpha = 1; c.save(); c.translate(hx, hy); c.beginPath(); c.moveTo(0, 0); c.lineTo(21, 19); c.lineTo(11, 21); c.lineTo(6, 31); c.closePath(); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); c.restore(); }
    if (toast) { var a = (G.t - toast.t) / toast.d; if (a > 1) toast = null; else { var s = G.ease(Math.min(1, a * 5)), f = a > 0.8 ? (1 - a) * 5 : 1; c.save(); c.globalAlpha = f; c.translate(G.W / 2, G.H * 0.3); c.scale(0.6 + 0.4 * s, 0.6 + 0.4 * s); c.font = '800 30px Inter,system-ui,sans-serif'; var tw = Math.min(G.W - 30, c.measureText(toast.s).width + 60); G.box(-tw / 2, -34, tw, 68, 26, '#ffc93c', { shadow: 6, shine: false, line: 4 }); var fz = 30; while (fz > 15 && c.measureText(toast.s).width > tw - 36) { fz -= 2; c.font = '800 ' + fz + 'px Inter,system-ui,sans-serif'; } G.text(toast.s, 0, 2, fz); c.restore(); } }
    if (again) { c.fillStyle = 'rgba(250,248,243,.8)'; c.fillRect(-30, -30, G.W + 60, G.H + 60); G.text('You made it work', G.W / 2, G.H / 2 - 30, G.tall ? 44 : 62); G.text(goal2 || '', G.W / 2, G.H / 2 + 32, 20, '#5c5b57'); G.box(G.W / 2 - 100, G.H / 2 + 92, 200, 60, 30, '#2f3cdc', { shadow: 6, shine: false }); G.text('Play again', G.W / 2, G.H / 2 + 123, 24, '#fff'); if (Math.random() < 0.06) G.puff(G.rand(0, G.W), -10, { n: 4, angle: 1.57, spread: 0.6, speed: 160, gravity: 120, size: 8, life: 2.4, kind: 'paper', color: ['#2f3cdc', '#ffc93c', '#f39ac3', '#f26b2e'] }); }
  }
  var goal2 = '', last = 0; G.frame = 0; G.dt = 0.016; G.lesson = function (s) { goal2 = s; };
  G.run = function (update, draw) {
    if (typeof update === 'object' && update) { draw = update.draw; update = update.update; }
    if (typeof draw !== 'function') { draw = update; update = null; } // one function that does both
    start();
    (function loop(now) {
      var dt = Math.min(0.034, (now - last) / 1000 || 0.016); last = now; G.dt = dt; G.t += dt; G.frame++; shake *= Math.pow(0.0008, dt); flash *= Math.pow(0.01, dt);
      if (!again && update) update(dt, G.playing());
      c.setTransform(zoom, 0, 0, zoom, 0, 0); c.globalAlpha = 1; c.clearRect(0, 0, G.W, G.H); c.save(); if (shake > 0.4) c.translate(G.rand(-shake, shake), G.rand(-shake, shake));
      draw(update ? c : dt, G.playing()); parts(dt); c.restore(); if (flash > 0.02) { c.globalAlpha = flash * 0.5; c.fillStyle = '#fff'; c.fillRect(0, 0, G.W, G.H); c.globalAlpha = 1; } hud(dt);
      if (again) parts(0); requestAnimationFrame(loop);
    })(0);
  };
})();
