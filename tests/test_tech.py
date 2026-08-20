# -*- coding: utf-8 -*-
"""Проверка расчётного ядра site/assets/tech.js.

Модуль tech.js — единственное место, где живут формулы разборов задач
(p-*.html). Ошибка в нём не поймается ни проверкой ссылок, ни разбором
HTML: страницы останутся валидными, а числа станут неверными. Поэтому
здесь проверяется сама арифметика, причём двумя независимыми способами:

  * встроенная самопроверка TECH.selftest() — контрольные точки, посчитанные
    аналитически (полуокружность, обратимость пружинения, точное решение
    уравнения моментов при спуске, тождество ε = F/(EA));
  * пересчёт ключевых величин на Python по формулам, выписанным здесь
    заново, — так опечатка в JS не может «подтвердить сама себя».

Дополнительно проверяется, что числа, напечатанные на страницах разборов,
совпадают с тем, что выдаёт модуль: страница и модуль не должны разъезжаться.
"""
import json
import math
import os
import shutil
import subprocess

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TECH_JS = os.path.join(ROOT, 'site', 'assets', 'tech.js')
SITE = os.path.join(ROOT, 'site')

pytestmark = [
    pytest.mark.skipif(not os.path.isfile(TECH_JS), reason='нет site/assets/tech.js'),
    pytest.mark.skipif(not shutil.which('node'), reason='node не установлен'),
]

#: физические постоянные, выписанные здесь заново (сверять с STEEL в tech.js)
ALPHA = 0.12e-4          # 1/°C
CG = 0.0047              # Дж/(мм³·°C)
E = 2.0e5                # МПа
KX = 0.3354              # коэффициент Окерблома
G = 9.81                 # м/с²


def tech(expr):
    """Выполнить выражение в node с загруженным модулем и вернуть результат."""
    src = 'const T = require(%s); console.log(JSON.stringify(%s));' % (
        json.dumps(TECH_JS), expr)
    r = subprocess.run(['node', '-e', src], capture_output=True, text=True)
    assert r.returncode == 0, 'node упал: %s' % r.stderr.strip()[:400]
    return json.loads(r.stdout.strip())


# ---------------------------------------------------------------- самопроверка

def test_selftest_passes():
    bad = tech('T.selftest()')
    assert bad == [], 'самопроверка модуля нашла расхождения:\n' + '\n'.join(bad)


def test_constants_match_welding_site():
    """Коэффициенты сварочных деформаций обязаны совпадать с /welding/:
    два сайта кластера не должны давать разные числа на одной задаче."""
    st = tech('T.STEEL')
    assert st['alpha'] == ALPHA
    assert st['cg'] == CG
    assert st['E'] == E


# ------------------------------------------- независимый пересчёт на Python
#     ПЛАЗ

#: обвод скуловой секции СК-6: прямая днища, четверть окружности, прямая борта
GIRTH_LINE1 = 2.750
GIRTH_R = 1.5
GIRTH_LINE2 = 2.500


def py_girth():
    return GIRTH_LINE1 + GIRTH_R * math.pi / 2 + GIRTH_LINE2


def test_girth():
    js = tech('T.girth([{line:2.750},{arc:{R:1.5,theta:Math.PI/2}},{line:2.500}]).total')
    assert js == pytest.approx(py_girth(), rel=1e-12)
    assert js == pytest.approx(7.60619, abs=5e-6)


@pytest.mark.parametrize('n,expect_mm', [(1, 234.87), (3, 26.82), (4, 15.11),
                                         (8, 3.78), (16, 0.95)])
def test_straightening_error(n, expect_mm):
    """Потеря длины при спрямлении дуги n хордами: l − n·2R·sin(θ/2n)."""
    theta = math.pi / 2
    py = GIRTH_R * theta - n * 2 * GIRTH_R * math.sin(theta / (2 * n))
    js = tech('T.straighteningError(1.5, Math.PI/2, %d).abs' % n)
    assert js == pytest.approx(py, rel=1e-12)
    assert js * 1000 == pytest.approx(expect_mm, abs=0.01)


def test_straightening_estimate_converges():
    """Оценка Δ ≈ l·φ²/24 сходится к точной погрешности при росте n."""
    for n in (4, 8, 16, 32):
        r = tech('T.straighteningError(1.5, Math.PI/2, %d)' % n)
        assert r['est'] == pytest.approx(r['abs'], rel=0.01 / n * 4)


def test_chords_for_tolerance():
    """Обратная задача согласована с прямой: n — минимальное число хорд."""
    n = tech('T.chordsForTolerance(1.5, Math.PI/2, 0.001)')
    assert n == 16
    assert tech('T.straighteningError(1.5, Math.PI/2, %d).abs' % n) <= 0.001
    assert tech('T.straighteningError(1.5, Math.PI/2, %d).abs' % (n - 1)) > 0.001


def test_polyline_misclosure():
    """Обвод, снятый по шести точкам теоретического чертежа, короче точного
    ровно на погрешность спрямления скулы тремя хордами."""
    pts = [[3.400, 0.0], [6.150, 0.0]]
    for k in (1, 2):
        th = k * math.pi / 6
        pts.append([6.150 + 1.5 * math.sin(th), 1.5 - 1.5 * math.cos(th)])
    pts += [[7.650, 1.500], [7.650, 4.000]]
    py = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts, pts[1:]))
    js = tech('T.polylineLen(%s)' % json.dumps(pts))
    assert js == pytest.approx(py, rel=1e-12)
    miss = py_girth() - js
    assert miss * 1000 == pytest.approx(26.8, abs=0.1)
    assert miss == pytest.approx(
        tech('T.straighteningError(1.5, Math.PI/2, 3).abs'), rel=1e-9)


def test_belt_layout():
    """Обвод 7606 мм листом 2000 мм с припуском 25 мм на кромку — 4 пояса."""
    r = tech('T.beltLayout(7.60619, 1.950)')
    assert r['n'] == 4 and r['seams'] == 3
    assert r['w'] * 1000 == pytest.approx(1901.5, abs=0.1)


# ------------------------------------------------------------------ РАСКРОЙ

def test_plate_mass():
    """Лист 2×8 м толщиной 10 мм из стали 7,85 т/м³ весит 1256 кг."""
    assert tech('T.plateMass(8.0, 2.0, 10, 7.85)') == pytest.approx(1256.0, rel=1e-12)
    assert tech('T.plateMass(1, 1, 1, 7.85)') == pytest.approx(7.85, rel=1e-12)


def test_nest_rect_accounts_for_kerf():
    """Две детали по 3000 мм с резом 3 мм в лист 6000 мм уже не влезают."""
    assert tech('T.nestRect(2.5, 6.0, 3.020, 1.210, 3).n') == 2
    assert tech('T.nestRect(2.5, 8.0, 3.020, 1.210, 3).n') == 4
    assert tech('T.nestRect(2.5, 6.0, 3.000, 1.200, 0).n') == 4


def test_nesting_map_belt():
    """Карта раскроя пояса обшивки: КИМ 0,861 без добора и 0,922 с добором."""
    one = tech("T.nestingMap({L:8.0,B:2.0,s:10},"
               "[{name:'пояс',L:7.230,B:1.905,n:1}],{kerf:3})")
    assert one['plateMass'] == pytest.approx(1256.0, rel=1e-12)
    assert one['partsMass'] == pytest.approx(1081.2, abs=0.1)
    assert one['kim'] == pytest.approx(1.905 * 7.230 / 16.0, rel=1e-12)
    assert one['kim'] == pytest.approx(0.8608, abs=5e-5)

    both = tech("T.nestingMap({L:8.0,B:2.0,s:10},"
                "[{name:'пояс',L:7.230,B:1.905,n:1},"
                " {name:'бракета',L:0.7,B:0.7,n:2}],{kerf:3})")
    assert both['kim'] == pytest.approx(0.9221, abs=5e-5)
    assert both['cutLen'] == pytest.approx(2 * (7.230 + 1.905) + 4 * 1.4, rel=1e-12)
    assert both['kerfMass'] == pytest.approx(5.62, abs=0.02)
    # баланс массы листа сходится
    assert (both['partsMass'] + both['kerfMass'] + both['scrapMass']
            == pytest.approx(both['plateMass'], rel=1e-12))


# ------------------------------------------------------------------- СВАРКА

def py_heat_input(eta, U, I, v_mh):
    return eta * U * I / (v_mh * 1000 / 3600)


def test_heat_input():
    """Автомат под флюсом: 650 А, 34 В, 30 м/ч, η = 0,9 → 2387 Дж/мм."""
    py = py_heat_input(0.9, 34, 650, 30)
    js = tech('T.heatInput(0.9, 34, 650, T.mhToMms(30))')
    assert js == pytest.approx(py, rel=1e-12)
    assert js == pytest.approx(2386.8, abs=0.1)


def test_shrink_force_and_strain():
    """F = 0,3354·α·q·E/(cγ); ε = F/(E·A) — тождество, а не совпадение."""
    q = 2386.8
    py_F = KX * ALPHA * q * E / CG
    assert tech('T.shrinkForce(2386.8)') == pytest.approx(py_F, rel=1e-12)
    assert tech('T.shrinkForce(2386.8)') / 1000 == pytest.approx(408.8, abs=0.1)
    A = 7606 * 10
    eps = tech('T.shrinkLongRel(2386.8, %d)' % A)
    assert eps == pytest.approx(KX * ALPHA * q / (CG * A), rel=1e-12)
    assert eps == pytest.approx(py_F / (E * A), rel=1e-12)
    assert eps * 7200 == pytest.approx(0.1935, abs=0.001)


def test_shrink_trans():
    """ΔW = α·q/(cγ·s); два прохода — полтора однопроходных."""
    q = 2386.8
    assert tech('T.shrinkTrans(2386.8, 10)') == pytest.approx(
        ALPHA * q / (CG * 10), rel=1e-12)
    assert tech('T.shrinkTrans(2386.8, 10)') == pytest.approx(0.6094, abs=1e-4)
    assert tech('T.shrinkTransPasses(2386.8, 10, 2)') == pytest.approx(0.9141, abs=1e-4)
    assert 3 * tech('T.shrinkTransPasses(2386.8, 10, 2)') == pytest.approx(2.742, abs=1e-3)


def py_tee(bf, sf, hw, sw):
    A1, y1 = bf * sf, sf / 2
    A2, y2 = hw * sw, sf + hw / 2
    A = A1 + A2
    yc = (A1 * y1 + A2 * y2) / A
    J = (bf * sf ** 3 / 12 + A1 * (yc - y1) ** 2
         + sw * hw ** 3 / 12 + A2 * (y2 - yc) ** 2)
    return A, yc, J


def test_tee_section():
    """Тавр 200×12 + 1200×8: центр тяжести 490,8 мм, J = 1,857·10⁹ мм⁴."""
    A, yc, J = py_tee(200, 12, 1200, 8)
    js = tech('T.teeSection(200, 12, 1200, 8)')
    assert js['A'] == pytest.approx(A, rel=1e-12)
    assert js['yc'] == pytest.approx(yc, rel=1e-12)
    assert js['J'] == pytest.approx(J, rel=1e-12)
    assert js['yc'] == pytest.approx(490.80, abs=0.01)
    assert js['J'] == pytest.approx(1.8571e9, rel=1e-3)


def test_camber_of_stringer():
    """Погибь тавра от эксцентричной усадочной силы растёт как квадрат длины."""
    A, yc, J = py_tee(200, 12, 1200, 8)
    q = py_heat_input(0.8, 30, 280, 20)
    F = 2 * KX * ALPHA * q * E / CG
    e = yc - 12
    py72 = F * e * 7200 ** 2 / (8 * E * J)
    js72 = tech('(()=>{const t=T.teeSection(200,12,1200,8);'
                'const F=2*T.shrinkForce(T.heatInput(0.8,30,280,T.mhToMms(20)));'
                'return T.camber(F, t.yc-12, 7200, t.J);})()')
    assert js72 == pytest.approx(py72, rel=1e-12)
    assert js72 == pytest.approx(3.461, abs=0.002)
    js12 = tech('(()=>{const t=T.teeSection(200,12,1200,8);'
                'const F=2*T.shrinkForce(T.heatInput(0.8,30,280,T.mhToMms(20)));'
                'return T.camber(F, t.yc-12, 12000, t.J);})()')
    assert js12 / js72 == pytest.approx((12000 / 7200) ** 2, rel=1e-12)
    assert js12 == pytest.approx(9.614, abs=0.005)
    # ручная дуговая сварка на 8 м/ч — та же балка длиной 12 м
    jsr = tech('(()=>{const t=T.teeSection(200,12,1200,8);'
               'const F=2*T.shrinkForce(T.heatInput(0.75,26,220,T.mhToMms(8)));'
               'return T.camber(F, t.yc-12, 12000, t.J);})()')
    assert jsr == pytest.approx(15.344, abs=0.01)


def test_weld_model_validity():
    assert tech('T.weldModelOk(2386.8, 76060)') is True
    assert tech('T.weldModelOk(2386.8, 3000)') is False


# ----------------------------------------------------------------- ТОЧНОСТЬ

CHAIN = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]


def test_chain_methods():
    assert tech('T.chainMaxMin(%s)' % json.dumps(CHAIN)) == pytest.approx(10.5, rel=1e-12)
    py = 1.2 * math.sqrt(sum(x * x for x in CHAIN))
    assert tech('T.chainProb(%s, 1.2)' % json.dumps(CHAIN)) == pytest.approx(py, rel=1e-12)
    assert tech('T.chainProb(%s, 1.2)' % json.dumps(CHAIN)) == pytest.approx(5.724, abs=0.002)


def test_process_indices():
    """Cp и Cpk: при нулевом смещении совпадают, при смещении Cpk меньше."""
    sigma = 5.724 / 3
    assert tech('T.cp(20, %r)' % sigma) == pytest.approx(20 / (6 * sigma), rel=1e-12)
    assert tech('T.cp(20, %r)' % sigma) == pytest.approx(1.747, abs=0.002)
    assert tech('T.cpk(20, %r, 0)' % sigma) == pytest.approx(tech('T.cp(20, %r)' % sigma))
    assert tech('T.cpk(20, %r, 2.5)' % sigma) == pytest.approx(1.310, abs=0.002)


# ------------------------------------------------------------ ТРУДОЁМКОСТЬ

RATES = [1.2, 2.0, 3.5, 25.5, 28.5, 4.0, 2.3]


def test_labour_and_cycle():
    Q = 9.5
    total = tech('T.labour(9.5, %s).total'
                 % json.dumps([{'kind': str(i), 'rate': r} for i, r in enumerate(RATES)]))
    assert total == pytest.approx(Q * sum(RATES), rel=1e-12)
    assert total == pytest.approx(636.5, abs=0.1)
    cyc = tech('T.cycleShifts(9.5*25.5, 4, 9.5*28.5, 3, 8, 1.10)')
    py = Q * 25.5 / (8 * 4 * 1.10) + Q * 28.5 / (8 * 3 * 1.10)
    assert cyc == pytest.approx(py, rel=1e-12)
    assert cyc == pytest.approx(17.14, abs=0.01)


def test_takt_and_load_are_consistent():
    """При загрузке 1,0 такт равен циклу — это одно и то же утверждение."""
    cyc, fund, m = 17.138, 506, 10
    N = m * fund / cyc
    assert tech('T.postLoad(%r, %r, %d, %d)' % (N, cyc, m, fund)) == pytest.approx(1, rel=1e-9)
    assert tech('T.takt(%d, %r, %d)' % (fund, N, m)) == pytest.approx(cyc, rel=1e-9)
    # программа 288 секций в год: 10 постов дают загрузку 0,975
    assert tech('T.postLoad(288, 17.138, 10, 506)') == pytest.approx(0.975, abs=0.002)
    assert tech('T.postLoad(288, 17.138, 11, 506)') == pytest.approx(0.887, abs=0.002)


# --------------------------------------------------------------------- СПУСК

SLOPE = 1 / 20
B_EFF = 13.0
RHO_W = 1.025
P_LAUNCH = 3200 * G          # кН


def py_wedge_D(s):
    sina = math.sin(math.atan(SLOPE))
    return RHO_W * G * B_EFF * sina * s * s / 2


def test_slope():
    r = tech('T.slope(1/20)')
    assert math.tan(r['alpha']) == pytest.approx(0.05, rel=1e-12)
    assert r['deg'] == pytest.approx(2.862, abs=0.001)
    assert r['sin'] == pytest.approx(0.04994, abs=1e-5)


def test_way_pressure():
    """Два полоза 90 × 1,0 м под спусковой массой 3200 т — 174 кПа."""
    r = tech('T.wayPressure(3200*9.81, T.slope(1/20).cos, 180)')
    assert r == pytest.approx(P_LAUNCH * math.cos(math.atan(SLOPE)) / 180, rel=1e-12)
    assert r == pytest.approx(174.2, abs=0.2)


def test_wedge_buoyancy():
    js = tech('T.wedgeBuoyancy(82.23, 13.0, T.slope(1/20).sin, 1.025)')
    assert js['D'] == pytest.approx(py_wedge_D(82.23), rel=1e-12)
    assert js['xc'] == pytest.approx(82.23 / 3, rel=1e-12)


def test_afloat_path_inverts_buoyancy():
    s = tech('T.afloatPath(3200*9.81, 13.0, T.slope(1/20).sin, 1.025)')
    assert py_wedge_D(s) == pytest.approx(P_LAUNCH, rel=1e-9)
    assert s == pytest.approx(98.07, abs=0.02)


def test_stern_lift_solves_moment_equation():
    """Всплытие кормы: D(s)·(Lp − s/3) = P·(Lp − x_g)."""
    s1 = tech('T.sternLiftPath(3200*9.81, 46.0, 90.0, 13.0, T.slope(1/20).sin, 1.025)')
    assert s1 == pytest.approx(82.23, abs=0.02)
    assert py_wedge_D(s1) * (90.0 - s1 / 3) == pytest.approx(
        P_LAUNCH * (90.0 - 46.0), rel=1e-6)
    # доля силы поддержания в момент всплытия кормы — те самые 70 %,
    # которые в главе 6 приняты «пусть»
    assert py_wedge_D(s1) / P_LAUNCH == pytest.approx(0.703, abs=0.003)


def test_poppet_load():
    r = tech('(()=>{const sl=T.slope(1/20);'
             'const s=T.sternLiftPath(3200*9.81,46.0,90.0,13.0,sl.sin,1.025);'
             'return T.poppetLoad(3200*9.81, s, 13.0, sl.sin, 1.025, 6.4);})()')
    assert r['R'] == pytest.approx(P_LAUNCH - py_wedge_D(82.23), rel=1e-3)
    assert r['p'] / 1000 == pytest.approx(1.457, abs=0.005)


def test_tip_over_check():
    """При подводной части дорожек 40 м судно доходит до порога, не всплыв."""
    bad = tech('T.tipOverCheck(3200*9.81, 46.0+40.0, 13.0, T.slope(1/20).sin, 1.025, 1.05)')
    assert bad['k'] == pytest.approx(0.769, abs=0.003) and bad['ok'] is False
    good = tech('T.tipOverCheck(3200*9.81, 46.0+55.0, 13.0, T.slope(1/20).sin, 1.025, 1.05)')
    assert good['k'] == pytest.approx(1.061, abs=0.003) and good['ok'] is True


# --------------------------------------------------------- ГИБКА И ПРАВКА

def test_roll_force():
    M = tech('T.plasticMoment(235, 7200, 10)')
    assert M == pytest.approx(235 * 7200 * 100 / 4, rel=1e-12)
    P = tech('T.rollForce(T.plasticMoment(235, 7200, 10), 400)')
    assert P == pytest.approx(4 * M / 400, rel=1e-12)
    assert P / 1000 == pytest.approx(423.0, abs=0.5)


def test_springback_is_invertible():
    """Гибка на R_н даёт после разгрузки ровно R_к = 1500 мм."""
    Rn = tech('T.springbackRadius(1500, 10, 235, 2e5)')
    assert Rn == pytest.approx(1 / (1 / 1500 + 3 * 235 / (2e5 * 10)), rel=1e-12)
    assert Rn == pytest.approx(981.2, abs=0.2)
    back = 1 / (1 / Rn - 3 * 235 / (2e5 * 10))
    assert back == pytest.approx(1500, rel=1e-9)


def test_heat_straighten():
    """Стрелка 15,34 мм на базе 12 м снимается 17 клиньями с шагом 706 мм."""
    r = tech('T.heatStraighten(15.344, 12000, 120, 720, 630, 0.5)')
    assert r['need'] == pytest.approx(8 * 15.344 / 12000, rel=1e-12)
    assert r['one'] == pytest.approx(0.5 * ALPHA * 630 * 120 / 720, rel=1e-12)
    assert r['n'] == 17
    assert r['step'] == pytest.approx(12000 / 17, rel=1e-12)
    # число нагревов — минимальное достаточное
    assert r['n'] * r['one'] >= r['need']
    assert (r['n'] - 1) * r['one'] < r['need']


# --------------------------------------- согласование страниц и модуля

#: (файл разбора, строка, которая должна на нём присутствовать)
PAGE_NUMBERS = [
    ('p-plaz.html', '7606'),
    ('p-plaz.html', '1901,5'),
    ('p-plaz.html', '26,8'),
    ('p-nesting.html', '1256,0'),
    ('p-nesting.html', '0,922'),
    ('p-nesting.html', '0,861'),
    ('p-weld.html', '2387'),
    ('p-weld.html', '408,8'),
    ('p-weld.html', '0,914'),
    ('p-weld.html', '3,46'),
    ('p-bend.html', '423'),
    ('p-bend.html', '981'),
    ('p-bend.html', '17'),
    ('p-tol.html', '10,5'),
    ('p-tol.html', '5,72'),
    ('p-cycle.html', '636,5'),
    ('p-cycle.html', '17,1'),
    ('p-launch.html', '82,2'),
    ('p-launch.html', '98,07'),
    ('p-launch.html', '1,46'),
]


@pytest.mark.parametrize('page,needle', PAGE_NUMBERS,
                         ids=['%s:%s' % (p, n) for p, n in PAGE_NUMBERS])
def test_page_shows_computed_number(page, needle):
    """Числа, полученные модулем, должны стоять и в тексте разбора."""
    path = os.path.join(SITE, page)
    if not os.path.isfile(path):
        pytest.skip('страница %s ещё не создана' % page)
    with open(path, encoding='utf-8') as fh:
        html = fh.read()
    assert needle in html, 'на странице %s нет значения «%s»' % (page, needle)


def test_key_answers_are_reproducible():
    """Ключевые ответы всех семи разборов пересчитываются модулем «с нуля»."""
    got = tech("""(() => {
      const g = T.girth([{line:2.750},{arc:{R:1.5,theta:Math.PI/2}},{line:2.500}]).total;
      const bl = T.beltLayout(g, 1.950);
      const map = T.nestingMap({L:8.0,B:2.0,s:10},
        [{name:'пояс',L:7.230,B:1.905,n:1},{name:'бракета',L:0.7,B:0.7,n:2}],{kerf:3});
      const qAF = T.heatInput(0.9, 34, 650, T.mhToMms(30));
      const t = T.teeSection(200, 12, 1200, 8);
      const qPA = T.heatInput(0.8, 30, 280, T.mhToMms(20));
      const sl = T.slope(1/20), P = 3200*9.81;
      const s1 = T.sternLiftPath(P, 46.0, 90.0, 13.0, sl.sin, 1.025);
      return {
        girth: g,
        belts: bl.n, beltW: bl.w*1000,
        miss: (g - T.polylineLen([[3.4,0],[6.15,0],
               [6.15+1.5*Math.sin(Math.PI/6), 1.5-1.5*Math.cos(Math.PI/6)],
               [6.15+1.5*Math.sin(Math.PI/3), 1.5-1.5*Math.cos(Math.PI/3)],
               [7.65,1.5],[7.65,4.0]]))*1000,
        kim: map.kim,
        q: qAF, Fs: T.shrinkForce(qAF)/1000,
        dW3: 3*T.shrinkTransPasses(qAF, 10, 2),
        camber: T.camber(2*T.shrinkForce(qPA), t.yc-12, 7200, t.J),
        chainMM: T.chainMaxMin([0.5,1,1.5,2,2.5,3]),
        chainP: T.chainProb([0.5,1,1.5,2,2.5,3], 1.2),
        labour: T.labour(9.5, [{kind:'x',rate:67.0}]).total,
        cycle: T.cycleShifts(9.5*25.5, 4, 9.5*28.5, 3, 8, 1.10),
        sternLift: s1,
        afloat: T.afloatPath(P, 13.0, sl.sin, 1.025),
        poppet: T.poppetLoad(P, s1, 13.0, sl.sin, 1.025, 6.4).p/1000,
        rollP: T.rollForce(T.plasticMoment(235, 7200, 10), 400)/1000,
        Rn: T.springbackRadius(1500, 10, 235, 2e5),
        heats: T.heatStraighten(15.344, 12000, 120, 720, 630, 0.5).n,
      };
    })()""")
    assert got['girth'] == pytest.approx(7.60619, abs=5e-6)
    assert got['belts'] == 4
    assert got['beltW'] == pytest.approx(1901.5, abs=0.1)
    assert got['miss'] == pytest.approx(26.8, abs=0.1)
    assert got['kim'] == pytest.approx(0.9221, abs=5e-5)
    assert got['q'] == pytest.approx(2386.8, abs=0.1)
    assert got['Fs'] == pytest.approx(408.8, abs=0.1)
    assert got['dW3'] == pytest.approx(2.742, abs=0.002)
    assert got['camber'] == pytest.approx(3.461, abs=0.002)
    assert got['chainMM'] == pytest.approx(10.5, abs=0.01)
    assert got['chainP'] == pytest.approx(5.724, abs=0.002)
    assert got['labour'] == pytest.approx(636.5, abs=0.1)
    assert got['cycle'] == pytest.approx(17.14, abs=0.01)
    assert got['sternLift'] == pytest.approx(82.23, abs=0.02)
    assert got['afloat'] == pytest.approx(98.07, abs=0.02)
    assert got['poppet'] == pytest.approx(1.457, abs=0.005)
    assert got['rollP'] == pytest.approx(423.0, abs=0.5)
    assert got['Rn'] == pytest.approx(981.2, abs=0.2)
    assert got['heats'] == 17
