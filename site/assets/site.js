/* Каркас страниц «Технология судостроения». */
'use strict';
(function () {
  const me = document.currentScript;
  const root = (me && me.dataset.root) || './';
  const page = (me && me.dataset.page) || '';
  const logo = `<span style="font-size:24px;line-height:1" aria-hidden="true">🏭</span>`;
  const nav = [
    { h: '', k: 'index', t: 'Обзор' },
    { t: 'Теория', h: 'theory', drop: [
      { h: 'theory', k: 'theory', t: 'Оглавление курса' },
      { h: 't-materials', k: 'theory', t: '1. Материалы и полуфабрикаты' },
      { h: 't-plaz', k: 'theory', t: '2. Плазовые работы' },
      { h: 't-cutting', k: 'theory', t: '3. Обработка деталей' },
      { h: 't-assembly', k: 'theory', t: '4. Сборка и сварка секций' },
      { h: 't-hull-build', k: 'theory', t: '5. Формирование корпуса' },
      { h: 't-launch', k: 'theory', t: '6. Спуск и достройка' },
      { h: 't-quality', k: 'theory', t: '7. Точность и качество' },
    ] },
    { t: 'Задачи', h: 'unfold', drop: [
      { h: 'unfold', k: 'unfold', t: 'Развёртка листов' },
      { h: 'bending', k: 'bending', t: 'Гибка листа обшивки' },
      { h: 'workshop', k: 'workshop', t: 'Пропускная способность цеха' },
      { h: 'lab-hull', k: 'lab-hull', t: 'Формирование корпуса' },
      { h: 'lab-berth', k: 'lab-berth', t: 'Опорно-транспортное устройство' },
      { h: 'lab-dock', k: 'lab-dock', t: 'Накат на плавучий док' },
      { h: 'lab-pipes', k: 'lab-pipes', t: 'Обработка труб' },
      { h: 'lab-insul', k: 'lab-insul', t: 'Теплоизоляция' },
    ] },
    { h: 'sources', k: 'sources', t: 'Источники' },
  ];
  const navLink = (it) =>
    `<a href="${root}${it.h}" class="${page === it.k ? 'on' : ''}">${it.t}</a>`;
  const navHtml = nav.map((g) => {
    if (!g.drop) return navLink(g);
    const on = g.drop.some((it) => page === it.k) ? 'on' : '';
    return `<span class="nav-drop"><a href="${root}${g.h}" class="${on}">${g.t} ▾</a>`
      + `<span class="drop">${g.drop.map(navLink).join('')}</span></span>`;
  }).join('');
  const header = document.createElement('header');
  header.className = 'site';
  header.innerHTML = `<div class="wrap">
    <a class="logo" href="${root}">${logo}<span>Технология судостроения</span></a>
    <nav class="top">${navHtml}</nav>
  </div>`;
  document.body.prepend(header);
  const onReady = (fn) => (document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn) : fn());
  const footer = document.createElement('footer');
  footer.className = 'site';
  footer.innerHTML = `<div class="wrap">
    <div>Учебный сайт по курсу «Технология судостроения» · разборы лабораторных работ с реальными числами</div>
  </div>`;
  onReady(() => document.body.appendChild(footer));
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
  defs.style.position = 'absolute';
  defs.innerHTML = `<defs>
    <marker id="arrE" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 z" fill="#16161a"/></marker>
    <marker id="arrS" markerWidth="10" markerHeight="8" refX="1" refY="4" orient="auto">
      <path d="M10,0 L0,4 L10,8 z" fill="#16161a"/></marker>
  </defs>`;
  onReady(() => document.body.appendChild(defs));
})();
