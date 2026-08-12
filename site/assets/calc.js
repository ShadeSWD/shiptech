/* «Свой вариант (пересчёт)» — живой пересчёт лабораторных по событию input.
   Дефолтные значения полей = числам разобранного варианта, поэтому при
   загрузке панель воспроизводит результаты отчёта (самопроверка). */
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);

  const num = (id) => {
    const el = $(id);
    const v = parseFloat(String(el ? el.value : '').replace(',', '.'));
    return Number.isFinite(v) ? v : NaN;
  };

  // Число в русской записи: запятая, типографский минус, без хвостовых нулей.
  const fmt = (x, d = 2) => {
    if (!Number.isFinite(x)) return '—';
    let s = x.toFixed(d);
    if (d > 0) s = s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    return s.replace('.', ',').replace('-', '−');
  };

  // Строка «формула = подстановка = результат».
  const chain = (f, s, r, bad) =>
    `<span class="chain${bad ? ' bad' : ''}">${f} = <span class="sub">${s}</span> = <b>${r}</b></span>`;
  const line = (html, bad) => `<span class="chain${bad ? ' bad' : ''}">${html}</span>`;

  function bind(prefix, recalc) {
    document.querySelectorAll(`input[id^="${prefix}"]`).forEach((el) =>
      el.addEventListener('input', () => { try { recalc(); } catch (e) { /* пустое поле */ } }));
    recalc();
  }

  /* ───────── ЛР: накат на передаточный плавучий док ───────── */
  if ($('dk-out')) bind('dk-', function () {
    const Ld = num('dk-Ld'), lb = num('dk-lb'), Qb = num('dk-Qb'), Qt = num('dk-Qt'),
          q = num('dk-q'), Rd = num('dk-Rd');
    const N = Math.min(40, Math.max(1, Math.round(num('dk-N'))));
    const n = num('dk-n');
    const ngr = n / N; // опор ТОМ, заезжающих на одну группу
    let rows = '', maxR = 0, lastRm = null, lastImb = null, lastNi = null;
    for (let m = 1; m <= N; m++) {
      const ni = ngr * m;
      const load = ni * Qt, bal = m * Qb, imb = load - bal;
      const Rm = 0.5 * m * lb * imb / Ld;
      const Rb = imb - Rm;
      maxR = Math.max(maxR, Rm, Rb);
      lastRm = Rm; lastImb = imb; lastNi = ni;
      const bm = Rm > Rd ? ' class="bad"' : '', bb = Rb > Rd ? ' class="bad"' : '';
      rows += `<tr${m === N ? ' class="hl"' : ''}><td>${m}</td><td>${m}</td><td>${fmt(ni, 1)}</td>` +
        `<td>${fmt(load, 1)}</td><td>${fmt(bal, 1)}</td><td>${fmt(imb, 1)}</td>` +
        `<td${bm}>${fmt(Rm, 1)}</td><td${bb}>${fmt(Rb, 1)}</td></tr>`;
    }
    $('dk-table').innerHTML = `<table class="data">
      <caption>Реакции опор по положениям наката (пересчёт)</caption>
      <tr><th>Положение</th><th>m (групп)</th><th>n_i (опор)</th><th>n_i·Q_т, т</th>
      <th>m·Q_б, т</th><th>Небаланс, т</th><th>R_м, т</th><th>R_б, т</th></tr>${rows}</table>`;
    const t0 = N * Qb / q;
    const ok = maxR <= Rd;
    $('dk-out').innerHTML =
      chain('опор на группу: n_гр = n / N_ГБО', `${fmt(n, 0)} / ${N}`, `${fmt(ngr, 2)} опор (n_i = n_гр·m)`) +
      chain(`положение ${N}: R_м = 0,5·m·l_б·(n_i·Q_т − m·Q_б) / L_д`,
        `0,5·${N}·${fmt(lb, 2)}·(${fmt(lastNi, 1)}·${fmt(Qt, 1)} − ${N}·${fmt(Qb, 1)}) / ${fmt(Ld, 1)}` +
        ` = 0,5·${N}·${fmt(lb, 2)}·${fmt(lastImb, 1)} / ${fmt(Ld, 1)}`,
        `${fmt(lastRm, 1)} т`) +
      line(`проверка: max R = <b>${fmt(maxR, 1)} т</b> ${ok ? '≤' : '&gt;'} R_d = ${fmt(Rd, 1)} т — ` +
        `<b>${ok ? 'накат безопасен во всех положениях' : 'ПРЕВЫШЕНИЕ допускаемой нагрузки!'}</b>`, !ok) +
      chain('t₀ = N_ГБО·Q_б / q', `${N}·${fmt(Qb, 1)} / ${fmt(q, 1)}`,
        `${fmt(t0, 1)} мин = ${fmt(t0 / 60, 2)} ч`);
  });

  /* ───────── ЛР: теплоизоляция ───────── */
  if ($('iz-out')) bind('iz-', function () {
    const tn = num('iz-tn'), tv = num('iz-tv'), tr = num('iz-tr'), lam = num('iz-lam'),
          rho = num('iz-rho'), av = num('iz-av'), an = num('iz-an'), Sh = num('iz-Sh'),
          h = num('iz-h'), d = num('iz-d'), b = num('iz-b'), F = num('iz-F');
    const R = (1 / av) * (tr - tn) / (tv - tr) - 1 / an;      // Σ(S/λ), м²·К/Вт
    const Smin = lam * R;                                     // м
    const Siz = Math.max(5, Math.ceil(Smin * 1000 / 5 - 1e-9) * 5); // мм, вверх кратно 5
    const R2 = Siz / 1000 / lam;
    const tiz = (tn / av + tv * (1 / an + R2)) / (1 / av + R2 + 1 / an);
    const okT = tiz > tr;
    const Hno = rho * F * (Siz / 1000) * 1.22;
    const width = (hh, name, formula) => {
      if (hh >= 140) return chain(name + ' (h = ' + fmt(hh, 0) + ' ≥ 140): ' + formula.f, formula.s(hh), formula.r(hh));
      if (hh <= 130) return line(`${name}: h = ${fmt(hh, 0)} мм ≤ 130 — профиль перекрывается изоляцией полотна, отдельная заготовка не нужна`);
      return line(`${name}: h = ${fmt(hh, 0)} мм — промежуточная высота (130…140), ширину принять по методичке`, true);
    };
    $('iz-out').innerHTML =
      chain('Σ(S/λ) = (1/α_вн)·(t_р − t_нар)/(t_вн − t_р) − 1/α_нар',
        `(1/${fmt(av, 1)})·(${fmt(tr, 1)} − (${fmt(tn, 1)}))/(${fmt(tv, 1)} − ${fmt(tr, 1)}) − 1/${fmt(an, 1)}` +
        ` = ${fmt((1 / av) * (tr - tn) / (tv - tr), 3)} − ${fmt(1 / an, 3)}`,
        `${fmt(R, 2)} м²·К/Вт`) +
      chain('S_из.min = λ·Σ(S/λ)', `${fmt(lam, 3)}·${fmt(R, 3)}`,
        `${fmt(Smin, 4)} м → принято S_из = <b>${Siz} мм</b> (вверх, кратно 5 мм)`) +
      chain('проверка: t_из = [t_нар/α_вн + t_вн·(1/α_нар + S_из/λ)] / [1/α_вн + S_из/λ + 1/α_нар]',
        `[${fmt(tn, 1)}/${fmt(av, 1)} + ${fmt(tv, 1)}·(${fmt(1 / an, 3)} + ${fmt(R2, 2)})] / [${fmt(1 / av, 3)} + ${fmt(R2, 2)} + ${fmt(1 / an, 3)}]`,
        `${fmt(tiz, 1)} °C ${okT ? '&gt;' : '≤'} t_р = ${fmt(tr, 1)} °C — <b>${okT ? 'не запотевает' : 'ЗАПОТЕВАЕТ — увеличьте толщину!'}</b>`, !okT) +
      width(h, 'полособульб', {
        f: 'B = 2h + 100', s: (x) => `2·${fmt(x, 0)} + 100`, r: (x) => `${fmt(2 * x + 100, 0)} мм`,
      }) +
      width(d, 'тавр', {
        f: 'B = 2·(d + b)', s: (x) => `2·(${fmt(x, 0)} + ${fmt(b, 0)})`, r: (x) => `${fmt(2 * (x + b), 0)} мм`,
      }) +
      line(`плиты полотна: B = Ш = <b>${fmt(Sh, 0)} мм</b>; пакеты: B = Ш + 20 = <b>${fmt(Sh + 20, 0)} мм</b>`) +
      chain('Н_но = ρ·F·S_из·K₀ (K₀ = 1,22)',
        `${fmt(rho, 1)}·${fmt(F, 3)}·${fmt(Siz / 1000, 3)}·1,22`, `${fmt(Hno, 1)} кг`);
  });

  /* ───────── ЛР: обработка труб ───────── */
  if ($('tr-out')) bind('tr-', function () {
    const dn = num('tr-dn'), t = num('tr-t'), Ry = num('tr-Ry'),
          a1 = num('tr-a1'), a2 = num('tr-a2'),
          a = num('tr-a'), b = num('tr-b'), c = num('tr-c'), l = num('tr-l'),
          dpr = num('tr-dpr'), h = num('tr-h'), a0 = num('tr-a0'), b0 = num('tr-b0');
    const PI = 3.14; // как в отчёте
    const r = (dn - t) / 2;
    const K = Math.round((Ry - r * r / Ry) * 10) / 10; // поправка дуги, до 0,1 мм
    const arc = (ang) => PI * ang / 180 * K;
    const L1 = Math.round(a + dpr);
    const L2 = Math.round(a + b + arc(a1) + dpr);
    const L3 = Math.round(a + c + l + arc(2 * a1) + dpr);
    const L4 = Math.round(a + c + b + arc(2 * a2) + dpr);
    const gam = r / Ry;
    const E = gam * 100;
    const tmin = Math.floor((1 - gam) * t / (1 + gam) * 100) / 100; // усечение до 0,01 — как в отчёте
    const kg = h / dn * 100, okG = kg <= 5;
    const ko = (a0 - b0) / dn * 100, okO = ko <= 8;
    const Rmin = 1.5 * dn, okR = Ry >= Rmin;
    $('tr-out').innerHTML =
      chain('r = (d_н − t)/2', `(${fmt(dn, 1)} − ${fmt(t, 1)})/2`, `${fmt(r, 2)} мм`) +
      chain('поправка дуги: R_у − r²/R_у', `${fmt(Ry, 1)} − ${fmt(r, 2)}²/${fmt(Ry, 1)}`, `${fmt(K, 1)} мм`) +
      chain('L₁ = a + Δ_пр', `${fmt(a, 0)} + ${fmt(dpr, 0)}`, `${L1} мм — прямая`) +
      chain('L₂ = a + b + (π·α₁/180)·(R_у − r²/R_у) + Δ_пр',
        `${fmt(a, 0)} + ${fmt(b, 0)} + (π·${fmt(a1, 1)}/180)·${fmt(K, 1)} + ${fmt(dpr, 0)}`,
        `${L2} мм — один гиб ${fmt(a1, 1)}°`) +
      chain('L₃ = a + c + l + (π·2α₁/180)·(R_у − r²/R_у) + Δ_пр',
        `${fmt(a, 0)} + ${fmt(c, 0)} + ${fmt(l, 0)} + (π·${fmt(2 * a1, 1)}/180)·${fmt(K, 1)} + ${fmt(dpr, 0)}`,
        `${L3} мм — два гиба ${fmt(a1, 1)}°`) +
      chain('L₄ = a + c + b + (π·2α₂/180)·(R_у − r²/R_у) + Δ_пр',
        `${fmt(a, 0)} + ${fmt(c, 0)} + ${fmt(b, 0)} + (π·${fmt(2 * a2, 1)}/180)·${fmt(K, 1)} + ${fmt(dpr, 0)}`,
        `${L4} мм — два гиба ${fmt(a2, 1)}°`) +
      chain('утонение: E = (r/R_у)·100 %', `(${fmt(r, 2)}/${fmt(Ry, 1)})·100`, `${fmt(E, 1)} %`) +
      chain('γ = r/R_у; t_min = (1 − γ)·t/(1 + γ)',
        `γ = ${fmt(gam, 3)}; (1 − ${fmt(gam, 3)})·${fmt(t, 1)}/(1 + ${fmt(gam, 3)})`, `${fmt(tmin, 2)} мм`) +
      chain('гофры: k_г = (h/d_н)·100 %', `(${fmt(h, 1)}/${fmt(dn, 1)})·100`,
        `${fmt(kg, 2)} % ${okG ? '≤ 5 % — допустимо' : '&gt; 5 % — БРАК по гофрам!'}`, !okG) +
      chain('овальность: k_о = (a₀ − b₀)/d_н·100 %',
        `(${fmt(a0, 1)} − ${fmt(b0, 1)})/${fmt(dn, 1)}·100`,
        `${fmt(ko, 2)} % ${okO ? '≤ 8–12 % — допустимо' : '&gt; 8 % — вне допуска!'}`, !okO) +
      chain('R_min = 1,5·d_н (гибка с нагревом ТВЧ)', `1,5·${fmt(dn, 1)}`,
        `${fmt(Rmin, 0)} мм ${okR ? '≤' : '&gt;'} R_у = ${fmt(Ry, 1)} мм — ` +
        `<b>${okR ? 'радиус гиба допустим' : 'радиус МЕНЬШЕ минимального!'}</b>`, !okR);
  });

  /* ───────── ЛР: опорно-транспортное устройство ───────── */
  if ($('bt-out')) bind('bt-', function () {
    const Dsp = num('bt-Dsp'), Qt = num('bt-Qt'), k0 = num('bt-k0'),
          bb = num('bt-bb'), Rr = num('bt-Rr');
    const n0raw = k0 * Dsp / Qt;
    const n0 = Math.ceil(n0raw - 1e-9);
    const Qr = Dsp / n0;
    const okQ = Qr <= Qt;
    const lp = Qt * 1000 / (bb * Rr); // см (Q_т в кгс)
    const nbr = Math.ceil(lp / 15 - 1e-9);
    $('bt-out').innerHTML =
      chain('n₀ = k₀·D_сп / Q_т', `${fmt(k0, 2)}·${fmt(Dsp, 1)} / ${fmt(Qt, 1)}`,
        `${fmt(n0raw, 1)} → <b>${n0} модулей</b> (вверх)`) +
      chain('Q_р = D_сп / n₀', `${fmt(Dsp, 1)} / ${n0}`,
        `${fmt(Qr, 0)} т на модуль ${okQ ? '≤' : '&gt;'} Q_т = ${fmt(Qt, 1)} т${okQ ? '' : ' — ПЕРЕГРУЗ!'}`, !okQ) +
      chain('l_п = Q_т / (b_б·R_расч)', `${fmt(Qt, 1)}·1000 / (${fmt(bb, 1)}·${fmt(Rr, 1)})`,
        `${fmt(lp, 2)} см`) +
      chain('n_бр = l_п / 15 (брус 150×150 мм)', `${fmt(lp, 2)} / 15`,
        `${fmt(lp / 15, 1)} → <b>${nbr} брусьев</b> (вверх)`);
  });

  /* ───────── ЛР: формирование корпуса ───────── */
  if ($('hl-out')) bind('hl-', function () {
    const Qkr = num('hl-Qkr'), qd = num('hl-qd'), qb = num('hl-qb'),
          qp = num('hl-qp'), shp = num('hl-shp');
    const qps = qd + qb + qp;
    const lmax = Qkr * 1000 / qps;
    const nshp = Math.floor(lmax / shp + 1e-9);
    const lsec = nshp * shp;
    $('hl-out').innerHTML =
      chain('q_пс = q_псд + q_псб + q_псп', `${fmt(qd, 2)} + ${fmt(qb, 2)} + ${fmt(qp, 2)}`,
        `${fmt(qps, 2)} кг/м`) +
      chain('l_max = Q_кр / q_пс', `${fmt(Qkr, 1)}·1000 / ${fmt(qps, 2)}`, `${fmt(lmax, 2)} м`) +
      chain('принятая длина: l = ⌊l_max/Ш⌋·Ш (вниз, кратно шпации)',
        `⌊${fmt(lmax, 2)}/${fmt(shp, 2)}⌋·${fmt(shp, 2)} = ${nshp}·${fmt(shp, 2)}`,
        `${fmt(lsec, 2)} м (${nshp} шпаций)`);
  });
})();
