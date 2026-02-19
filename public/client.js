(() => {
  let term;

  const termNode = document.getElementById('terminal');
  const hostInput = document.getElementById('host');
  const portInput = document.getElementById('port');
  const connectBtn = document.getElementById('connectBtn');
  const disconnectBtn = document.getElementById('disconnectBtn');
  const statusNode = document.getElementById('status');
  const statusPanelNode = document.getElementById('statusPanel');
  const vitalsNode = document.getElementById('vitals');
  const enemyNode = document.getElementById('enemy');
  const areaNode = document.getElementById('area');
  const roomNode = document.getElementById('room');
  const communicationNode = document.getElementById('communication');
  const mapCanvas = document.getElementById('mapCanvas');
  const mapCtx = mapCanvas ? mapCanvas.getContext('2d') : null;
  const hudHpValue = document.getElementById('hudHpValue');
  const hudHpPct = document.getElementById('hudHpPct');
  const hudHpBar = document.getElementById('hudHpBar');
  const hudSpValue = document.getElementById('hudSpValue');
  const hudSpPct = document.getElementById('hudSpPct');
  const hudSpBar = document.getElementById('hudSpBar');
  const hudCards = Array.from(document.querySelectorAll('.hud-draggable'));

  if (typeof window.Terminal === 'function') {
    term = new window.Terminal({
      cursorBlink: true,
      convertEol: false,
      fontFamily: 'Consolas, Monaco, monospace',
      fontSize: 14,
      theme: {
        background: '#0d1117',
        foreground: '#dbe5ee',
        cursor: '#3fb950',
      },
    });
    term.open(termNode);
    term.focus();
    setupAutoResize();
  } else {
    const listeners = [];
    termNode.tabIndex = 0;
    termNode.focus();
    termNode.addEventListener('click', () => termNode.focus());
    termNode.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter') {
        evt.preventDefault();
        listeners.forEach((fn) => fn('\r'));
        return;
      }
      if (evt.key === 'Backspace') {
        evt.preventDefault();
        listeners.forEach((fn) => fn('\u007F'));
        return;
      }
      if (evt.ctrlKey && evt.key.toLowerCase() === 'c') {
        evt.preventDefault();
        listeners.forEach((fn) => fn('\u0003'));
        return;
      }
      if (evt.key.length === 1 && !evt.ctrlKey && !evt.metaKey) {
        listeners.forEach((fn) => fn(evt.key));
      }
    });

    term = {
      write(data) {
        termNode.textContent += data;
      },
      writeln(data) {
        termNode.textContent += `${data}\n`;
      },
      onData(fn) {
        listeners.push(fn);
      },
    };
    termNode.style.whiteSpace = 'pre-wrap';
  }

  function setupHudDrag() {
    if (!hudCards.length) {
      return;
    }

    for (const card of hudCards) {
      const key = card.dataset.hudKey || card.id || Math.random().toString(36).slice(2);
      const savedXRaw = window.localStorage.getItem(`hud-${key}-x`);
      const savedYRaw = window.localStorage.getItem(`hud-${key}-y`);
      const savedWRaw = window.localStorage.getItem(`hud-${key}-w`);
      const savedHRaw = window.localStorage.getItem(`hud-${key}-h`);
      const savedX = savedXRaw !== null ? Number(savedXRaw) : NaN;
      const savedY = savedYRaw !== null ? Number(savedYRaw) : NaN;
      const savedW = savedWRaw !== null ? Number(savedWRaw) : NaN;
      const savedH = savedHRaw !== null ? Number(savedHRaw) : NaN;
      if (!Number.isNaN(savedX) && !Number.isNaN(savedY)) {
        card.style.left = `${savedX}px`;
        card.style.top = `${savedY}px`;
        card.style.right = 'auto';
      }
      if (!Number.isNaN(savedW) && savedW > 0) {
        card.style.width = `${savedW}px`;
      }
      if (!Number.isNaN(savedH) && savedH > 0) {
        card.style.height = `${savedH}px`;
      }

      let handle = card.querySelector('.hud-handle');
      if (!handle) {
        handle = document.createElement('div');
        handle.className = 'hud-handle';
        card.appendChild(handle);
      }

      let resizeX = card.querySelector('.hud-resize-x');
      if (!resizeX) {
        resizeX = document.createElement('div');
        resizeX.className = 'hud-resize-x';
        card.appendChild(resizeX);
      }

      let resizeY = card.querySelector('.hud-resize-y');
      if (!resizeY) {
        resizeY = document.createElement('div');
        resizeY.className = 'hud-resize-y';
        card.appendChild(resizeY);
      }

      let dragging = false;
      let resizingX = false;
      let resizingY = false;
      let offsetX = 0;
      let offsetY = 0;
      let startW = 0;
      let startH = 0;

      function onPointerDown(event) {
        if (event.button !== 0) {
          return;
        }
        if (event.target === resizeX || event.target === resizeY) {
          resizingX = event.target === resizeX;
          resizingY = event.target === resizeY;
          const rect = card.getBoundingClientRect();
          startW = rect.width;
          startH = rect.height;
          offsetX = event.clientX;
          offsetY = event.clientY;
          card.setPointerCapture(event.pointerId);
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (event.target !== handle) {
          return;
        }
        dragging = true;
        const rect = card.getBoundingClientRect();
        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top;
        card.setPointerCapture(event.pointerId);
      }

      function onPointerMove(event) {
        if (resizingX || resizingY) {
          const deltaX = event.clientX - offsetX;
          const deltaY = event.clientY - offsetY;
          if (resizingX) {
            const nextW = Math.max(180, Math.round(startW + deltaX));
            card.style.width = `${nextW}px`;
          }
          if (resizingY) {
            const nextH = Math.max(100, Math.round(startH + deltaY));
            card.style.height = `${nextH}px`;
          }
          return;
        }
        if (!dragging) {
          return;
        }
        const nextX = Math.max(0, event.clientX - offsetX);
        const nextY = Math.max(0, event.clientY - offsetY);
        card.style.left = `${nextX}px`;
        card.style.top = `${nextY}px`;
        card.style.right = 'auto';
      }

      function onPointerUp(event) {
        if (!dragging && !resizingX && !resizingY) {
          return;
        }
        dragging = false;
        resizingX = false;
        resizingY = false;
        card.releasePointerCapture(event.pointerId);
        const rect = card.getBoundingClientRect();
        window.localStorage.setItem(`hud-${key}-x`, Math.round(rect.left));
        window.localStorage.setItem(`hud-${key}-y`, Math.round(rect.top));
        window.localStorage.setItem(`hud-${key}-w`, Math.round(rect.width));
        window.localStorage.setItem(`hud-${key}-h`, Math.round(rect.height));
      }

      card.addEventListener('pointerdown', onPointerDown);
      card.addEventListener('pointermove', onPointerMove);
      card.addEventListener('pointerup', onPointerUp);
      card.addEventListener('pointercancel', onPointerUp);
    }
  }

  term.writeln('Browser MUD GMCP Client');
  if (typeof window.Terminal !== 'function') {
    term.writeln('xterm.js CDN failed to load. Running minimal fallback terminal.');
  }
  term.writeln('Press Connect to start.');

  let ws = null;
  let lineBuffer = '';
  let replaceMode = false;
  let replaceBuffer = '';
  const gmcpState = {
    affects: {},
    area: {},
    char: { status: {}, vitals: {}, items: {} },
    communication: {},
    enemy: { vitals: {} },
    room: {},
  };
  const mapState = {
    maps: {},
    currentArea: 'default',
    mode: 'local',
  };

  function getAreaKey() {
    const area = gmcpState.area || {};
    const key = area.areaid || area.id || area.short || area.location || 'default';
    return String(key);
  }

  function getCurrentMap() {
    const areaKey = getAreaKey();
    if (!mapState.maps[areaKey]) {
      mapState.maps[areaKey] = {
        nodes: {},
        edges: new Set(),
        currentId: null,
      };
    }
    mapState.currentArea = areaKey;
    return mapState.maps[areaKey];
  }

  function setStatus(text) {
    statusNode.textContent = text;
  }

  function send(event) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }
    ws.send(JSON.stringify(event));
  }

  function normalizeHost(value) {
    const input = String(value || '').trim();
    if (!input) {
      return 'www.thebigwave.net';
    }

    const noScheme = input.replace(/^[a-z]+:\/\//i, '');
    const hostOnly = noScheme.split('/')[0].trim();
    return hostOnly || 'www.thebigwave.net';
  }

  function setupAutoResize() {
    let measure = document.getElementById('xterm-measure');
    if (!measure) {
      measure = document.createElement('span');
      measure.id = 'xterm-measure';
      measure.textContent = 'W';
      measure.style.position = 'absolute';
      measure.style.visibility = 'hidden';
      measure.style.whiteSpace = 'pre';
      measure.style.fontFamily = 'Consolas, Monaco, monospace';
      measure.style.fontSize = '14px';
      document.body.appendChild(measure);
    }

    function fitTerminal() {
      if (!term || !termNode || typeof term.resize !== 'function') {
        return;
      }
      const rect = termNode.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }
      const charWidth = Math.max(1, measure.getBoundingClientRect().width);
      const charHeight = Math.max(1, measure.getBoundingClientRect().height);
      const cols = Math.max(20, Math.floor(rect.width / charWidth));
      const rows = Math.max(5, Math.floor(rect.height / charHeight));
      if (cols !== term.cols || rows !== term.rows) {
        term.resize(cols, rows);
      }
    }

    fitTerminal();
    window.addEventListener('resize', () => {
      fitTerminal();
    });
  }

  function deepMerge(target, source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      return source;
    }

    for (const [key, value] of Object.entries(source)) {
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        target[key] &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key])
      ) {
        deepMerge(target[key], value);
      } else {
        target[key] = value;
      }
    }
    return target;
  }

  function isSnapshotPayload(payload) {
    return Boolean(
      payload &&
      typeof payload === 'object' &&
      (
        Object.prototype.hasOwnProperty.call(payload, 'char') ||
        Object.prototype.hasOwnProperty.call(payload, 'room') ||
        Object.prototype.hasOwnProperty.call(payload, 'area') ||
        Object.prototype.hasOwnProperty.call(payload, 'enemy')
      )
    );
  }

  function stripColorTags(text) {
    return String(text).replace(/\[\/?color(?:=[^\]]+)?\]/gi, '');
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function pick(obj, keys) {
    const out = {};
    for (const key of keys) {
      if (obj && Object.prototype.hasOwnProperty.call(obj, key)) {
        out[key] = obj[key];
      }
    }
    return out;
  }

  function renderKeyValues(obj) {
    if (!obj || typeof obj !== 'object') {
      return '<div class="panel-list">(no data)</div>';
    }
    const rows = Object.entries(obj).map(([key, value]) => {
      const label = escapeHtml(key.replace(/_/g, ' '));
      const formatted = formatValue(value, 0, key);
      const val = typeof formatted === 'string' && formatted.includes('\n')
        ? escapeHtml(formatted).replace(/\n/g, '<br>')
        : escapeHtml(formatted);
      return `<div class="panel-key">${label}</div><div class="panel-value">${val}</div>`;
    });
    return `<div class="panel-grid">${rows.join('')}</div>`;
  }

  function renderList(obj, keys) {
    if (!obj || typeof obj !== 'object') {
      return '<div class="panel-list">(no data)</div>';
    }
    const items = [];
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
        items.push(`<div>${escapeHtml(formatValue(obj[key], 0))}</div>`);
      }
    }
    if (items.length === 0) {
      return '<div class="panel-list">(no data)</div>';
    }
    return `<div class="panel-list">${items.join('')}</div>`;
  }

  function renderVitals(vitals, opts = {}) {
    if (!vitals || typeof vitals !== 'object') {
      return '<div class="panel-list">(no data)</div>';
    }
    const rows = [];

    const hpCur = vitals.hp ?? vitals.HP;
    const hpMax = vitals.max_hp ?? vitals.hp_max ?? vitals.maxhp;
    if (hpCur !== undefined || hpMax !== undefined) {
      const current = Number(hpCur ?? 0);
      const max = Number(hpMax ?? 0);
      const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((current / max) * 100))) : 0;
      const value = max > 0 ? `${formatNumber(current)}/${formatNumber(max)}` : `${formatNumber(current)}`;
      rows.push(
        `<div class="panel-key">HP</div>` +
        `<div class="panel-value">${escapeHtml(value)}</div>` +
        `<div class="bar" style="grid-column:1 / -1;"><span style="width:${pct}%"></span></div>`
      );
    }

    const spCur = vitals.sp ?? vitals.SP;
    const spMax = vitals.max_sp ?? vitals.sp_max ?? vitals.maxsp;
    if (spCur !== undefined || spMax !== undefined) {
      const current = Number(spCur ?? 0);
      const max = Number(spMax ?? 0);
      const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((current / max) * 100))) : 0;
      const value = max > 0 ? `${formatNumber(current)}/${formatNumber(max)}` : `${formatNumber(current)}`;
      rows.push(
        `<div class="panel-key">SP</div>` +
        `<div class="panel-value">${escapeHtml(value)}</div>` +
        `<div class="bar" style="grid-column:1 / -1;"><span style="width:${pct}%"></span></div>`
      );
    }

    const extras = {};
    if (!opts.enemy) {
      if (vitals.xp !== undefined) extras.xp = vitals.xp;
      if (vitals.dam !== undefined) extras.dam = vitals.dam;
      if (vitals.condition !== undefined) extras.condition = vitals.condition;
    } else {
      if (vitals.enemy !== undefined) extras.enemy = vitals.enemy;
    }

    if (Object.keys(extras).length > 0) {
      const extraRows = Object.entries(extras).map(
        ([key, value]) =>
          `<div class="panel-key">${escapeHtml(key.replace(/_/g, ' '))}</div>` +
          `<div class="panel-value">${escapeHtml(formatValue(value, 0))}</div>`
      );
      rows.push(...extraRows);
    }

    if (rows.length === 0) {
      return '<div class="panel-list">(no data)</div>';
    }
    return `<div class="panel-grid">${rows.join('')}</div>`;
  }

  function setHudBar(current, max, valueNode, pctNode, barNode) {
    const cur = Number(current ?? 0);
    const maxVal = Number(max ?? 0);
    const pct = maxVal > 0 ? Math.max(0, Math.min(100, Math.round((cur / maxVal) * 100))) : 0;
    if (valueNode) {
      valueNode.textContent = maxVal > 0 ? `${cur}/${maxVal}` : `${cur}`;
    }
    if (pctNode) {
      pctNode.textContent = `${pct}%`;
    }
    if (barNode) {
      barNode.style.width = `${pct}%`;
    }
  }

  function renderHud(vitals) {
    if (!vitals || typeof vitals !== 'object') {
      setHudBar(0, 0, hudHpValue, hudHpPct, hudHpBar);
      setHudBar(0, 0, hudSpValue, hudSpPct, hudSpBar);
      return;
    }
    const hpMax = vitals.max_hp ?? vitals.hp_max ?? vitals.maxhp;
    const spMax = vitals.max_sp ?? vitals.sp_max ?? vitals.maxsp;
    setHudBar(vitals.hp, hpMax, hudHpValue, hudHpPct, hudHpBar);
    setHudBar(vitals.sp, spMax, hudSpValue, hudSpPct, hudSpBar);
  }

  function titleize(value) {
    return String(value)
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function formatNumber(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return String(value);
    }
    return num.toLocaleString('en-US');
  }

  function formatPercent(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return null;
    }
    const pct = num <= 1 ? num * 100 : num;
    if (!Number.isFinite(pct)) {
      return null;
    }
    return `${Math.round(pct)}%`;
  }

  function renderStatusGrid(obj) {
    if (!obj || typeof obj !== 'object' || Object.keys(obj).length === 0) {
      return '';
    }
    const rows = Object.entries(obj).map(([key, value]) => {
      const label = escapeHtml(key.replace(/_/g, ' '));
      let formatted = value;
      if (typeof value === 'string') {
        if (['class','subclass','race','gender','clan','position','state','alignment','deity'].includes(key)) {
          formatted = titleize(value);
        } else {
          formatted = stripColorTags(value);
        }
      }
      if (typeof value === 'number' || (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value))) {
        formatted = formatNumber(value);
      }
      return `<div class="status-key">${label}</div><div class="status-value">${escapeHtml(String(formatted))}</div>`;
    });
    return `<div class="status-grid">${rows.join('')}</div>`;
  }

  function renderStatus(status) {
    if (!status || typeof status !== 'object') {
      return '<div class="panel-list">(no data)</div>';
    }

    const clean = { ...status };
    delete clean.wizard;
    delete clean.wizlevel;
    delete clean.level;

    const headerNameRaw = clean.short || clean.name || 'Unknown';
    const name = escapeHtml(stripColorTags(headerNameRaw));
    const className = clean.class ? titleize(clean.class) : '';
    const subClass = clean.subclass ? titleize(clean.subclass) : '';
    const race = clean.race ? titleize(clean.race) : '';
    const lineage = [className, subClass, race].filter(Boolean).join(' · ');

    function formatHeroFrac(hero, fract) {
      if (hero === undefined || hero === null) {
        return null;
      }
      const heroNum = Number(hero);
      const fracNum = Number(fract);
      if (!Number.isFinite(heroNum)) {
        return String(hero);
      }
      if (!Number.isFinite(fracNum)) {
        return formatNumber(heroNum);
      }
      const fracPct = fracNum <= 1 ? Math.round(fracNum * 100) : Math.round(fracNum);
      const fracText = String(Math.max(0, Math.min(99, fracPct))).padStart(2, '0');
      return `${formatNumber(heroNum)}.${fracText}`;
    }

    const levelParts = [];
    const currentLevel = clean.currentlevel;
    const heroFract = formatHeroFrac(clean.herolevel, clean.expfract);
    if (currentLevel !== undefined || heroFract) {
      const left = currentLevel !== undefined ? formatNumber(currentLevel) : '0';
      const right = heroFract ? `+${heroFract}` : '';
      levelParts.push(`Level ${left}${right}`);
    }
    if (clean.exptolevel !== undefined) {
      levelParts.push(`To Level ${formatNumber(clean.exptolevel)}`);
    }

    delete clean.currentlevel;
    delete clean.herolevel;
    delete clean.expfract;
    delete clean.exptolevel;
    delete clean.currentexp;
    delete clean.expforlevel;
    delete clean.exp_hour;
    delete clean.exp_min;
    delete clean.totallevel;
    delete clean.damage_taken;
    delete clean.damage_round;
    delete clean.intoxicated;
    delete clean.name;
    delete clean.short;
    delete clean.class;
    delete clean.subclass;
    delete clean.race;

    const detailsKeys = [
      'clan',
      'gender',
      'alignment',
      'deity',
      'position',
      'state',
      'questpoints',
      'gold',
      'gold_bank',
      'gold_house',
    ];

    const details = {};
    for (const key of detailsKeys) {
      if (clean[key] !== undefined) {
        details[key] = clean[key];
        delete clean[key];
      }
    }

    const extra = Object.keys(clean).length > 0 ? clean : null;

    const detailRows = renderStatusGrid(details);
    const extraRows = extra ? renderStatusGrid(extra) : '';

    return `
      <div class="status-header">
        <div class="status-name">${name}</div>
        ${lineage ? `<div class="status-sub">${escapeHtml(lineage)}</div>` : ''}
      </div>
      ${levelParts.length ? `<div class="status-line">${escapeHtml(levelParts.join(' · '))}</div>` : ''}
      ${detailRows}
      ${extraRows ? `<div class="status-divider"></div>${extraRows}` : ''}
    `;
  }

  function renderRoom(room) {
    if (!room || typeof room !== 'object') {
      return '<div class="panel-list">(no data)</div>';
    }
    const info = pick(room, ['name', 'id', 'area', 'zone', 'terrain']);
    const desc = room.desc || room.description || room.long;
    let html = '';
    if (Object.keys(info).length > 0) {
      html += renderKeyValues(info);
    }
    if (desc) {
      html += `${html ? '<div style="height:8px;"></div>' : ''}<div class="panel-list">${escapeHtml(stripColorTags(desc))}</div>`;
    }
    return html || renderKeyValues(room);
  }

  function renderArea(area) {
    if (!area || typeof area !== 'object') {
      return '<div class="panel-list">(no data)</div>';
    }
    const info = pick(area, ['name', 'id', 'zone', 'level', 'location', 'terrain_phrase']);
    return Object.keys(info).length > 0 ? renderKeyValues(info) : renderKeyValues(area);
  }

  function renderCommunication(comm) {
    if (!comm || typeof comm !== 'object') {
      return '<div class="panel-list">(no data)</div>';
    }
    const info = pick(comm, ['channel', 'speaker', 'target', 'timestamp', 'type']);
    const text = comm.text || comm.message;
    let html = '';
    if (Object.keys(info).length > 0) {
      html += renderKeyValues(info);
    }
    if (text) {
      html += `${html ? '<div style="height:8px;"></div>' : ''}<div class="panel-list">${escapeHtml(stripColorTags(text))}</div>`;
    }
    return html || renderKeyValues(comm);
  }

  function normalizeDir(dir) {
    const key = String(dir || '').toLowerCase();
    switch (key) {
      case 'north': return 'n';
      case 'south': return 's';
      case 'east': return 'e';
      case 'west': return 'w';
      case 'northeast': return 'ne';
      case 'northwest': return 'nw';
      case 'southeast': return 'se';
      case 'southwest': return 'sw';
      case 'up': return 'u';
      case 'down': return 'd';
      default: return key;
    }
  }

  function normalizeExitFlags(exits) {
    if (!exits || typeof exits !== 'object') {
      if (typeof exits === 'string') {
        const parsed = exits.split(',').map((s) => s.trim()).filter(Boolean);
        if (parsed.length === 0) {
          return null;
        }
        const mapped = {};
        for (const dir of parsed) {
          mapped[normalizeDir(dir)] = true;
        }
        return mapped;
      }
      return null;
    }
    if (Array.isArray(exits)) {
      const mapped = {};
      for (const dir of exits) {
        mapped[normalizeDir(dir)] = true;
      }
      return mapped;
    }
    const normalized = {};
    for (const [dir, value] of Object.entries(exits)) {
      const key = normalizeDir(dir);
      const truthy = value === true || value === 1 || value === '1' || value === 'open';
      if (truthy || normalized[key] === undefined) {
        normalized[key] = truthy;
      }
    }
    return normalized;
  }

  function normalizeExitIds(exitIds, exits) {
    if (!exitIds || typeof exitIds !== 'object') {
      return {};
    }
    const mapped = {};
    const exitFlags = normalizeExitFlags(exits);
    for (const [dir, id] of Object.entries(exitIds)) {
      if (!id) {
        continue;
      }
      const key = normalizeDir(dir);
      if (exitFlags && exitFlags[key] === false) {
        continue;
      }
      mapped[key] = String(id);
    }
    return mapped;
  }

  function getDirDelta(dir) {
    switch (dir) {
      case 'n':
      case 'north':
        return [0, -1];
      case 's':
      case 'south':
        return [0, 1];
      case 'e':
      case 'east':
        return [1, 0];
      case 'w':
      case 'west':
        return [-1, 0];
      case 'ne':
      case 'northeast':
        return [1, -1];
      case 'nw':
      case 'northwest':
        return [-1, -1];
      case 'se':
      case 'southeast':
        return [1, 1];
      case 'sw':
      case 'southwest':
        return [-1, 1];
      case 'u':
      case 'up':
        return [0, -2];
      case 'd':
      case 'down':
        return [0, 2];
      default:
        return null;
    }
  }

  function resetMap(currentMap) {
    currentMap.nodes = {};
    currentMap.edges = new Set();
    currentMap.currentId = null;
  }

  function updateMapFromRoom(room) {
    if (!room || typeof room !== 'object' || !room.id) {
      return;
    }
    const currentMap = getCurrentMap();
    const roomId = String(room.id);
    const label = stripColorTags(room.short || room.name || room.id);
    if (mapState.mode === 'local') {
      resetMap(currentMap);
    }
    if (!currentMap.nodes[roomId]) {
      currentMap.nodes[roomId] = { x: 0, y: 0, label };
    } else {
      currentMap.nodes[roomId].label = label;
    }
    currentMap.currentId = roomId;

    const exits = normalizeExitIds(room.exit_ids || {}, room.exits || {});
    const base = currentMap.nodes[roomId];
    for (const [dir, targetId] of Object.entries(exits)) {
      const delta = getDirDelta(dir);
      if (!delta) {
        continue;
      }
      if (!currentMap.nodes[targetId]) {
        currentMap.nodes[targetId] = {
          x: base.x + delta[0],
          y: base.y + delta[1],
          label: stripColorTags(targetId.split('/').pop() || targetId),
        };
      }
      const edgeKey = [roomId, targetId].sort().join('|');
      currentMap.edges.add(edgeKey);
    }
  }

  function resizeCanvasToFit() {
    if (!mapCanvas) {
      return;
    }
    const rect = mapCanvas.getBoundingClientRect();
    if (rect.width && rect.height) {
      mapCanvas.width = Math.floor(rect.width);
      mapCanvas.height = Math.floor(rect.height);
    }
  }

  function drawMap() {
    if (!mapCanvas || !mapCtx) {
      return;
    }
    const currentMap = getCurrentMap();
    resizeCanvasToFit();
    const width = mapCanvas.width;
    const height = mapCanvas.height;
    mapCtx.clearRect(0, 0, width, height);
    mapCtx.fillStyle = '#0b1220';
    mapCtx.fillRect(0, 0, width, height);

    const nodes = Object.entries(currentMap.nodes);
    if (!nodes.length) {
      mapCtx.fillStyle = '#6b7280';
      mapCtx.font = '12px Consolas, Monaco, monospace';
      mapCtx.fillText('No map data yet', 10, 20);
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, node] of nodes) {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    }

    const padding = 24;
    const grid = 70;
    const rangeX = Math.max(1, maxX - minX + 1);
    const rangeY = Math.max(1, maxY - minY + 1);
    const scaleX = (width - padding * 2) / (rangeX * grid);
    const scaleY = (height - padding * 2) / (rangeY * grid);
    const scale = Math.max(0.4, Math.min(1.2, Math.min(scaleX, scaleY)));

    function toScreen(node) {
      const x = padding + (node.x - minX) * grid * scale;
      const y = padding + (node.y - minY) * grid * scale;
      return { x, y };
    }

    mapCtx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    mapCtx.lineWidth = 2;
    for (const edgeKey of currentMap.edges) {
      const [a, b] = edgeKey.split('|');
      const nodeA = currentMap.nodes[a];
      const nodeB = currentMap.nodes[b];
      if (!nodeA || !nodeB) {
        continue;
      }
      const aPos = toScreen(nodeA);
      const bPos = toScreen(nodeB);
      mapCtx.beginPath();
      mapCtx.moveTo(aPos.x, aPos.y);
      mapCtx.lineTo(bPos.x, bPos.y);
      mapCtx.stroke();
    }

    for (const [id, node] of nodes) {
      const pos = toScreen(node);
      const isCurrent = id === currentMap.currentId;
      const w = 52 * scale;
      const h = 28 * scale;
      mapCtx.fillStyle = isCurrent ? '#1f6feb' : '#111827';
      mapCtx.strokeStyle = isCurrent ? '#7aa2ff' : 'rgba(148, 163, 184, 0.35)';
      mapCtx.lineWidth = 2;
      mapCtx.shadowColor = isCurrent ? 'rgba(122, 162, 255, 0.6)' : 'transparent';
      mapCtx.shadowBlur = isCurrent ? 12 : 0;
      mapCtx.beginPath();
      if (typeof mapCtx.roundRect === 'function') {
        mapCtx.roundRect(pos.x - w / 2, pos.y - h / 2, w, h, 6);
      } else {
        mapCtx.rect(pos.x - w / 2, pos.y - h / 2, w, h);
      }
      mapCtx.fill();
      mapCtx.stroke();
      mapCtx.shadowBlur = 0;

      mapCtx.fillStyle = '#e5e7eb';
      mapCtx.font = `${Math.max(10, 11 * scale)}px Consolas, Monaco, monospace`;
      const label = (node.label || id).slice(0, 10);
      mapCtx.fillText(label, pos.x - w / 2 + 6, pos.y + 4);
    }
  }
  function renderPanels() {
    statusPanelNode.innerHTML = renderStatus(gmcpState.char.status || {});
    vitalsNode.innerHTML = renderVitals(gmcpState.char.vitals || {});
    enemyNode.innerHTML = renderVitals(gmcpState.enemy.vitals || {}, { enemy: true });
    areaNode.innerHTML = renderArea(gmcpState.area || {});
    roomNode.innerHTML = renderRoom(gmcpState.room || {});
    communicationNode.innerHTML = renderCommunication(gmcpState.communication || {});
    updateMapFromRoom(gmcpState.room || {});
    drawMap();
    renderHud(gmcpState.char.vitals || {});
  }

  function formatItemList(items) {
    if (!Array.isArray(items)) {
      return null;
    }
    const lines = [];
    for (const item of items) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const name = stripColorTags(item.short || item.name || item.item || item.title);
      if (!name) {
        continue;
      }
      const count = Number(item.count ?? item.qty ?? item.quantity ?? 1);
      const safeCount = Number.isFinite(count) && count > 0 ? count : 1;
      lines.push(`${safeCount} x ${name}`);
    }
    if (lines.length === 0) {
      return null;
    }
    return lines;
  }

  function formatItemMap(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return null;
    }
    const lines = [];
    for (const value of Object.values(obj)) {
      if (!value || typeof value !== 'object') {
        continue;
      }
      const name = stripColorTags(value.short || value.name || value.item || value.title);
      if (!name) {
        continue;
      }
      const count = Number(value.count ?? value.qty ?? value.quantity ?? 1);
      const safeCount = Number.isFinite(count) && count > 0 ? count : 1;
      lines.push(`${safeCount} x ${name}`);
    }
    if (lines.length === 0) {
      return null;
    }
    return lines;
  }

  function extractItemLines(items) {
    if (!items) {
      return [];
    }
    if (Array.isArray(items)) {
      return formatItemList(items) || [];
    }
    if (items.list && Array.isArray(items.list)) {
      return formatItemList(items.list) || [];
    }
    if (items.items && Array.isArray(items.items)) {
      return formatItemList(items.items) || [];
    }
    const mapped = formatItemMap(items);
    if (mapped) {
      return mapped;
    }
    return [];
  }

  function formatValue(value, depth, keyHint) {
    if (value === null || value === undefined) {
      return String(value);
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      if (typeof value === 'string') {
        return stripColorTags(value);
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value.toLocaleString('en-US');
      }
      return String(value);
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return '[]';
      }
      const compact = formatItemList(value);
      if (compact) {
        return compact.join('\n');
      }
      if (typeof keyHint === 'string' && /items|inventory|contents|list/i.test(keyHint)) {
        return value.map((entry) => formatValue(entry, depth + 1)).join(', ');
      }
      return value.map((entry) => formatValue(entry, depth + 1)).join(', ');
    }
    if (typeof value === 'object') {
      if (typeof keyHint === 'string' && /items|inventory|contents|list/i.test(keyHint)) {
        const compactMap = formatItemMap(value);
        if (compactMap) {
          return compactMap.join('\n');
        }
        if (value.short || value.name || value.item || value.title) {
          const name = stripColorTags(value.short || value.name || value.item || value.title);
          const count = Number(value.count ?? value.qty ?? value.quantity ?? 1);
          const safeCount = Number.isFinite(count) && count > 0 ? count : 1;
          return `${safeCount} x ${name}`;
        }
      }
      const indent = '  '.repeat(depth);
      const lines = [];
      for (const [key, entry] of Object.entries(value)) {
        const formatted = formatValue(entry, depth + 1, key);
        if (typeof entry === 'object' && entry !== null && !Array.isArray(entry)) {
          lines.push(`${indent}${key}:`);
          lines.push(`${indent}  ${formatted}`);
        } else {
          lines.push(`${indent}${key}: ${formatted}`);
        }
      }
      return lines.join('\n');
    }
    return String(value);
  }

  function applyModuleUpdate(module, payload) {
    const key = String(module || '').toLowerCase();

    if (!payload || typeof payload !== 'object') {
      return;
    }

    if (key === 'char.status') {
      deepMerge(gmcpState.char.status, payload);
    } else if (key === 'char.vitals') {
      deepMerge(gmcpState.char.vitals, payload);
    } else if (key === 'char.items') {
      deepMerge(gmcpState.char.items, payload);
    } else if (key === 'enemy.vitals') {
      deepMerge(gmcpState.enemy.vitals, payload);
    } else if (key === 'room.info' || key === 'room') {
      deepMerge(gmcpState.room, payload);
    } else if (key === 'area.info' || key === 'area') {
      deepMerge(gmcpState.area, payload);
    } else if (key === 'char.affects' || key === 'affects') {
      deepMerge(gmcpState.affects, payload);
    } else if (key === 'comm.channel' || key === 'communication') {
      deepMerge(gmcpState.communication, payload);
    } else if (isSnapshotPayload(payload)) {
      deepMerge(gmcpState, payload);
    }
  }

  renderPanels();
  setupHudDrag();
  if (mapCanvas && typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => drawMap());
    observer.observe(mapCanvas);
  }

  function connect() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      setStatus('Already connected to proxy');
      return;
    }

    const hasHost = Boolean(window.location.host);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = hasHost ? `${protocol}//${window.location.host}` : 'ws://localhost:8080';
    setStatus(`Opening proxy socket ${wsUrl}`);
    ws = new WebSocket(wsUrl);

    ws.addEventListener('open', () => {
      setStatus('Connected to proxy');
      send({
        type: 'connect',
        host: normalizeHost(hostInput.value),
        port: Number(portInput.value.trim() || 23),
      });
    });

    ws.addEventListener('message', (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }

      if (msg.type === 'text') {
        term.write(msg.data);
      } else if (msg.type === 'status') {
        setStatus(msg.message);
      } else if (msg.type === 'disconnect') {
        setStatus('Disconnected');
      } else if (msg.type === 'gmcp') {
        applyModuleUpdate(msg.module, msg.payload);
        renderPanels();
      }
    });

    ws.addEventListener('close', (evt) => {
      setStatus(`Proxy socket closed (code ${evt.code})`);
    });

    ws.addEventListener('error', () => {
      setStatus('Proxy WebSocket error');
    });
  }

  function disconnect() {
    if (!ws) {
      return;
    }
    send({ type: 'disconnect' });
    ws.close();
    ws = null;
    setStatus('Disconnected');
  }

  connectBtn.addEventListener('click', connect);
  disconnectBtn.addEventListener('click', disconnect);
  connect();

  term.onData((data) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    if (replaceMode) {
      if (data === '\r') {
        // Repeat last command without editing.
      } else {
        term.write('\x1b[2K\r');
        lineBuffer = '';
        replaceMode = false;
      }
    }

    if (data === '\r') {
      send({ type: 'input', data: lineBuffer + '\n' });
      term.write('\r\n');
      if (lineBuffer.length > 0) {
        replaceBuffer = lineBuffer;
        lineBuffer = replaceBuffer;
        replaceMode = true;
        term.write(`\x1b[7m${replaceBuffer}\x1b[0m`);
      } else {
        lineBuffer = '';
        replaceMode = false;
      }
      return;
    }

    if (data === '\u007F') {
      if (replaceMode) {
        term.write('\x1b[2K\r');
        lineBuffer = '';
        replaceMode = false;
        return;
      }
      if (lineBuffer.length > 0) {
        lineBuffer = lineBuffer.slice(0, -1);
        term.write('\b \b');
      }
      return;
    }

    if (data === '\u0003') {
      send({ type: 'input', data: '\u0003' });
      return;
    }

    lineBuffer += data;
    term.write(data);
  });

  window.addEventListener('beforeunload', () => {
    disconnect();
  });
})();

