/* tech.js — расчётное ядро разборов задач сайта «Технология судостроения».
 *
 * Здесь собраны все формулы, которые повторяются на страницах p-*.html:
 * длина обвода и погрешность спрямления на плазе, раскрой листа и
 * коэффициент использования металла, сварочные деформации по Окерблому,
 * суммирование погрешностей размерной цепи, трудоёмкость и такт,
 * спусковые характеристики и усилия гибки с тепловой правкой.
 * Страницы только подставляют числа и печатают результат — ни одна
 * формула не повторяется в разметке и не дублируется между страницами.
 *
 * Модуль чистый: не трогает DOM, не читает глобальные переменные.
 * В браузере доступен как window.TECH, в node — как module.exports,
 * поэтому один и тот же код проверяется тестами (tests/test_tech.py).
 *
 * Коэффициенты сварочных деформаций (0,3354; α; cγ) взяты теми же, что на
 * сайте кластера «Сварка судовых конструкций» (/welding/), — чтобы два
 * сайта не расходились в числах на одной и той же задаче.
 *
 * Самопроверка: TECH.selftest() возвращает массив расхождений (пустой —
 * значит все контрольные точки сошлись). Контрольные точки посчитаны
 * независимо от кода: аналитически либо через обращение формулы.
 */
'use strict';
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TECH = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  var PI = Math.PI;
  var G = 9.81;                 // м/с², ускорение свободного падения

  /* Физические постоянные судостроительной стали нормальной прочности.
     Значения совпадают с /welding/ (assets/wcalc.js, объект STEEL). */
  var STEEL = {
    rho: 7.85,        // т/м³ (= г/см³), плотность
    cg: 0.0047,       // Дж/(мм³·°C), объёмная теплоёмкость
    alpha: 0.12e-4,   // 1/°C, коэффициент линейного расширения
    E: 2.0e5,         // МПа, модуль упругости
    sigmaT: 235,      // МПа, предел текучести стали категории A
  };

  /* ==================================================================
   *  1. ПЛАЗ: ОБВОД, СПРЯМЛЕНИЕ, РАСТЯЖКА
   * ================================================================== */

  /* Длина дуги окружности: l = R·θ (θ в радианах). */
  function arcLen(R, theta) { return R * theta; }

  /* Суммарная длина n равных хорд, вписанных в дугу R, θ.
     Каждая хорда стягивает угол θ/n: c = 2R·sin(θ/2n). */
  function chordSum(R, theta, n) { return n * 2 * R * Math.sin(theta / (2 * n)); }

  /* Погрешность спрямления дуги n хордами.
     Возвращает {arc, chord, abs, rel, est}, где est — оценка по разложению
     в ряд: c = 2R·sin(φ/2) ≈ Rφ(1 − φ²/24), откуда потеря длины на всей
     дуге Δ ≈ l·φ²/24 при φ = θ/n. */
  function straighteningError(R, theta, n) {
    var arc = arcLen(R, theta);
    var chord = chordSum(R, theta, n);
    var phi = theta / n;
    return {
      arc: arc, chord: chord,
      abs: arc - chord,
      rel: (arc - chord) / arc,
      est: arc * phi * phi / 24,
    };
  }

  /* Сколько хорд нужно, чтобы потеря длины не превысила tol (в единицах
     длины). Из Δ ≈ l·φ²/24 ≤ tol следует φ ≤ √(24·tol/l), n ≥ θ/φ. */
  function chordsForTolerance(R, theta, tol) {
    var l = arcLen(R, theta);
    var phi = Math.sqrt(24 * tol / l);
    return Math.ceil(theta / phi);
  }

  /* Длина ломаной по точкам обвода: pts = [[y, z], …]. Ровно то, что
     получается при снятии обвода с теоретического чертежа по ординатам. */
  function polylineLen(pts) {
    var s = 0;
    for (var i = 1; i < pts.length; i++) {
      var dy = pts[i][0] - pts[i - 1][0];
      var dz = pts[i][1] - pts[i - 1][1];
      s += Math.sqrt(dy * dy + dz * dz);
    }
    return s;
  }

  /* Обвод, заданный участками: [{line: L} | {arc: {R, theta}}].
     Возвращает {total, parts:[{kind, len}]}. */
  function girth(parts) {
    var out = [], total = 0;
    parts.forEach(function (p) {
      var len = ('line' in p) ? p.line : arcLen(p.arc.R, p.arc.theta);
      out.push({ kind: ('line' in p) ? 'прямая' : 'дуга', len: len });
      total += len;
    });
    return { total: total, parts: out };
  }

  /* Растяжка: разбивка обвода на пояса шириной не более wMax.
     Возвращает {n, w, seams} — число поясьев, чистовую ширину пояса и
     число пазов (продольных швов) между ними. */
  function beltLayout(girthLen, wMax) {
    var n = Math.ceil(girthLen / wMax);
    return { n: n, w: girthLen / n, seams: n - 1 };
  }

  /* ==================================================================
   *  2. РАСКРОЙ ЛИСТА
   * ================================================================== */

  /* Масса плоской детали или листа: m = L·B·s·ρ.
     L, B — метры; s — миллиметры; ρ — т/м³. Результат — килограммы. */
  function plateMass(L, B, s_mm, rho) {
    return L * B * (s_mm / 1000) * (rho || STEEL.rho) * 1000;
  }

  /* Сколько прямоугольных деталей a×b помещается на лист A×B при ширине
     реза kerf: считаем обе ориентации и берём лучшую.
     Возвращает {n, rows, cols, rot}. */
  function nestRect(A, B, a, b, kerf) {
    var k = (kerf || 0) / 1000;                    // мм → м
    function fit(pa, pb) {
      var cols = Math.floor((A + k) / (pa + k));
      var rows = Math.floor((B + k) / (pb + k));
      return { n: Math.max(0, cols) * Math.max(0, rows), cols: cols, rows: rows };
    }
    var d = fit(a, b), r = fit(b, a);
    return r.n > d.n ? { n: r.n, cols: r.cols, rows: r.rows, rot: true }
                     : { n: d.n, cols: d.cols, rows: d.rows, rot: false };
  }

  /* Потери металла на ширину реза: полоса kerf×s вдоль всей линии реза. */
  function kerfLoss(cutLen_m, kerf_mm, s_mm, rho) {
    return cutLen_m * (kerf_mm / 1000) * (s_mm / 1000) * (rho || STEEL.rho) * 1000;
  }

  /* Коэффициент использования металла: масса годных деталей, отнесённая
     к массе поданного на раскрой проката. */
  function kim(mParts, mPlates) { return mParts / mPlates; }

  /* Карта раскроя: лист {L, B, s} и список деталей [{name, L, B, n}].
     Возвращает массы, длину реза, потери и КИМ. cutLen задаётся явно —
     геометрию раскладки считает не модуль, а технолог. */
  function nestingMap(plate, parts, opt) {
    var o = opt || {};
    var rho = o.rho || STEEL.rho;
    var kerf = o.kerf || 0;
    var mPlate = plateMass(plate.L, plate.B, plate.s, rho);
    var rows = parts.map(function (p) {
      var n = p.n || 1;
      return {
        name: p.name, L: p.L, B: p.B, n: n,
        area: p.L * p.B * n,
        mass: plateMass(p.L, p.B, plate.s, rho) * n,
        cut: 2 * (p.L + p.B) * n,
      };
    });
    var area = rows.reduce(function (s, r) { return s + r.area; }, 0);
    var mass = rows.reduce(function (s, r) { return s + r.mass; }, 0);
    var cut = o.cutLen !== undefined ? o.cutLen
      : rows.reduce(function (s, r) { return s + r.cut; }, 0);
    var loss = kerfLoss(cut, kerf, plate.s, rho);
    return {
      rows: rows,
      plateArea: plate.L * plate.B, plateMass: mPlate,
      partsArea: area, partsMass: mass,
      cutLen: cut, kerfMass: loss,
      scrapMass: mPlate - mass - loss,
      kim: kim(mass, mPlate),
    };
  }

  /* ==================================================================
   *  3. СВАРОЧНЫЕ ДЕФОРМАЦИИ (по Н. О. Окерблому)
   *  Те же выражения и коэффициенты, что на сайте /welding/.
   * ================================================================== */

  /* Погонная энергия, Дж/мм: q = η·U·I/v, скорость v в мм/с. */
  function heatInput(eta, U, I, v_mms) { return eta * U * I / v_mms; }

  /* Скорость сварки из м/ч в мм/с. */
  function mhToMms(v_mh) { return v_mh * 1000 / 3600; }

  /* Усадочная сила, Н: F = 0,3354·α·q·E/(cγ). От размеров детали не зависит. */
  function shrinkForce(q_Jmm) {
    return 0.3354 * STEEL.alpha * q_Jmm * STEEL.E / STEEL.cg;
  }

  /* Поперечная усадка за один проход, мм: ΔW = α·q/(cγ·s). */
  function shrinkTrans(q_Jmm, s_mm) {
    return STEEL.alpha * q_Jmm / (STEEL.cg * s_mm);
  }

  /* Многопроходность: вклад каждого следующего прохода убывает; принято
     суммирование по ряду 1 + 1/2 + … + 1/n (оценочная модель, как на
     /welding/). Возвращает суммарную поперечную усадку шва. */
  function shrinkTransPasses(q_Jmm, s_mm, n) {
    var mult = 0;
    for (var i = 1; i <= Math.max(1, n); i++) mult += 1 / i;
    return shrinkTrans(q_Jmm, s_mm) * mult;
  }

  /* Относительное продольное укорочение: ε = 0,3354·α·q/(cγ·A), A в мм². */
  function shrinkLongRel(q_Jmm, A_mm2) {
    return 0.3354 * STEEL.alpha * q_Jmm / (STEEL.cg * A_mm2);
  }

  /* Стрела прогиба от эксцентрично приложенной усадочной силы:
     f = F·e·L²/(8·E·J) — балка под постоянным изгибающим моментом. */
  function camber(F_N, e_mm, L_mm, J_mm4) {
    return F_N * e_mm * L_mm * L_mm / (8 * STEEL.E * J_mm4);
  }

  /* Условие применимости линейной модели усадочной силы: q/A < 0,6 Дж/мм³. */
  function weldModelOk(q_Jmm, A_mm2) { return q_Jmm / A_mm2 < 0.6; }

  /* Геометрия таврового сечения «поясок + стенка» (без присоединённого
     пояска): bf×sf — поясок, hw×sw — стенка. Отсчёт y от наружной
     поверхности пояска. Возвращает {A, yc, J, h}. */
  function teeSection(bf, sf, hw, sw) {
    var A1 = bf * sf, y1 = sf / 2;
    var A2 = hw * sw, y2 = sf + hw / 2;
    var A = A1 + A2;
    var yc = (A1 * y1 + A2 * y2) / A;
    var J = bf * sf * sf * sf / 12 + A1 * Math.pow(yc - y1, 2)
          + sw * hw * hw * hw / 12 + A2 * Math.pow(y2 - yc, 2);
    return { A: A, yc: yc, J: J, h: sf + hw };
  }

  /* ==================================================================
   *  4. ТОЧНОСТЬ: РАЗМЕРНЫЕ ЦЕПИ
   * ================================================================== */

  /* Метод максимума-минимума: погрешности складываются по модулю.
     d — массив предельных отклонений звеньев (полуполя допуска, мм). */
  function chainMaxMin(d) {
    return d.reduce(function (s, x) { return s + Math.abs(x); }, 0);
  }

  /* Вероятностный метод: Δ = k·√(Σδᵢ²); k = t·λ учитывает выбранный риск и
     закон распределения (для нормального закона и риска 0,27 % k ≈ 1,0…1,2). */
  function chainProb(d, k) {
    var q = d.reduce(function (s, x) { return s + x * x; }, 0);
    return (k === undefined ? 1 : k) * Math.sqrt(q);
  }

  /* Индексы пригодности процесса. tol — полное поле допуска (мм),
     sigma — среднее квадратическое отклонение, shift — смещение центра
     настройки от середины поля. */
  function cp(tol, sigma) { return tol / (6 * sigma); }
  function cpk(tol, sigma, shift) {
    return (tol / 2 - Math.abs(shift || 0)) / (3 * sigma);
  }

  /* Что должно уместиться в припуск на монтажном стыке: накопленная
     погрешность стыкуемых элементов плюс номинальный зазор под сварку. */
  function jointAllowance(dSum, gapNom) { return dSum + gapNom; }

  /* ==================================================================
   *  5. ТРУДОЁМКОСТЬ, ЦИКЛ И ТАКТ
   * ================================================================== */

  /* Трудоёмкость по видам работ: rates = [{kind, rate}] в н·ч/т.
     Возвращает {rows, rate, total}. */
  function labour(Q_t, rates) {
    var rows = rates.map(function (r) {
      return { kind: r.kind, rate: r.rate, hours: Q_t * r.rate, group: r.group };
    });
    var rate = rates.reduce(function (s, r) { return s + r.rate; }, 0);
    return { rows: rows, rate: rate, total: Q_t * rate };
  }

  /* Продолжительность работ в сменах: t = T/(h·P·k), h — часов в смене,
     P — рабочих, k — коэффициент переработки норм. */
  function shifts(T_nh, P, h, k) { return T_nh / ((h || 8) * P * (k || 1)); }

  /* Цикл изготовления при последовательных сборке и сварке. */
  function cycleShifts(Tsb, Psb, Tsv, Psv, h, k) {
    return shifts(Tsb, Psb, h, k) + shifts(Tsv, Psv, h, k);
  }

  /* Пропускная способность одного поста, шт/год: фонд, делённый на цикл. */
  function postThroughput(fundShifts, cycle) { return fundShifts / cycle; }

  /* Такт выпуска: сколько смен приходится на одно изделие при m постах. */
  function takt(fundShifts, N, m) { return fundShifts * m / N; }

  /* Загрузка постов: доля фонда, занятая программой. */
  function postLoad(N, cycle, m, fundShifts) { return N * cycle / (m * fundShifts); }

  /* Экономия трудоёмкости от укрупнения: работа, вынесенная со стапеля
     в цех, дешевле в kSt раз. T — трудоёмкость операции на стапеле. */
  function blockGain(T_stapel, kSt, nJoints) {
    var inShop = T_stapel / kSt;
    return { inShop: inShop, gainOne: T_stapel - inShop,
             gainTotal: (T_stapel - inShop) * nJoints };
  }

  /* ==================================================================
   *  6. СПУСК
   * ================================================================== */

  /* Уклон дорожек i = tg α. Возвращает {alpha, sin, cos, deg}. */
  function slope(i) {
    var a = Math.atan(i);
    return { alpha: a, deg: a * 180 / PI, sin: Math.sin(a), cos: Math.cos(a) };
  }

  /* Давление на спусковые дорожки: p = P·cos α / A, кПа при P в кН. */
  function wayPressure(P_kN, cosA, A_m2) { return P_kN * cosA / A_m2; }

  /* Условие трогания судна с места: tg α > f. */
  function startsMoving(i, f) { return i > f; }

  /* Клиновая модель силы поддержания при продольном спуске.
     Корпус в кормовой оконечности принят вертикальнобортным со средней
     шириной B; судно движется по дорожкам с уклоном α, s — путь, пройденный
     от момента касания кормой уреза воды. Осадка в сечении на расстоянии u
     от кормового среза: d(u) = (s − u)·sin α, откуда
        V = B·sin α·s²/2,  центр величины на s/3 от кормового среза.
     Возвращает {V, D, xc} — объём (м³), силу поддержания (кН) и абсциссу
     центра величины от кормового среза (м). */
  function wedgeBuoyancy(s, B, sinA, rhoW) {
    var V = B * sinA * s * s / 2;
    return { V: V, D: (rhoW || 1.025) * G * V, xc: s / 3 };
  }

  /* Момент силы поддержания относительно носовых копыльев, отстоящих на
     Lp от кормового среза: M = D·(Lp − s/3). */
  function buoyMoment(s, B, sinA, rhoW, Lp) {
    var b = wedgeBuoyancy(s, B, sinA, rhoW);
    return b.D * (Lp - b.xc);
  }

  /* Путь, на котором всплывает корма: момент силы поддержания относительно
     носовых копыльев сравнивается с моментом спускового веса.
     Решается делением пополам на [0, Lp] — функция моментов на этом
     отрезке монотонно растёт от нуля. */
  function sternLiftPath(P_kN, xg, Lp, B, sinA, rhoW) {
    var target = P_kN * (Lp - xg);
    var lo = 0, hi = Lp, mid;
    for (var i = 0; i < 200; i++) {
      mid = (lo + hi) / 2;
      if (buoyMoment(mid, B, sinA, rhoW, Lp) < target) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /* Путь, на котором судно всплывает целиком: D(s) = P. Из
     ρg·B·sinα·s²/2 = P следует s = √(2P/(ρg·B·sinα)). */
  function afloatPath(P_kN, B, sinA, rhoW) {
    return Math.sqrt(2 * P_kN / ((rhoW || 1.025) * G * B * sinA));
  }

  /* Проверка на опрокидывание через порог: к моменту, когда центр тяжести
     проходит над порогом, сила поддержания должна превысить спусковой вес.
     sCG — путь, на котором ЦТ оказывается над порогом. */
  function tipOverCheck(P_kN, sCG, B, sinA, rhoW, kReq) {
    var D = wedgeBuoyancy(sCG, B, sinA, rhoW).D;
    var k = D / P_kN;
    return { D: D, k: k, ok: k >= (kReq === undefined ? 1.05 : kReq) };
  }

  /* Нагрузка на носовые стрелы в момент всплытия кормы: весь спусковой вес
     за вычетом силы поддержания приходится на них. */
  function poppetLoad(P_kN, s, B, sinA, rhoW, area_m2) {
    var D = wedgeBuoyancy(s, B, sinA, rhoW).D;
    var R = P_kN - D;
    return { D: D, R: R, p: R / area_m2 };
  }

  /* ==================================================================
   *  7. ГИБКА И ПРАВКА
   * ================================================================== */

  /* Изгибающий момент полного пластического шарнира в листе:
     M = σт·b·s²/4 (прямоугольное сечение b×s). Н·мм при b, s в мм. */
  function plasticMoment(sigmaT, b_mm, s_mm) {
    return sigmaT * b_mm * s_mm * s_mm / 4;
  }

  /* Усилие на верхнем валке трёхвалковых вальцов: лист как балка на двух
     опорах пролётом a с сосредоточенной силой посередине, M = P·a/4. */
  function rollForce(M_Nmm, a_mm) { return 4 * M_Nmm / a_mm; }

  /* Пружинение при гибке: при разгрузке снимается упругая кривизна
     M/(EJ) = 3σт/(E·s), поэтому 1/Rн = 1/Rк + 3σт/(E·s).
     Возвращает радиус, на который надо гнуть, чтобы получить Rк. */
  function springbackRadius(Rk_mm, s_mm, sigmaT, E) {
    var dk = 3 * (sigmaT || STEEL.sigmaT) / ((E || STEEL.E) * s_mm);
    return 1 / (1 / Rk_mm + dk);
  }

  /* Полный угол погиби (излома), который надо снять при правке балки со
     стрелкой f на базе L: дуга окружности даёт Φ = 8f/L, рад. */
  function bowAngle(f_mm, L_mm) { return 8 * f_mm / L_mm; }

  /* Угол излома от одного нагрева треугольником (клином): основание b у
     выпуклой кромки, высота клина hk; k — доля свободного расширения,
     переходящая в остаточную усадку (учебная оценка, k ≈ 0,5).
        θ = k·α·ΔT·b/hk. */
  function wedgeHeatAngle(b_mm, hk_mm, dT, k, alpha) {
    return (k === undefined ? 0.5 : k) * (alpha || STEEL.alpha) * dT * b_mm / hk_mm;
  }

  /* Число нагревов и их шаг для устранения стрелки f на базе L. */
  function heatStraighten(f_mm, L_mm, b_mm, hk_mm, dT, k, alpha) {
    var need = bowAngle(f_mm, L_mm);
    var one = wedgeHeatAngle(b_mm, hk_mm, dT, k, alpha);
    var n = Math.ceil(need / one);
    return { need: need, one: one, n: n, step: L_mm / n };
  }

  /* ==================================================================
   *  САМОПРОВЕРКА
   * ================================================================== */
  function selftest() {
    var bad = [];
    function near(name, got, want, tol) {
      if (!(Math.abs(got - want) <= tol)) {
        bad.push(name + ': получено ' + got + ', ожидалось ' + want);
      }
    }
    function ok(name, cond) { if (!cond) bad.push(name); }

    /* Плаз: полуокружность — точное значение πR; хорды всегда короче дуги
       и сходятся к ней; оценка по ряду совпадает с точной погрешностью. */
    near('arcLen полуокружность', arcLen(2, PI), 2 * PI, 1e-12);
    near('chordSum n=1, θ=π/2', chordSum(1.5, PI / 2, 1), 1.5 * Math.SQRT2, 1e-12);
    var e4 = straighteningError(1.5, PI / 2, 4);
    ok('хорды короче дуги', e4.chord < e4.arc);
    near('оценка l·φ²/24 при n=4', e4.est, e4.abs, 0.03e-3);
    var e16 = straighteningError(1.5, PI / 2, 16);
    ok('сходимость по n', e16.abs < e4.abs / 15);
    /* Обратная задача согласована с прямой: при найденном n погрешность
       не больше допуска, а при n−1 — уже больше. */
    var nReq = chordsForTolerance(1.5, PI / 2, 1e-3);
    ok('chordsForTolerance укладывается', straighteningError(1.5, PI / 2, nReq).abs <= 1e-3);
    ok('chordsForTolerance не завышено',
       straighteningError(1.5, PI / 2, nReq - 1).abs > 1e-3);
    /* Ломаная по двум точкам — обычное расстояние. */
    near('polylineLen', polylineLen([[0, 0], [3, 4]]), 5, 1e-12);
    /* Обвод из прямой и четверти окружности. */
    var g = girth([{ line: 2.75 }, { arc: { R: 1.5, theta: PI / 2 } }, { line: 2.5 }]);
    near('girth сумма', g.total, 5.25 + 1.5 * PI / 2, 1e-12);
    /* Растяжка: пояса точно покрывают обвод. */
    var bl = beltLayout(7.60619, 2.0);
    near('beltLayout покрытие', bl.n * bl.w, 7.60619, 1e-12);
    ok('beltLayout не шире предела', bl.w <= 2.0 + 1e-12);

    /* Раскрой: тождество массы и обращение КИМ. */
    near('plateMass 1 м² × 10 мм', plateMass(1, 1, 10, 7.85), 78.5, 1e-9);
    near('kim обращение', kim(plateMass(1.9, 7.2, 10, 7.85),
                              plateMass(2.0, 8.0, 10, 7.85)),
         (1.9 * 7.2) / (2.0 * 8.0), 1e-12);
    var nr = nestRect(2.0, 8.0, 0.7, 0.7, 3);
    ok('nestRect 0,7×0,7 на лист 2×8', nr.n === 22);

    /* Сварка: усадочная сила пропорциональна погонной энергии; ε и F
       связаны через площадь и модуль упругости: ε = F/(E·A). */
    near('shrinkForce линейность', shrinkForce(2000), 2 * shrinkForce(1000), 1e-6);
    var Fq = shrinkForce(2387), Aq = 76060;
    near('ε = F/(E·A)', shrinkLongRel(2387, Aq), Fq / (STEEL.E * Aq), 1e-15);
    /* Поперечная усадка обратно пропорциональна толщине. */
    near('ΔW ~ 1/s', shrinkTrans(2000, 20), shrinkTrans(2000, 10) / 2, 1e-12);
    /* Многопроходность: два прохода дают ровно полтора однопроходных. */
    near('ΔW два прохода', shrinkTransPasses(2000, 10, 2),
         1.5 * shrinkTrans(2000, 10), 1e-12);
    /* Тавр: статический момент относительно центра тяжести равен нулю. */
    var t = teeSection(200, 12, 1200, 8);
    var Sc = 200 * 12 * (6 - t.yc) + 1200 * 8 * (612 - t.yc);
    near('teeSection: Σ S относительно ЦТ = 0', Sc, 0, 1e-6);
    /* Момент инерции тавра больше, чем у одной стенки относительно её ЦТ. */
    ok('teeSection J > J стенки', t.J > 8 * Math.pow(1200, 3) / 12);
    /* Прогиб: удвоение силы удваивает стрелку, удвоение J — вдвое меньше. */
    near('camber линейность', camber(2e5, 100, 7200, 1e9),
         2 * camber(1e5, 100, 7200, 1e9), 1e-12);
    ok('weldModelOk', weldModelOk(2387, 76060) && !weldModelOk(2387, 1000));

    /* Точность: цепочка из равных звеньев — точные значения. */
    near('chainMaxMin', chainMaxMin([1, 1, 1, 1]), 4, 1e-12);
    near('chainProb k=1', chainProb([1, 1, 1, 1], 1), 2, 1e-12);
    ok('вероятностный меньше максимума-минимума',
       chainProb([0.5, 1, 1.5, 2, 3, 4], 1.2) < chainMaxMin([0.5, 1, 1.5, 2, 3, 4]));
    near('cp', cp(12, 2), 1.0, 1e-12);
    near('cpk без смещения', cpk(12, 2, 0), cp(12, 2), 1e-12);
    ok('cpk со смещением меньше cp', cpk(12, 2, 1.5) < cp(12, 2));

    /* Трудоёмкость: сумма по видам работ равна произведению массы на
       суммарную удельную норму. */
    var lb = labour(10.8, [{ kind: 'a', rate: 20 }, { kind: 'b', rate: 30 }]);
    near('labour total', lb.total, 10.8 * 50, 1e-9);
    near('shifts', shifts(275.4, 4, 8, 1.1), 275.4 / 35.2, 1e-12);
    /* При m постах, каждый из которых выдаёт fund/cycle изделий, программа
       ровно на m·fund/cycle: тогда загрузка равна единице, а такт — циклу. */
    var cyc = 19.48, fund = 506, m = 20;
    var Nfull = m * postThroughput(fund, cyc);
    near('загрузка при полной программе', postLoad(Nfull, cyc, m, fund), 1, 1e-12);
    near('такт при полной программе', takt(fund, Nfull, m), cyc, 1e-12);

    /* Спуск: уклон 1/20. */
    var sl = slope(1 / 20);
    near('tg α = i', Math.tan(sl.alpha), 0.05, 1e-15);
    near('sin² + cos² = 1', sl.sin * sl.sin + sl.cos * sl.cos, 1, 1e-15);
    ok('трогание', startsMoving(0.05, 0.03) && !startsMoving(0.02, 0.03));
    /* Клиновая модель: объём квадратичен по пути, центр величины на s/3. */
    var w1 = wedgeBuoyancy(50, 14, sl.sin, 1.025);
    var w2 = wedgeBuoyancy(100, 14, sl.sin, 1.025);
    near('V ~ s²', w2.V, 4 * w1.V, 1e-9);
    near('xc = s/3', w2.xc, 100 / 3, 1e-12);
    /* Путь полного всплытия — точное обращение D(s) = P. */
    var P = 3400 * G;
    var sa = afloatPath(P, 14, sl.sin, 1.025);
    near('afloatPath обращает D(s) = P',
         wedgeBuoyancy(sa, 14, sl.sin, 1.025).D, P, 1e-6);
    /* Всплытие кормы — точное решение уравнения моментов. */
    var s1 = sternLiftPath(P, 57, 95, 14, sl.sin, 1.025);
    near('sternLiftPath обращает уравнение моментов',
         buoyMoment(s1, 14, sl.sin, 1.025, 95), P * (95 - 57), 1e-3);
    ok('корма всплывает раньше полного всплытия', s1 < sa);
    /* Нагрузка на стрелы = вес минус сила поддержания. */
    var pl = poppetLoad(P, s1, 14, sl.sin, 1.025, 7.2);
    near('poppetLoad', pl.R + pl.D, P, 1e-6);

    /* Гибка: пружинение обратимо — если гнуть на Rн, получится Rк. */
    var Rn = springbackRadius(1500, 10, 235, 2e5);
    near('пружинение обратимо', 1 / (1 / Rn - 3 * 235 / (2e5 * 10)), 1500, 1e-9);
    ok('гнуть надо круче, чем нужно', Rn < 1500);
    near('plasticMoment', plasticMoment(235, 7200, 10), 235 * 7200 * 100 / 4, 1e-9);
    near('rollForce обращает M = P·a/4',
         rollForce(plasticMoment(235, 7200, 10), 400) * 400 / 4,
         plasticMoment(235, 7200, 10), 1e-6);
    /* Правка: угол погиби дуги и число нагревов. */
    near('bowAngle', bowAngle(9, 7200), 0.01, 1e-15);
    var hs = heatStraighten(9, 7200, 120, 720, 630, 0.5);
    ok('нагревов хватает', hs.n * hs.one >= hs.need);
    ok('нагревов не с запасом на два', (hs.n - 1) * hs.one < hs.need);
    near('шаг нагревов', hs.n * hs.step, 7200, 1e-9);

    return bad;
  }

  return {
    G: G, STEEL: STEEL,
    // плаз
    arcLen: arcLen, chordSum: chordSum, straighteningError: straighteningError,
    chordsForTolerance: chordsForTolerance, polylineLen: polylineLen,
    girth: girth, beltLayout: beltLayout,
    // раскрой
    plateMass: plateMass, nestRect: nestRect, kerfLoss: kerfLoss,
    kim: kim, nestingMap: nestingMap,
    // сварка
    heatInput: heatInput, mhToMms: mhToMms, shrinkForce: shrinkForce,
    shrinkTrans: shrinkTrans, shrinkTransPasses: shrinkTransPasses,
    shrinkLongRel: shrinkLongRel, camber: camber, weldModelOk: weldModelOk,
    teeSection: teeSection,
    // точность
    chainMaxMin: chainMaxMin, chainProb: chainProb, cp: cp, cpk: cpk,
    jointAllowance: jointAllowance,
    // трудоёмкость
    labour: labour, shifts: shifts, cycleShifts: cycleShifts,
    postThroughput: postThroughput, takt: takt, postLoad: postLoad,
    blockGain: blockGain,
    // спуск
    slope: slope, wayPressure: wayPressure, startsMoving: startsMoving,
    wedgeBuoyancy: wedgeBuoyancy, buoyMoment: buoyMoment,
    sternLiftPath: sternLiftPath, afloatPath: afloatPath,
    tipOverCheck: tipOverCheck, poppetLoad: poppetLoad,
    // гибка и правка
    plasticMoment: plasticMoment, rollForce: rollForce,
    springbackRadius: springbackRadius, bowAngle: bowAngle,
    wedgeHeatAngle: wedgeHeatAngle, heatStraighten: heatStraighten,
    selftest: selftest,
  };
}));
