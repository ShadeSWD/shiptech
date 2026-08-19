/* Данные каркаса страниц. Машинерия — assets/shell.js. */
'use strict';
(function () {
  const me = document.currentScript;
  const root = (me && me.dataset.root) || './';
  buildSiteShell({
    root,
    page: (me && me.dataset.page) || '',
    brand: 'Технология судостроения',
    logo: `<span style="font-size:24px;line-height:1" aria-hidden="true">🏭</span>`,
    nav: [
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
    ],
    footer: `<div>Учебный сайт по курсу «Технология судостроения» · разборы лабораторных работ с реальными числами</div>`,
    markers: `<marker id="arrE" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 z" fill="#16161a"/></marker>
    <marker id="arrS" markerWidth="10" markerHeight="8" refX="1" refY="4" orient="auto">
      <path d="M10,0 L0,4 L10,8 z" fill="#16161a"/></marker>`,
  });
})();
