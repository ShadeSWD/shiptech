/* Каркас страниц «Технология судостроения». */
'use strict';
(function () {
  const me = document.currentScript;
  const root = (me && me.dataset.root) || './';
  const page = (me && me.dataset.page) || '';
  const logo = `<span style="font-size:24px;line-height:1" aria-hidden="true">🏭</span>`;
  const nav = [
    { href: '', key: 'index', title: 'Обзор' },
    { href: 'theory', key: 'theory', title: 'Теория' },
    { href: 'unfold', key: 'unfold', title: 'Развёртка листов' },
    { href: 'bending', key: 'bending', title: 'Гибка листа' },
    { href: 'workshop', key: 'workshop', title: 'Сборочные площади' },
    { href: 'lab-hull', key: 'lab-hull', title: 'Корпус на стапеле' },
    { href: 'lab-berth', key: 'lab-berth', title: 'Опорное устройство' },
    { href: 'lab-dock', key: 'lab-dock', title: 'Накат на док' },
    { href: 'lab-pipes', key: 'lab-pipes', title: 'Трубы' },
    { href: 'lab-insul', key: 'lab-insul', title: 'Изоляция' },
    { href: 'sources', key: 'sources', title: 'Источники' },
  ];
  const header = document.createElement('header');
  header.className = 'site';
  header.innerHTML = `<div class="wrap">
    <a class="logo" href="${root}">${logo}<span>Технология судостроения</span></a>
    <nav class="top">${nav.map(({ href, key, title }) =>
      `<a href="${root}${href}" class="${page === key ? 'on' : ''}">${title}</a>`).join('')}</nav>
  </div>`;
  document.body.prepend(header);
  const footer = document.createElement('footer');
  footer.className = 'site';
  footer.innerHTML = `<div class="wrap">
    <div>Учебный сайт по курсу «Технология судостроения» · разборы лабораторных работ с реальными числами</div>
  </div>`;
  document.body.appendChild(footer);
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
  defs.style.position = 'absolute';
  defs.innerHTML = `<defs>
    <marker id="arrE" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 z" fill="#16161a"/></marker>
    <marker id="arrS" markerWidth="10" markerHeight="8" refX="1" refY="4" orient="auto">
      <path d="M10,0 L0,4 L10,8 z" fill="#16161a"/></marker>
  </defs>`;
  document.body.appendChild(defs);
})();
