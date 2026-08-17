/* Живые расчёты плазово-корпусного цикла: развёртка листов двоякой кривизны,
   гибка листа наружной обшивки, пропускная способность сборочно-сварочных
   площадей. Дефолты полей = числам учебных примеров, поэтому при загрузке
   страницы панель воспроизводит эталонные результаты (самопроверка). */
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);

  const num = (id) => {
    const el = $(id);
    const v = parseFloat(String(el ? el.value : '').replace(',', '.'));
    return Number.isFinite(v) ? v : NaN;
  };
  const val = (id) => { const el = $(id); return el ? el.value : ''; };
  const put = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };

  /* Число в русской записи: запятая, типографский минус, без хвостовых нулей. */
  const fmt = (x, d = 2) => {
    if (!Number.isFinite(x)) return '—';
    const p = Math.pow(10, d);                       // округление «половина вверх»
    const v = Math.sign(x) * Math.round(Math.abs(x) * p * (1 + 1e-12)) / p;
    let s = v.toFixed(d);
    if (d > 0) s = s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    return s.replace('.', ',').replace('-', '−');
  };
  const chain = (f, s, r, bad) =>
    `<span class="chain${bad ? ' bad' : ''}">${f} = <span class="sub">${s}</span> = <b>${r}</b></span>`;
  const line = (html, bad) => `<span class="chain${bad ? ' bad' : ''}">${html}</span>`;
  const n1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '0');
  const sg = (n) => (n < 0 ? '\u2212' + Math.abs(n) : String(n));      // типографский минус
  const plural = (n, f) => {                                          // 1 смена / 2 смены / 5 смен
    const a = Math.abs(n) % 100, b = a % 10;
    return (a > 10 && a < 20) || b === 0 || b > 4 ? f[2] : b === 1 ? f[0] : f[1];
  };
  const smen = (n) => plural(n, ['смена', 'смены', 'смен']);

  /* Пересчёт по любому изменению полей группы (input + select). */
  function bind(prefix, recalc) {
    document.querySelectorAll(`[id^="${prefix}"]`).forEach((el) => {
      if (el.tagName !== 'INPUT' && el.tagName !== 'SELECT') return;
      const go = () => { try { recalc(); } catch (e) { /* незаполненное поле */ } };
      el.addEventListener('input', go);
      el.addEventListener('change', go);
    });
    try { recalc(); } catch (e) { /* нет данных */ }
  }

  /* Плавная кривая через точки (Catmull–Rom → кубические Безье). */
  function smooth(pts) {
    if (!pts.length) return '';
    let d = `M${n1(pts[0][0])},${n1(pts[0][1])}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || pts[i + 1];
      d += `C${n1(p1[0] + (p2[0] - p0[0]) / 6)},${n1(p1[1] + (p2[1] - p0[1]) / 6)} ` +
           `${n1(p2[0] - (p3[0] - p1[0]) / 6)},${n1(p2[1] - (p3[1] - p1[1]) / 6)} ` +
           `${n1(p2[0])},${n1(p2[1])}`;
    }
    return d;
  }
  const T = (x, y, s, style) => `<text x="${n1(x)}" y="${n1(y)}" style="font:${style || '11px system-ui'};fill:#6b6b74">${s}</text>`;

  /* ═════════ РАЗВЁРТКА ЛИСТА ДВОЯКОЙ КРИВИЗНЫ ═════════ */
  if ($('uf-out')) bind('uf-', function () {
    const Sh = num('uf-Sh'), mArr = num('uf-m'), M = Math.round(num('uf-M'));
    const bvc = num('uf-bvc'), bve = num('uf-bve'), bnc = num('uf-bnc'), bne = num('uf-bne');
    const A = { P: [], F: [] }, B = { P: [], F: [] };
    for (let i = 1; i <= 4; i++) { A.P.push(num('uf-Pa' + i)); B.P.push(num('uf-Pb' + i)); }
    for (let i = 1; i <= 3; i++) { A.F.push(num('uf-fa' + i)); B.F.push(num('uf-fb' + i)); }

    /* Δ_i = Σ (i − k)·|П_k − П_{k+1}|·φ_k, k = 1…i−1 */
    const half = (h) => {
      const prod = [];
      for (let k = 0; k < 3; k++) prod.push(Math.abs(h.P[k] - h.P[k + 1]) * h.F[k]);
      const d = [0];
      for (let i = 2; i <= 4; i++) {
        let s = 0;
        for (let k = 1; k <= i - 1; k++) s += (i - k) * prod[k - 1];
        d.push(s);
      }
      return { P: h.P, F: h.F, prod, d, dec: h.P[0] > h.P[3] };
    };
    const a = half(A), b = half(B);

    /* Таблицы: подписи шпаций и вычисляемые ячейки. */
    const fill = (key, hh, sign) => {
      for (let i = 1; i <= 4; i++) {
        const f1 = M + sign * i, f2 = M + sign * (i - 1);
        put(`uf-s${key}${i}`, sign < 0 ? `${f1}–${f2}` : `${f2}–${f1}`);
        put(`uf-n${key}${i}`, String(M + sign * i));
        put(`uf-d${key}${i}`, i <= 3 ? fmt(Math.abs(hh.P[i - 1] - hh.P[i]), 2) : '—');
        put(`uf-m${key}${i}`, i <= 3 ? fmt(hh.prod[i - 1], 4) : '—');
        put(`uf-D${key}${i}`, fmt(hh.d[i - 1], 4));
      }
    };
    fill('a', a, -1); fill('b', b, +1);

    /* Стрелка выгиба по формуле А. М. Челнокова. */
    const P1 = a.P[0], P1s = b.P[0], sum = P1 + P1s;
    const y = mArr * sum / Math.sqrt(4 * Sh * Sh + sum * sum);
    /* Растяжки: истинная длина линии за шпацию = √(Ш² + П²). */
    const segs = [a.P[3], a.P[2], a.P[1], a.P[0], b.P[0], b.P[1], b.P[2], b.P[3]]
      .map((P) => Math.sqrt(Sh * Sh + P * P));
    const Lgeo = segs.reduce((s, v) => s + v, 0);

    /* ── SVG 1: проекция «корпус» ── */
    const W = 680, yc = 170, hh = 100;
    const sumA = a.P.reduce((s, v) => s + v, 0), sumB = b.P.reduce((s, v) => s + v, 0);
    const sc = 560 / (sumA + sumB);
    const x0 = 60 + 560 * sumA / (sumA + sumB);
    const mpx = mArr * sc;
    const fr = [];                     // {n, x, sag, dl} слева направо
    for (let i = 4; i >= 1; i--) {
      let x = x0; for (let k = 0; k < i; k++) x -= a.P[k] * sc;
      fr.push({ n: M - i, x: x, dl: a.d[i - 1], up: a.dec });
    }
    fr.push({ n: M, x: x0, dl: 0, up: true });
    for (let i = 1; i <= 4; i++) {
      let x = x0; for (let k = 0; k < i; k++) x += b.P[k] * sc;
      fr.push({ n: M + i, x: x, dl: b.d[i - 1], up: b.dec });
    }
    fr.forEach((f) => { f.sag = mpx * (1 + 0.28 * (f.x - x0) / 300); });
    const maxD = Math.max(1e-9, ...fr.map((f) => Math.abs(f.dl)));
    const kD = 44 / maxD;                       // увеличение отклонений
    const exagg = kD / sc;                      // во сколько раз крупнее прогрессов
    const fx = (f, yy) => f.x + f.sag * Math.pow((yy - yc) / hh, 2);
    let s1 = '';
    // пазы
    const topPts = fr.map((f) => [fx(f, yc - hh), yc - hh]);
    const botPts = fr.map((f) => [fx(f, yc + hh), yc + hh]);
    s1 += `<path d="${smooth(topPts)}" fill="none" stroke="#16161a" stroke-width="2"/>`;
    s1 += `<path d="${smooth(botPts)}" fill="none" stroke="#16161a" stroke-width="2"/>`;
    // шпангоуты
    fr.forEach((f) => {
      const pts = [];
      for (let t = -1; t <= 1.0001; t += 0.25) pts.push([fx(f, yc + t * hh), yc + t * hh]);
      s1 += `<path d="${smooth(pts)}" fill="none" stroke="${f.n === M ? '#16161a' : '#9a9aa2'}" stroke-width="${f.n === M ? 2.2 : 1.2}"/>`;
      s1 += T(f.x - 7, yc + hh + 46, String(f.n), '11px system-ui');
    });
    // нормаль, касательная, хорда, точка касания
    s1 += `<line x1="46" y1="${yc}" x2="662" y2="${yc}" stroke="#2b4fa0" stroke-width="1.6" stroke-dasharray="7 4"/>`;
    s1 += T(80, yc - 10, 'нормаль к среднему шпангоуту', '11px system-ui;fill:#2b4fa0');
    s1 += `<line x1="${n1(x0)}" y1="${yc - hh - 22}" x2="${n1(x0)}" y2="${yc + hh + 8}" stroke="#8a5b1d" stroke-width="1.6"/>`;
    s1 += T(x0 + 8, yc - hh - 28, 'касательная К', '11px system-ui;fill:#8a5b1d');
    const xch = fx(fr[4], yc - hh);
    s1 += `<line x1="${n1(xch)}" y1="${yc - hh}" x2="${n1(xch)}" y2="${yc + hh}" stroke="#8a5b1d" stroke-width="1.3" stroke-dasharray="5 4"/>`;
    s1 += T(xch + 6, yc - hh - 6, 'хорда Х', '11px system-ui;fill:#8a5b1d');
    s1 += `<circle cx="${n1(x0)}" cy="${yc}" r="3.4" fill="#16161a"/>` + T(x0 - 96, yc + 18, 'точка касания 0', '11px system-ui');
    // геодезическая
    const gp = fr.map((f) => {
      const yy = yc - (f.up ? 1 : -1) * f.dl * kD;
      return [fx(f, yy), yy];
    });
    s1 += `<path d="${smooth(gp)}" fill="none" stroke="#b3382e" stroke-width="2.2"/>`;
    fr.forEach((f, i) => {
      s1 += `<circle cx="${n1(gp[i][0])}" cy="${n1(gp[i][1])}" r="2.6" fill="#b3382e"/>`;
      if (Math.abs(f.dl) > 1e-9) {
        s1 += `<line x1="${n1(f.x)}" y1="${yc}" x2="${n1(f.x)}" y2="${n1(gp[i][1])}" stroke="#b3382e" stroke-width="1" stroke-dasharray="2 2"/>`;
        const above = gp[i][1] < yc;
        const near = f.x < 130;   // у левого края подпись уводим вправо от паза
        s1 += T(near ? f.x + 8 : f.x - 16, above ? gp[i][1] - 6 : gp[i][1] + 14, fmt(f.dl, 4), '10px system-ui;fill:#b3382e');
      }
    });
    s1 += T(46, 20, `геодезическая линия; Δ показаны крупнее прогрессов в ${fmt(exagg, 0)} раз`, '11.5px system-ui;fill:#b3382e');
    s1 += T(46, yc - hh - 26, 'верхний паз', '11px system-ui');
    s1 += T(46, yc + hh + 30, 'нижний паз', '11px system-ui');
    s1 += T(46, 330, `слева прогрессы ${a.dec ? 'убывают' : 'растут'} наружу → Δ ${a.dec ? 'вверх' : 'вниз'};` +
      ` справа ${b.dec ? 'убывают' : 'растут'} → Δ ${b.dec ? 'вверх' : 'вниз'}`, '11px system-ui');
    put('uf-svg1', `<svg viewBox="0 0 ${W} 345" class="geo-board" style="max-width:${W}px">${s1}</svg>`);

    /* ── SVG 2: развёртка ── */
    const bw = (i) => bvc + (bve - bvc) * Math.abs(i) / 4;   // полуширота верх (шп. на удалении i)
    const bn = (i) => bnc + (bne - bnc) * Math.abs(i) / 4;   // полуширота низ
    const maxB = Math.max(bw(0), bw(4), bn(0), bn(4)) * 2;
    const sc2 = Math.min(560 / Lgeo, 224 / maxB);
    const yg = 205;
    let x = 55, st = [];
    const idx = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
    idx.forEach((i, k) => {
      if (k > 0) x += segs[k - 1] * sc2;
      const near = [a.P, b.P];
      let pl, pr;                                   // прогрессы шпаций слева/справа от шпангоута
      if (i < 0) { pl = a.P[-i]; pr = a.P[-i - 1]; }
      else if (i > 0) { pl = b.P[i - 1]; pr = b.P[i]; }
      else { pl = a.P[0]; pr = b.P[0]; }
      if (!Number.isFinite(pl)) pl = pr;
      if (!Number.isFinite(pr)) pr = pl;
      const ss = pl + pr;
      const yi = mArr * ss / Math.sqrt(4 * Sh * Sh + ss * ss);   // выгиб шпангоута на развёртке
      st.push({ n: M + i, i: i, x: x, y: yi, bv: bw(i), bn: bn(i) });
    });
    let s2 = '';
    const upPts = st.map((s) => [s.x + s.y * sc2, yg - s.bv * sc2]);
    const dnPts = st.map((s) => [s.x + s.y * sc2, yg + s.bn * sc2]);
    s2 += `<path d="${smooth(upPts)}" fill="none" stroke="#16161a" stroke-width="2"/>`;
    s2 += `<path d="${smooth(dnPts)}" fill="none" stroke="#16161a" stroke-width="2"/>`;
    st.forEach((s, k) => {
      s2 += `<path d="${smooth([upPts[k], [s.x, yg], dnPts[k]])}" fill="none" stroke="${s.i === 0 ? '#16161a' : '#9a9aa2'}" stroke-width="${s.i === 0 ? 2 : 1.1}"/>`;
      s2 += `<circle cx="${n1(s.x)}" cy="${yg}" r="2.4" fill="#b3382e"/>`;
      s2 += `<circle cx="${n1(upPts[k][0])}" cy="${n1(upPts[k][1])}" r="2" fill="#16161a"/>`;
      s2 += `<circle cx="${n1(dnPts[k][0])}" cy="${n1(dnPts[k][1])}" r="2" fill="#16161a"/>`;
      s2 += T(s.x - 7, dnPts[k][1] + 17, String(s.n), '11px system-ui');
    });
    const xm = st[4].x;
    s2 += `<line x1="55" y1="${yg}" x2="${n1(st[8].x + 12)}" y2="${yg}" stroke="#b3382e" stroke-width="2.2"/>`;
    s2 += T(55, 46, `красная прямая — геодезическая, её растяжка ${fmt(Lgeo, 1)} мм`, '11.5px system-ui;fill:#b3382e');
    s2 += `<line x1="${n1(xm)}" y1="${n1(yg - st[4].bv * sc2 - 18)}" x2="${n1(xm)}" y2="${n1(yg + st[4].bn * sc2 + 10)}" stroke="#2b4fa0" stroke-width="1.3" stroke-dasharray="6 4"/>`;
    // размер стрелки выгиба y
    const yTop = yg - st[4].bv * sc2;
    s2 += `<line x1="${n1(xm)}" y1="${n1(yTop - 12)}" x2="${n1(xm + y * sc2)}" y2="${n1(yTop - 12)}" stroke="#8a5b1d" stroke-width="1.4"/>`;
    s2 += T(xm + 6, yTop - 16, `y = ${fmt(y, 3)} мм`, '11px system-ui;fill:#8a5b1d');
    // диагонали
    const d1 = [upPts[0], dnPts[8]], d2 = [dnPts[0], upPts[8]];
    const dl = (p) => Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]) / sc2;
    [d1, d2].forEach((d, i) => {
      s2 += `<line x1="${n1(d[0][0])}" y1="${n1(d[0][1])}" x2="${n1(d[1][0])}" y2="${n1(d[1][1])}" stroke="#1d7a3e" stroke-width="1.2" stroke-dasharray="7 4"/>`;
      const t = i ? 0.24 : 0.76;                       // подписи в четвертях, чтобы не наложились
      const mx = d[0][0] + (d[1][0] - d[0][0]) * t, my = d[0][1] + (d[1][1] - d[0][1]) * t;
      s2 += T(mx - 34, my + (i ? 16 : -8), `d${i + 1} = ${fmt(dl(d), 1)} мм`, '11px system-ui;fill:#1d7a3e');
    });
    s2 += T(55, 28, 'развёртка: засечки полуширот, выгиб шпангоутов, диагонали проверки', '11.5px system-ui');
    put('uf-svg2', `<svg viewBox="0 0 ${W} 360" class="geo-board" style="max-width:${W}px">${s2}</svg>`);

    /* ── цепочки ── */
    const sub = (hh, i, sgn) => {
      const parts = [], nums = [];
      for (let k = 1; k <= i - 1; k++) {
        parts.push(`${i - k}·(П${k} − П${k + 1})·φ${k}`);
        nums.push(`${i - k}·${fmt(Math.abs(hh.P[k - 1] - hh.P[k]), 2)}·${fmt(hh.F[k - 1], 4)}`);
      }
      return chain(`Δ<sub>${M + sgn * i}</sub> = ` + parts.join(' + '), nums.join(' + '), `${fmt(hh.d[i - 1], 4)} мм`);
    };
    let out = line(`<b>Верхняя половина листа (шпангоуты ${M - 1}…${M - 4}):</b> смежный со средним шпангоут ${M - 1} — Δ = 0`);
    for (let i = 2; i <= 4; i++) out += sub(a, i, -1);
    out += line(`<b>Нижняя половина листа (шпангоуты ${M + 1}…${M + 4}):</b> смежный со средним шпангоут ${M + 1} — Δ = 0`);
    for (let i = 2; i <= 4; i++) out += sub(b, i, +1);
    out += chain('y = m·(П₁ + П₁′) / √(4Ш² + (П₁ + П₁′)²)',
      `${fmt(mArr, 3)}·(${fmt(P1, 2)} + ${fmt(P1s, 2)}) / √(4·${fmt(Sh, 0)}² + (${fmt(sum, 2)})²)` +
      ` = ${fmt(mArr * sum, 2)} / ${fmt(Math.sqrt(4 * Sh * Sh + sum * sum), 3)}`,
      `${fmt(y, 3)} мм — стрелка выгиба среднего шпангоута на развёртке`);
    out += chain('растяжка геодезической: Σ√(Ш² + Пᵢ²)',
      segs.map((v) => fmt(v, 2)).join(' + '), `${fmt(Lgeo, 1)} мм`);
    const dd1 = dl(d1), dd2 = dl(d2), dif = Math.abs(dd1 - dd2);
    out += line(`диагонали развёртки: d₁ = <b>${fmt(dd1, 1)} мм</b>, d₂ = <b>${fmt(dd2, 1)} мм</b>` +
      `${dif > 0.5 ? ` (разность ${fmt(dif, 1)} мм — контур несимметричен относительно геодезической)` : ' (равны — контур симметричен относительно геодезической)'}; ` +
      `при проверке их сравнивают с растяжками тех же диагоналей по проекции корпус: расхождение в несколько миллиметров допустимо`);
    put('uf-out', out);
  });

  /* ═════════ ГИБКА ЛИСТА НАРУЖНОЙ ОБШИВКИ ═════════ */
  if ($('bn-out')) {
    /* Табл. 3 сборника: относительный изгибающий момент m и коэффициент K₁. */
    const TA = {                       // ВМСт.3сп
      r: [10.5, 21.7, 33.7, 47.1, 61.0, 76.0, 98.3, 111, 130, 154, 177, 203, 241, 269, 313, 355, 405, 474, 543, 590, 650, 720, 800, 900, 1000],
      m: [2.08, 1.81, 1.70, 1.64, 1.60, 1.58, 1.56, 1.55, 1.53, 1.52, 1.51, 1.49, 1.48, 1.47, 1.46, 1.45, 1.44, 1.43, 1.42, 1.40, 1.38, 1.37, 1.35, 1.34, 1.33],
      k: [1.385, 1.210, 1.150, 1.090, 1.068, 1.052, 1.040, 1.030, 1.020, 1.012, 1.008, 0.995, 0.987, 0.980, 0.973, 0.967, 0.960, 0.952, 0.947, 0.933, 0.920, 0.913, 0.900, 0.893, 0.887],
    };
    const TB = {                       // 09Г2, 10ХСНД, 10Г2С1Д
      r: [10.8, 23.3, 37.5, 53.3, 72.5, 95.0, 123, 154, 195, 250, 285, 340, 400, 497, 605, 723, 885, 1078, 1340, 1695, 2100, 2685, 4030, 4620],
      m: [2.20, 1.90, 1.78, 1.70, 1.65, 1.61, 1.56, 1.55, 1.50, 1.46, 1.44, 1.40, 1.35, 1.35, 1.32, 1.28, 1.25, 1.22, 1.19, 1.16, 1.13, 1.10, 1.08, 1.04],
      k: [1.460, 1.265, 1.155, 1.130, 1.100, 1.070, 1.040, 1.030, 1.000, 0.975, 0.960, 0.933, 0.920, 0.900, 0.880, 0.854, 0.833, 0.813, 0.793, 0.773, 0.753, 0.733, 0.720, 0.693],
    };
    const STEEL = {
      'ВМСт.3сп': { s: 24, d: 23, t: TA },
      '09Г2, 09Г2С': { s: 30, d: 18, t: TB },
      '10Г2С1Д-35': { s: 35, d: 18, t: TB },
      '10ХСНД (СХЛ-4)': { s: 40, d: 16, t: TB },
      '10ХСН2Д': { s: 45, d: 16, t: TB },
    };
    /* Линейная интерполяция по относительному радиусу. */
    const interp = (t, r) => {
      const R = t.r;
      if (r <= R[0]) return { m: t.m[0], k: t.k[0], edge: 'ниже таблицы — принято крайнее значение' };
      if (r >= R[R.length - 1]) return { m: t.m[R.length - 1], k: t.k[R.length - 1], edge: 'выше таблицы — принято крайнее значение' };
      let i = 0; while (R[i + 1] < r) i++;
      const w = (r - R[i]) / (R[i + 1] - R[i]);
      return { m: t.m[i] + w * (t.m[i + 1] - t.m[i]), k: t.k[i] + w * (t.k[i + 1] - t.k[i]),
        lo: R[i], hi: R[i + 1], mlo: t.m[i], mhi: t.m[i + 1], klo: t.k[i], khi: t.k[i + 1] };
    };
    /* Табл. 5: расстояние между опорами при гибке, мм. */
    const lsup = (S) => (S <= 12 ? 200 : S <= 18 ? 250 : S <= 30 ? 300 : S <= 60 ? 350 : S <= 80 ? 450 : 500);
    /* Табл. 6 (парусовидная и седлообразная форма), мм. */
    const tolTr = (B, S) => (B <= 2000 ? (S <= 10 ? 5 : 4) : (S <= 10 ? 6 : 4));
    const tolLn = (L, S) => (L <= 1000 ? (S <= 10 ? 3 : 2) : L <= 3500 ? (S <= 10 ? 5 : 4)
      : L <= 6000 ? (S <= 10 ? 7 : 5) : (S <= 10 ? 10 : 8));
    const PRESS = [
      { n: 'ПА 3236АФ1', p: 400, st: '2400×2000' }, { n: 'ПА 3239АФ1', p: 800, st: '3600×2600' },
      { n: 'ПА 3241АФ1', p: 1250, st: '4500×3000' }, { n: 'PPM 500/6', p: 500, st: '1200×1200' },
      { n: 'P2MF 3000Т×7000', p: 3000, st: '3200×2500' },
    ];

    bind('bn-', function () {
      const B = num('bn-B'), L = num('bn-L'), S = num('bn-S'),
        h = num('bn-h'), H = num('bn-H'), bp = num('bn-b'),
        lv = num('bn-l'), Db = num('bn-Db');
      const st = STEEL[val('bn-steel')] || STEEL['ВМСт.3сп'];
      const sT = st.s * 100;                    // кгс/см²
      const sMPa = st.s * 9.80665;              // МПа
      const R = B * B / (8 * h);                // мм
      const Rcm = R / 10;
      const r = R / S;
      const ip = interp(st.t, r);
      const W = (L / 10) * Math.pow(S / 10, 2) / 6;   // см³
      const M = ip.m * W * sT;                        // кгс·см
      const sinA = lv / (2 * Rcm + Db);
      const alpha = Math.asin(Math.min(1, sinA));
      const tanA = Math.tan(alpha);
      const Pb = M / (Rcm * sinA), Pv = 2 * M / (Rcm * tanA);
      const l = lsup(S), lcm = l / 10;
      const longPl = bp * 10 < L;                     // лист длиннее пуансона
      let K2 = 0.2 * (B / 10 / bp) * (L / 10 / bp - 1);
      const K2cap = (B / 10 / bp >= 3 || L / 10 / bp >= 6);
      if (K2cap) K2 = 3.0;
      const P1 = (L / 10) * Math.pow(S / 10, 2) * sT / lcm * ip.k;
      const P2 = bp * Math.pow(S / 10, 2) * sT / lcm * ip.k * (1 + K2);
      const Ppress = longPl ? P2 : P1;
      const Pmgps = 1.5 * (Math.PI / 3000) * ip.m * S * S * sMPa;   // кН

      /* Оснастка контроля формы. */
      let osn, osnCls;
      if (h <= 100 && H <= 100) { osn = '3 поперечных шаблона + 1 продольный'; osnCls = 'ok'; }
      else if (h <= 150 && H <= 300) { osn = '5 поперечных шаблонов + 3 продольных'; osnCls = 'ok'; }
      else { osn = 'проверочные каркасы (стрелки вне табличных пределов)'; osnCls = 'bad'; }
      /* Способ гибки. */
      let sp, spCls;
      if (h <= 50 && H <= 200) { sp = 'вальцы с одной прокладкой'; spCls = 'ok'; }
      else if (h <= 100 && H <= 100) { sp = 'вальцы с тремя прокладками'; spCls = 'ok'; }
      else { sp = 'гидравлический пресс (хотя бы одна стрелка выходит за пределы вальцовки)'; spCls = 'bad'; }
      const press = PRESS.filter((p) => p.p * 1000 >= Ppress).sort((x, z) => x.p - z.p)[0];
      const mg = Pmgps <= 245 ? 'МГПС-25 (25 тс ≈ 245 кН)' : Pmgps <= 981 ? 'МГПС-100 (100 тс ≈ 981 кН)' : 'станка МГПС из табл. 1 не хватает';

      put('bn-badges',
        `<span class="badge ${osnCls}">оснастка контроля: ${osn}</span> ` +
        `<span class="badge ${spCls}">способ гибки: ${sp}</span> ` +
        `<span class="badge ok">ротационная гибка: ${mg}</span>`);

      /* Схема сечений листа (живая): каждое сечение — в своей рамке. */
      const arc = (x0, y0, chord, sag, lab, labc) => {
        const px = 240, ph = Math.max(6, Math.min(70, 240 * (sag / chord) * 6));
        let s = `<path d="M${n1(x0)},${n1(y0)} Q${n1(x0 + px / 2)},${n1(y0 - 2 * ph)} ${n1(x0 + px)},${n1(y0)}" fill="none" stroke="#16161a" stroke-width="2.4"/>`;
        s += `<line x1="${n1(x0)}" y1="${n1(y0)}" x2="${n1(x0 + px)}" y2="${n1(y0)}" stroke="#9a9aa2" stroke-width="1.1" stroke-dasharray="5 4"/>`;
        s += `<line x1="${n1(x0 + px / 2)}" y1="${n1(y0)}" x2="${n1(x0 + px / 2)}" y2="${n1(y0 - ph)}" stroke="#b3382e" stroke-width="1.6"/>`;
        s += T(x0 + px / 2 + 7, y0 - ph / 2 + 4, labc, '11.5px system-ui;fill:#b3382e');
        s += T(x0, y0 + 24, lab, '11.5px system-ui');
        return s;
      };
      let sv = T(20, 24, 'сечения листа: поперечное (B, h) и продольное (L, H), стрелки — в увеличенном масштабе', '11.5px system-ui');
      sv += arc(40, 140, B, h, `поперечное: B = ${fmt(B, 0)} мм`, `h = ${fmt(h, 0)} мм`);
      sv += arc(370, 140, L, H, `продольное: L = ${fmt(L, 0)} мм`, `H = ${fmt(H, 0)} мм`);
      sv += T(40, 190, `R = B²/(8h) = ${fmt(R, 0)} мм; допуск формы: поперёк ${fmt(tolTr(B, S), 0)} мм, вдоль ${fmt(tolLn(L, S), 0)} мм`, '11.5px system-ui');
      put('bn-svg', `<svg viewBox="0 0 660 210" class="geo-board" style="max-width:660px">${sv}</svg>`);

      let out = chain('R = B² / (8h)', `${fmt(B, 0)}² / (8·${fmt(h, 0)})`, `${fmt(R, 0)} мм = ${fmt(Rcm, 1)} см`) +
        chain('r = R / S', `${fmt(R, 0)} / ${fmt(S, 1)}`, `${fmt(r, 1)}`) +
        (ip.edge
          ? line(`табл. 3 (${val('bn-steel')}): r = ${fmt(r, 1)} — ${ip.edge}: m = ${fmt(ip.m, 3)}, K₁ = ${fmt(ip.k, 3)}`, true)
          : chain(`табл. 3 (${val('bn-steel')}), интерполяция между r = ${fmt(ip.lo, 1)} и ${fmt(ip.hi, 1)}`,
            `m: ${fmt(ip.mlo, 2)}…${fmt(ip.mhi, 2)}; K₁: ${fmt(ip.klo, 3)}…${fmt(ip.khi, 3)}`,
            `m = ${fmt(ip.m, 3)}; K₁ = ${fmt(ip.k, 3)}`)) +
        chain('W = L·S² / 6', `${fmt(L / 10, 1)}·${fmt(S / 10, 2)}² / 6`, `${fmt(W, 1)} см³`) +
        chain('M = m·W·σ_т', `${fmt(ip.m, 3)}·${fmt(W, 1)}·${fmt(sT, 0)}`, `${fmt(M, 0)} кгс·см`) +
        chain('sin α = l / (2R + D_б)', `${fmt(lv, 0)} / (2·${fmt(Rcm, 1)} + ${fmt(Db, 0)})`,
          `${fmt(sinA, 5)} (α = ${fmt(alpha * 180 / Math.PI, 2)}°)`) +
        chain('P_б = M / (R·sin α)', `${fmt(M, 0)} / (${fmt(Rcm, 1)}·${fmt(sinA, 5)})`,
          `${fmt(Pb, 0)} кгс ≈ ${fmt(Pb / 1000, 1)} тс — на боковой валок`) +
        chain('P_в = 2M / (R·tg α)', `2·${fmt(M, 0)} / (${fmt(Rcm, 1)}·${fmt(tanA, 5)})`,
          `${fmt(Pv, 0)} кгс ≈ ${fmt(Pv / 1000, 1)} тс — на верхний валок`) +
        line(`расстояние между опорами по табл. 5 при S = ${fmt(S, 1)} мм: <b>l = ${fmt(l, 0)} мм</b>`);
      if (longPl) {
        out += chain('K₂ = 0,2·(B/b)·(L/b − 1)',
          K2cap ? 'B/b ≥ 3 или L/b ≥ 6' : `0,2·(${fmt(B / 10, 0)}/${fmt(bp, 0)})·(${fmt(L / 10, 0)}/${fmt(bp, 0)} − 1)`,
          `${fmt(K2, 3)}${K2cap ? ' (принято 3,0 — вне области действия формулы)' : ''}`) +
          chain('лист длиннее пуансона: P = b·S²·σ_т/l · K₁·(1 + K₂)',
            `${fmt(bp, 0)}·${fmt(S / 10, 2)}²·${fmt(sT, 0)}/${fmt(lcm, 1)} · ${fmt(ip.k, 3)}·(1 + ${fmt(K2, 3)})`,
            `${fmt(P2, 0)} кгс ≈ ${fmt(P2 / 1000, 1)} тс`);
      } else {
        out += chain('лист не длиннее пуансона: P = L·S²·σ_т/l · K₁',
          `${fmt(L / 10, 0)}·${fmt(S / 10, 2)}²·${fmt(sT, 0)}/${fmt(lcm, 1)} · ${fmt(ip.k, 3)}`,
          `${fmt(P1, 0)} кгс ≈ ${fmt(P1 / 1000, 1)} тс`);
      }
      out += line(press
        ? `по усилию ${fmt(Ppress / 1000, 1)} тс из табл. 1 подходит пресс <b>${press.n}</b> (${press.p} тс, стол ${press.st} мм)`
        : `усилие ${fmt(Ppress / 1000, 1)} тс превышает возможности прессов табл. 1 — требуется деление детали или иной способ`, !press);
      out += chain('МГПС: P = k·(π/3000)·m·s²·σ_т (k = 1,5; σ_т в МПа)',
        `1,5·(π/3000)·${fmt(ip.m, 3)}·${fmt(S, 1)}²·${fmt(sMPa, 1)}`,
        `${fmt(Pmgps, 1)} кН ≈ ${fmt(Pmgps / 9.80665, 1)} тс — ${mg}`);
      out += line(`допускаемые отклонения формы (табл. 6, парусовидная/седлообразная деталь): ` +
        `по поперечному сечению <b>${fmt(tolTr(B, S), 0)} мм</b>, по продольному <b>${fmt(tolLn(L, S), 0)} мм</b>`);
      put('bn-out', out);
    });
  }

  /* ═════════ ПРОПУСКНАЯ СПОСОБНОСТЬ СБОРОЧНО-СВАРОЧНЫХ ПЛОЩАДЕЙ ═════════ */
  if ($('ws-out')) {
    /* Табл. 1: доли трудоёмкости изготовления секции. */
    const SEC = {
      'Днищевая объёмная центральная': { u: [0.33, 0.26], p1: [0.26, 0.24], po: [0.35, 0.33], d: [0.06, 0.17],
        p2: [0.50, 0.56], vn: [0.31, 0.39], d1: [0.19, 0.05], L: 8.5, B: 14.0, Q: 80, tu: [25.5, 28.5], P: [6, 4], pos: 5 },
      'Днищевая объёмная боковая': { u: [0.36, 0.28], p1: [0.28, 0.26], po: [0.30, 0.28], d: [0.06, 0.18],
        p2: [0.48, 0.55], vn: [0.30, 0.39], d1: [0.32, 0.06], L: 8.5, B: 5.4, Q: 30, tu: [23.0, 24.0], P: [6, 4], pos: 5 },
      'Скуловая объёмная': { u: [0.30, 0.26], p1: [0.35, 0.37], po: [0.32, 0.32], d: [0.03, 0.05],
        p2: [0.57, 0.55], vn: [0.36, 0.39], d1: [0.07, 0.06], L: 8.5, B: 4.3, Q: 31, tu: [17.5, 22.5], P: [4, 2], pos: 5 },
      'Бортовая объёмная': { u: [0.34, 0.26], p1: [0.26, 0.25], po: [0.34, 0.32], d: [0.06, 0.17],
        p2: [0.53, 0.55], vn: [0.33, 0.39], d1: [0.14, 0.06], L: 8.5, B: 8.8, Q: 60, tu: [25.0, 24.0], P: [6, 4], pos: 5 },
      'Палубная полуобъёмная': { u: [0.16, 0.16], p1: [0, 0], po: [0.71, 0.77], d: [0.07, 0.13],
        p2: [0.71, 0.77], vn: [0.29, 0.23], d1: [0, 0], L: 8.5, B: 15.4, Q: 30, tu: [25.5, 28.5], P: [4, 2], pos: 4 },
    };
    /* Округление смен: дробь ≤ 0,5 — вниз, > 0,5 — вверх. */
    const rnd = (t) => (t - Math.floor(t) <= 0.5 ? Math.floor(t) : Math.ceil(t));

    let lastType = null;
    bind('ws-', function () {
      const type = val('ws-type');
      const S = SEC[type] || SEC['Днищевая объёмная центральная'];
      if (lastType !== null && lastType !== type) {          // подставить исходные данные варианта
        const set = (id, v) => { const e = $(id); if (e) e.value = v; };
        set('ws-L', S.L); set('ws-B', S.B); set('ws-Q', S.Q);
        set('ws-tsb', S.tu[0]); set('ws-tsv', S.tu[1]);
        set('ws-Psb', S.P[0]); set('ws-Psv', S.P[1]);
      }
      lastType = type;
      const L = num('ws-L'), Bw = num('ws-B'), Q = num('ws-Q'),
        tsb = num('ws-tsb'), tsv = num('ws-tsv'),
        Psb = num('ws-Psb'), Psv = num('ws-Psv'), kpn = num('ws-kpn'),
        Lpr = num('ws-Lpr'), Bpr = num('ws-Bpr');
      const Tsb = Q * tsb, Tsv = Q * tsv;
      const dsb = 8 * Psb * kpn, dsv = 8 * Psv * kpn;
      const el = (dol, base) => ({ sb: dol[0] * base[0], sv: dol[1] * base[1] });
      const Tu = el(S.u, [Tsb, Tsv]), T1p = el(S.p1, [Tsb, Tsv]),
        Tpo = el(S.po, [Tsb, Tsv]), Td = el(S.d, [Tsb, Tsv]);
      const T2p = el(S.p2, [Tpo.sb, Tpo.sv]), Tvn = el(S.vn, [Tpo.sb, Tpo.sv]), T1d = el(S.d1, [Tpo.sb, Tpo.sv]);
      const dur = (e) => { const x = e.sb / dsb, z = e.sv / dsv; return { x, z, t: x + z, n: rnd(x + z) }; };
      const tu = dur(Tu), t1p = dur(T1p), tpo = dur(Tpo), td = dur(Td),
        t2p = dur(T2p), tvn = dur(Tvn), t1d = dur(T1d);
      const tou = tu.n - t2p.n, top = t1p.n - (t2p.n + tvn.n);
      const tpoChk = t2p.n + tvn.n + t1d.n;
      const tc = tpo.n + td.n;
      const Fm = num('ws-Fm');
      const ok = tc <= Fm;
      const need = tc <= 25 ? 'односменной работы достаточно' : tc <= 37.5 ? '1,5-сменная работа (Ф_м = 37,5 смены)' : tc <= 50 ? 'двухсменная работа (Ф_м = 50 смен)' : 'двух смен мало — нужны дополнительные площади';

      /* Планировка пролёта. */
      const npos = S.pos;
      const big = Math.max(L, Bw), small = Math.min(L, Bw);
      const Lpp = npos * big + 6, Bpp = small + 2;
      const nPP = Math.max(0, Math.floor(Bpr / Bpp));
      const fits = Lpp <= Lpr && nPP >= 1;
      const nWork = npos - 1;                                  // позиция 0 — раскладка деталей
      const nSb = nPP * nWork * Psb, nSv = nPP * nWork * Psv;

      put('ws-badges',
        `<span class="badge ${ok ? 'ok' : 'bad'}">t_с = ${tc} ${smen(tc)} ${ok ? '≤' : '&gt;'} Ф_м = ${fmt(Fm, 1)} ${smen(Math.round(Fm))}</span> ` +
        `<span class="badge ${tc <= 25 ? 'ok' : 'bad'}">${need}</span> ` +
        `<span class="badge ${fits ? 'ok' : 'bad'}">в пролёте ${fits ? nPP : 0} ПП-${npos} (${fmt(Lpp, 1)}×${fmt(Bpp, 1)} м)</span>`);

      /* Таблица трудоёмкостей и продолжительностей. */
      const row = (nm, T, dd) => `<tr><td class="l">${nm}</td><td>${fmt(T.sb, 1)}</td><td>${fmt(T.sv, 1)}</td>` +
        `<td>${fmt(dd.x, 1)} + ${fmt(dd.z, 1)} = ${fmt(dd.t, 2)}</td><td><b>${dd.n}</b></td></tr>`;
      put('ws-table', `<table class="data">
        <caption>Трудоёмкости сборочных элементов и продолжительности их изготовления (${type.toLowerCase()})</caption>
        <tr><th class="l">Сборочный элемент</th><th>Т_сб, н·ч</th><th>Т_св, н·ч</th><th>t = Т_сб/(8·Р_сб·k) + Т_св/(8·Р_св·k), смен</th><th>принято, смен</th></tr>
        ${row('Узлы высокого набора (t_у)', Tu, tu)}
        ${row('Подсекция 1 (t_1п)', T1p, t1p)}
        ${row('Секция в постели (t_по)', Tpo, tpo)}
        ${row('— настройка и полотнище подсекции 2 (t_2п)', T2p, t2p)}
        ${row('— установка и приварка высокого набора (t_вн)', Tvn, tvn)}
        ${row('— накрытие набора подсекцией 1 (t_1д)', T1d, t1d)}
        ${row('Достройка секции (t_д)', Td, td)}
        <tr class="hl"><td class="l"><b>Секция целиком: t_с = t_по + t_д</b></td><td colspan="3">${tpo.n} + ${td.n}</td><td><b>${tc}</b></td></tr>
      </table>`);

      /* ── SVG: циклограмма ── */
      const bars = [
        { row: 0, lab: 'Позиция 1 — узлы', segs: [{ a: -tou, b: -tou + tu.n, c: '#2b4fa0', t: `t_у = ${tu.n}` }] },
        { row: 1, lab: S.pos === 5 ? 'Позиция 2 — подсекция 1' : 'Позиция 2 — не нужна (ПП-4)',
          segs: S.pos === 5 && t1p.n > 0 ? [{ a: -top, b: -top + t1p.n, c: '#1d7a3e', t: `t_1п = ${t1p.n}` }] : [] },
        { row: 2, lab: 'Позиция 3 — секция в постели', segs: [
          { a: 0, b: t2p.n, c: '#8a5b1d', t: `t_2п = ${t2p.n}` },
          { a: t2p.n, b: t2p.n + tvn.n, c: '#b3382e', t: `t_вн = ${tvn.n}` },
          { a: t2p.n + tvn.n, b: tpoChk, c: '#6b6b74', t: `t_1д = ${t1d.n}` }].filter((z) => z.b > z.a) },
        { row: 3, lab: 'Позиция 4 — достройка', segs: [{ a: tpo.n, b: tc, c: '#155e75', t: `t_д = ${td.n}` }] },
      ];
      let T0 = 0, T1 = Math.max(tc, Fm + 2);
      bars.forEach((b) => b.segs.forEach((s) => { T0 = Math.min(T0, s.a); T1 = Math.max(T1, s.b); }));
      const gx0 = 212, gx1 = 660, gs = (gx1 - gx0) / Math.max(1, T1 - T0);
      const X = (t) => gx0 + (t - T0) * gs;
      let g = T(20, 24, `Циклограмма: ${type.toLowerCase()}`, '11.5px system-ui');
      // сетка
      for (let t = Math.ceil(T0 / 5) * 5; t <= T1; t += 5) {
        g += `<line x1="${n1(X(t))}" y1="46" x2="${n1(X(t))}" y2="228" stroke="#e7e5de" stroke-width="1"/>`;
        g += T(X(t) - 6, 246, String(t), '10px system-ui');
      }
      g += `<line x1="${n1(X(0))}" y1="40" x2="${n1(X(0))}" y2="232" stroke="#9a9aa2" stroke-width="1.4"/>`;
      g += T(X(0) - 4, 38, '0', '10px system-ui');
      bars.forEach((b) => {
        const y = 56 + b.row * 44;
        g += T(18, y + 17, b.lab, '11px system-ui;fill:#3a3a42');
        b.segs.forEach((s) => {
          const w = Math.max(1, (s.b - s.a) * gs);
          g += `<rect x="${n1(X(s.a))}" y="${n1(y)}" width="${n1(w)}" height="24" rx="4" fill="${s.c}" opacity="0.86"/>`;
          const narrow = w < 8 * s.t.length;
          g += `<text x="${n1(X(s.a) + w / 2)}" y="${n1(narrow ? y - 5 : y + 16)}" text-anchor="middle" ` +
            `style="font:11px system-ui;fill:${narrow ? s.c : '#fff'}">${s.t}</text>`;
        });
      });
      g += `<line x1="${n1(X(Fm))}" y1="46" x2="${n1(X(Fm))}" y2="232" stroke="#b3382e" stroke-width="1.6" stroke-dasharray="6 4"/>`;
      g += `<text x="${n1(Math.max(X(Fm) - 6, gx0 + 100))}" y="41" text-anchor="end" ` +
        `style="font:11px system-ui;fill:#b3382e">Ф_м = ${fmt(Fm, 1)} ${smen(Math.round(Fm))}</text>`;
      g += `<line x1="${n1(X(tc))}" y1="46" x2="${n1(X(tc))}" y2="232" stroke="#155e75" stroke-width="1.6"/>`;
      g += `<text x="${n1(X(tc) - 6)}" y="41" text-anchor="end" style="font:11px system-ui;fill:#155e75">t_с = ${tc} ${smen(tc)}</text>`;
      g += T(20, 268, S.pos === 5
        ? `опережения: t_оу = ${sg(tou)}, t_оп = ${sg(top)} ${smen(top)}; шкала — смены`
        : `опережение узлов t_оу = ${sg(tou)} ${smen(tou)}; подсекции 1 у полуобъёмной секции нет`, '11px system-ui');
      put('ws-svg1', `<svg viewBox="0 0 680 280" class="geo-board" style="max-width:680px">${g}</svg>`);

      /* ── SVG: планировка пролёта ── */
      const psc = Math.min(600 / Lpr, 150 / Bpr);
      const px0 = 40, py0 = 50;
      let p = T(20, 26, `Планировка пролёта ${fmt(Lpr, 0)}×${fmt(Bpr, 0)} м: производственные площадки ПП-${npos}`, '11.5px system-ui');
      p += `<rect x="${px0}" y="${py0}" width="${n1(Lpr * psc)}" height="${n1(Bpr * psc)}" fill="none" stroke="#16161a" stroke-width="2"/>`;
      const nShow = Math.min(nPP, 4);
      const gap = Math.max(2, (Bpr * psc - nShow * Bpp * psc) / (nShow + 1));
      for (let j = 0; j < nShow; j++) {
        const yy = py0 + gap * (j + 1) + j * Bpp * psc;
        if (yy + Bpp * psc > py0 + Bpr * psc + 1) break;
        p += `<rect x="${px0 + 6}" y="${n1(yy)}" width="${n1(Math.min(Lpp, Lpr) * psc)}" height="${n1(Bpp * psc)}" fill="rgba(43,79,160,.07)" stroke="#2b4fa0" stroke-width="1.4"/>`;
        for (let k = 0; k < npos; k++) {
          const xx = px0 + 6 + k * (Math.min(Lpp, Lpr) * psc) / npos;
          if (k) p += `<line x1="${n1(xx)}" y1="${n1(yy)}" x2="${n1(xx)}" y2="${n1(yy + Bpp * psc)}" stroke="#2b4fa0" stroke-width="1" stroke-dasharray="4 3"/>`;
          const pl = npos === 5 ? k : [0, 1, 3, 4][k];      // у ПП-4 исключена позиция 2
          p += `<text x="${n1(xx + (Math.min(Lpp, Lpr) * psc) / npos / 2)}" y="${n1(yy + Bpp * psc / 2 + 4)}" text-anchor="middle" style="font:11px system-ui;fill:#2b4fa0">поз. ${pl}</text>`;
        }
      }
      p += T(px0, py0 + Bpr * psc + 20, `ПП-${npos}: длина = ${npos} × ${fmt(big, 1)} + 6 = ${fmt(Lpp, 1)} м; ширина = ${fmt(small, 1)} + 2 = ${fmt(Bpp, 1)} м; ` +
        `в пролёте помещается ${nPP} шт.`, '11.5px system-ui');
      p += T(px0, py0 + Bpr * psc + 38, `персонал: ${nPP} × ${nWork} × ${fmt(Psb, 0)} = ${nSb} сборщ., ${nPP} × ${nWork} × ${fmt(Psv, 0)} = ${nSv} сварщ.`, '11.5px system-ui');
      put('ws-svg2', `<svg viewBox="0 0 680 ${Math.round(py0 + Bpr * psc + 56)}" class="geo-board" style="max-width:680px">${p}</svg>`);

      /* ── цепочки ── */
      const dch = (nm, T, dd) => chain(`${nm} = Т_сб/(8·Р_сб·k_пн) + Т_св/(8·Р_св·k_пн)`,
        `${fmt(T.sb, 1)}/(8·${fmt(Psb, 0)}·${fmt(kpn, 2)}) + ${fmt(T.sv, 1)}/(8·${fmt(Psv, 0)}·${fmt(kpn, 2)}) = ${fmt(dd.x, 1)} + ${fmt(dd.z, 1)}`,
        `${fmt(dd.t, 2)} ≈ ${dd.n} ${smen(dd.n)}`);
      let out = chain('Т_сб = Q_м·t_УД.сб', `${fmt(Q, 1)}·${fmt(tsb, 1)}`, `${fmt(Tsb, 0)} н·ч`) +
        chain('Т_св = Q_м·t_УД.св', `${fmt(Q, 1)}·${fmt(tsv, 1)}`, `${fmt(Tsv, 0)} н·ч`) +
        dch('t_у', Tu, tu) + (S.pos === 5 ? dch('t_1п', T1p, t1p) : '') + dch('t_по', Tpo, tpo) +
        dch('t_2п', T2p, t2p) + dch('t_вн', Tvn, tvn) + dch('t_1д', T1d, t1d) + dch('t_д', Td, td) +
        chain('t_оу = t_у − t_2п', `${tu.n} − ${t2p.n}`,
          `${sg(tou)} ${smen(tou)} — ${tou >= 0 ? `узлы начать за ${tou} ${smen(tou)} до начала работ на постели` : `узлы можно начать на ${-tou} ${smen(tou)} позже`}`) +
        (S.pos === 5 ? chain('t_оп = t_1п − (t_2п + t_вн)', `${t1p.n} − (${t2p.n} + ${tvn.n})`,
          `${sg(top)} ${smen(top)} — ${top >= 0 ? `подсекцию 1 начать раньше на ${top} ${smen(top)}` : `подсекцию 1 можно начать на ${-top} ${smen(top)} позже`}`) : '') +
        chain('проверка: t_по = t_2п + t_вн + t_1д', `${t2p.n} + ${tvn.n} + ${t1d.n}`,
          `${tpoChk} ${smen(tpoChk)} ${tpoChk === tpo.n ? '— совпадает с расчётом по трудоёмкости' : '— отличается от ' + tpo.n + ' ' + smen(tpo.n) + ' (округления)'}`, tpoChk !== tpo.n) +
        chain('t_с = t_по + t_д', `${tpo.n} + ${td.n}`,
          `${tc} ${smen(tc)} ${ok ? '≤' : '&gt;'} Ф_м = ${fmt(Fm, 1)} ${smen(Math.round(Fm))} — ${ok ? 'площади пролёта достаточно' : 'площади недостаточно: ' + need}`, !ok) +
        chain(`длина ПП-${npos} = ${npos}·(наибольший размер) + 6 м`, `${npos}·${fmt(big, 1)} + 6`, `${fmt(Lpp, 1)} м`) +
        chain('ширина ПП = наименьший размер + 2 м', `${fmt(small, 1)} + 2`, `${fmt(Bpp, 1)} м`) +
        chain('число ПП в пролёте = ⌊B_пр / B_ПП⌋', `⌊${fmt(Bpr, 0)} / ${fmt(Bpp, 1)}⌋`,
          `${nPP} шт. ${fits ? '(длина ' + fmt(Lpp, 1) + ' м ≤ ' + fmt(Lpr, 0) + ' м — размещаются)' : '— НЕ РАЗМЕЩАЮТСЯ'}`, !fits) +
        chain('персонал = N_ПП · (позиций без нулевой) · Р', `${nPP}·${nWork}·${fmt(Psb, 0)} и ${nPP}·${nWork}·${fmt(Psv, 0)}`,
          `${nSb} ${plural(nSb, ['сборщик', 'сборщика', 'сборщиков'])} и ${nSv} ${plural(nSv, ['сварщик', 'сварщика', 'сварщиков'])}`);
      put('ws-out', out);
    });
  }
})();
