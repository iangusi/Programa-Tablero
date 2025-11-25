// ------------------ Configuración inicial ------------------
const AUTS = {
  A: { start: 1, goal: 16, color: 'A' },
  B: { start: 4, goal: 13, color: 'B' },
  C: { start: 3, goal: 14, color: 'C' }
};

// Ajustes de rendimiento/seguridad
const MAX_MOVES = 100;
const EXPANSION_LIMIT = 300000;

// DOM
const boardEl = document.getElementById('board');
const svg = document.getElementById('svg');

// Soporte campo global antiguo (opcional) y NUEVOS campos por autómata
const patternInput   = document.getElementById('patternInput');   // legacy (opcional)
const patternAInput  = document.getElementById('patternA');       // nuevo
const patternBInput  = document.getElementById('patternB');       // nuevo
const patternCInput  = document.getElementById('patternC');       // nuevo

const nInput = document.getElementById('nInput');
const modeSelect = document.getElementById('modeSelect');
const runAutoBtn = document.getElementById('runAutoBtn');

const generateBtn = document.getElementById('generateBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const startSimBtn = document.getElementById('startSimBtn');
const pauseSimBtn = document.getElementById('pauseSimBtn');
const resetBtn = document.getElementById('resetBtn');
const logEl = document.getElementById('log');

const downloadAllA = document.getElementById('downloadAllA');
const downloadWinA = document.getElementById('downloadWinA');
const downloadAllB = document.getElementById('downloadAllB');
const downloadWinB = document.getElementById('downloadWinB');
const downloadAllC = document.getElementById('downloadAllC');
const downloadWinC = document.getElementById('downloadWinC');

const nfaSvgA = document.getElementById('nfaSvgA');
const nfaSvgB = document.getElementById('nfaSvgB');
const nfaSvgC = document.getElementById('nfaSvgC');

let cells = [];
let cellCenters = {};

function log(msg) {
  const p = document.createElement('div');
  p.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
  logEl.prepend(p);
}

// ---------- Tablero ----------
function createBoard() {
  boardEl.innerHTML = '';
  cells = [];
  for (let i = 1; i <= 16; i++) {
    const r = Math.floor((i - 1) / 4),
      c = (i - 1) % 4;
    const color = (r + c) % 2 === 0 ? 'white' : 'black';
    const cell = document.createElement('div');
    cell.className = 'cell ' + color;
    cell.dataset.idx = i;
    cell.innerHTML = `<div class="num">${i}</div>`;
    boardEl.appendChild(cell);
    cells.push(cell);
  }
  setTimeout(() => {
    const rect = boardEl.getBoundingClientRect();
    for (const cell of cells) {
      const crect = cell.getBoundingClientRect();
      const cx = crect.left - rect.left + crect.width / 2;
      const cy = crect.top - rect.top + crect.height / 2;
      const idx = Number(cell.dataset.idx);
      cellCenters[idx] = { x: cx, y: cy };
    }
    svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
  }, 50);
}
createBoard();

function placePieces() {
  document.querySelectorAll('.piece').forEach((n) => n.remove());
  for (const key of Object.keys(AUTS)) {
    const start = AUTS[key].start;
    const el = document.createElement('div');
    el.className = `piece ${AUTS[key].color}`;
    el.id = 'piece-' + key;
    el.textContent = key;
    const cell = document.querySelector(`.cell[data-idx='${start}']`);
    cell.appendChild(el);
  }
}
placePieces();

function cellColor(idx) {
  const r = Math.floor((idx - 1) / 4),
    c = (idx - 1) % 4;
  return (r + c) % 2 === 0 ? 'b' : 'n';
}
function neighbors(idx) {
  const r = Math.floor((idx - 1) / 4),
    c = (idx - 1) % 4;
  const coords = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr,
        nc = c + dc;
      if (nr >= 0 && nr < 4 && nc >= 0 && nc < 4) coords.push(nr * 4 + nc + 1);
    }
  }
  return coords;
}

// ---------- Rutas ----------
function findAllRoutes(start, n, pattern, goal) {
  const all = [],
    wins = [];
  let expansions = 0;
  function dfs(path, step) {
    if (expansions >= EXPANSION_LIMIT) return;
    if (step > n) {
      all.push(path.slice());
      if (path[path.length - 1] === goal) wins.push(path.slice());
      return;
    }
    const cur = path[path.length - 1];
    for (const nx of neighbors(cur)) {
      if (expansions >= EXPANSION_LIMIT) break;
      const required = pattern[step - 1];
      const col = cellColor(nx);
      if (col === required || (step === n && nx === goal)) {
        expansions++;
        path.push(nx);
        dfs(path, step + 1);
        path.pop();
      }
    }
  }
  dfs([start], 1);
  if (expansions >= EXPANSION_LIMIT)
    log(`⚠️ Límite de expansión (${EXPANSION_LIMIT}) alcanzado.`);
  return { all, wins };
}

function downloadText(filename, lines) {
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

let ROUTES = {
  A: { all: [], wins: [] },
  B: { all: [], wins: [] },
  C: { all: [], wins: [] },
};
let chosenRoute = { A: null, B: null, C: null };
let chosenRouteIdx = { A: 0, B: 0, C: 0 };
let timelineColors = { A: [], B: [], C: [] };
let occupied = {};

function randomPattern(n) {
  const s = [];
  for (let i = 0; i < n; i++) s.push(Math.random() < 0.5 ? 'b' : 'n');
  return s.join('');
}

// ---------- Timelines ----------
function renderTimeline(key, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const route = chosenRoute[key] || [];
  const cols = timelineColors[key] || [];
  const track = document.createElement('div');
  track.className = 'track';
  for (let i = 0; i < route.length; i++) {
    const s = document.createElement('div');
    s.className = 'step';
    s.style.background = cols[i] || '#999';
    s.textContent = route[i];
    track.appendChild(s);
  }
  container.appendChild(track);
}

const PALETTES = {
  A: ['#2b8cff', '#6c5ce7', '#00a8ff', '#74b9ff', '#341f97'],
  B: ['#ff7b4a', '#ff6b6b', '#f39c12', '#ff9f1a', '#b23a48'],
  C: ['#6fd36f', '#00cec9', '#1dd1a1', '#10ac84', '#2ed573'],
};
const LINE_BASE_COLORS = {
  A: PALETTES.A[0],
  B: PALETTES.B[0],
  C: PALETTES.C[0],
};
function nextColorFor(key) {
  const used = new Set(timelineColors[key] || []);
  for (const c of PALETTES[key]) if (!used.has(c)) return c;
  return PALETTES[key][Math.floor(Math.random() * PALETTES[key].length)];
}

// ---------- Dibujo rutas tablero ----------
function drawRoutesSVG() {
  svg.innerHTML = '';
  for (const key of Object.keys(AUTS)) {
    const route = chosenRoute[key];
    if (!route) continue;
    const cols = timelineColors[key] || [];
    for (let i = 1; i < route.length; i++) {
      const p1 = cellCenters[route[i - 1]],
        p2 = cellCenters[route[i]];
      if (!p1 || !p2) continue;
      const line = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'line'
      );
      line.setAttribute('x1', p1.x);
      line.setAttribute('y1', p1.y);
      line.setAttribute('x2', p2.x);
      line.setAttribute('y2', p2.y);
      line.setAttribute('stroke', cols[i] || LINE_BASE_COLORS[key]);
      line.setAttribute('stroke-width', 5);
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('stroke-opacity', '0.9');
      svg.appendChild(line);
    }
  }
}

// ---------- NFA (ganadoras, DAG por capas) ----------
let NFATree = {
  A: { nodes: [], edges: [] },
  B: { nodes: [], edges: [] },
  C: { nodes: [], edges: [] },
};
let NFASvgMap = { A: nfaSvgA, B: nfaSvgB, C: nfaSvgC };
let NFAEdgeEls = { A: {}, B: {}, C: {} };

// Construye un grafo por capas (step 0..n) usando SOLO rutas ganadoras,
// unificando cada nodo por (step, state) y permitiendo múltiples padres.
function buildNFATrees() {
  NFATree = {
    A: { nodes: [], edges: [] },
    B: { nodes: [], edges: [] },
    C: { nodes: [], edges: [] },
  };

  for (const key of Object.keys(AUTS)) {
    const wins = (ROUTES[key].wins || []).filter(r => r.length >= 2);

    // Mapa único por (step, state) -> nodeId = `${step}-${state}`
    const nodesByStepState = new Map(); // k: `${step}-${state}` -> { id, step, state }
    const ensureNode = (step, state) => {
      const id = `${step}-${state}`;
      if (!nodesByStepState.has(id)) {
        nodesByStepState.set(id, { id, step, state });
      }
      return nodesByStepState.get(id);
    };

    const edges = []; // { from:{step,state,id}, to:{step,state,id} }

    // Insertar TODAS las rutas ganadoras
    for (const route of wins) {
      for (let i = 0; i < route.length - 1; i++) {
        const fromState = route[i];
        const toState   = route[i + 1];
        const fromNode  = ensureNode(i,   fromState);
        const toNode    = ensureNode(i+1, toState);
        edges.push({
          from: { step: fromNode.step, state: fromNode.state, id: fromNode.id },
          to:   { step: toNode.step,   state: toNode.state,   id: toNode.id   }
        });
      }
    }

    // Guardar en NFATree
    const nodes = Array.from(nodesByStepState.values()).sort((a,b) =>
      a.step - b.step || a.state - b.state
    );
    NFATree[key] = { nodes, edges };
  }
}

function drawTreeFor(key, colorBase) {
  const svgEl = NFASvgMap[key];
  svgEl.innerHTML = '';
  NFAEdgeEls[key] = {};

  const { nodes, edges } = NFATree[key];
  if (nodes.length === 0) return;

  // Layout por capas (columnas = step)
  const maxStep = Math.max(...nodes.map(n => n.step));
  const W = 900, H = 280, PADX = 60, PADY = 20;
  const colW = (W - 2 * PADX) / Math.max(1, maxStep || 1);

  // Agrupar nodos por step y ordenarlos por state para estética
  const layerMap = new Map();
  for (let s = 0; s <= maxStep; s++) {
    layerMap.set(s, nodes.filter(n => n.step === s).sort((a,b) => a.state - b.state));
  }

  // Posiciones: id = `${step}-${state}`
  const pos = {};
  for (let s = 0; s <= maxStep; s++) {
    const layer = layerMap.get(s);
    const rows = layer.length || 1;
    for (let i = 0; i < layer.length; i++) {
      const id = layer[i].id;
      const x = PADX + colW * s;
      const y = PADY + (rows <= 1 ? (H / 2) : (i + 1) * ((H - 2 * PADY) / (rows + 1)));
      pos[id] = { x, y };
    }
  }

  // Dibujar aristas (múltiples padres pueden llegar al mismo nodo destino)
  for (const e of edges) {
    const p1 = pos[e.from.id], p2 = pos[e.to.id];
    if (!p1 || !p2) continue;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', p1.x); line.setAttribute('y1', p1.y);
    line.setAttribute('x2', p2.x); line.setAttribute('y2', p2.y);
    line.setAttribute('stroke', colorBase);
    line.setAttribute('stroke-width', 2.5);
    line.setAttribute('stroke-opacity', '0.35');
    line.setAttribute('stroke-linecap', 'round');
    svgEl.appendChild(line);

    // Guardar varias líneas bajo la misma clave (step:from->to) para highlight
    const keyStr = `${e.from.step}:${e.from.state}->${e.to.state}`;
    if (!NFAEdgeEls[key][keyStr]) NFAEdgeEls[key][keyStr] = [];
    NFAEdgeEls[key][keyStr].push(line);
  }

  // Dibujar nodos
  for (const n of nodes) {
    const p = pos[n.id]; if (!p) continue;
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', p.x); circle.setAttribute('cy', p.y);
    circle.setAttribute('r', 13); circle.setAttribute('class', 'nfa-node');
    svgEl.appendChild(circle);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', p.x); label.setAttribute('y', p.y + 4);
    label.setAttribute('text-anchor', 'middle'); label.setAttribute('class', 'nfa-label');
    label.textContent = n.state;
    svgEl.appendChild(label);

    const stepT = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    stepT.setAttribute('x', p.x); stepT.setAttribute('y', p.y - 18);
    stepT.setAttribute('text-anchor', 'middle'); stepT.setAttribute('class', 'nfa-label');
    stepT.setAttribute('font-size', '9'); stepT.setAttribute('fill', '#64748b');
    stepT.textContent = `t=${n.step}`;
    svgEl.appendChild(stepT);
  }
}

function drawNFATrees() {
  drawTreeFor('A', LINE_BASE_COLORS.A);
  drawTreeFor('B', LINE_BASE_COLORS.B);
  drawTreeFor('C', LINE_BASE_COLORS.C);
}

function highlightTreeEdge(key, step, fromState, toState) {
  const arr = NFAEdgeEls[key]?.[`${step}:${fromState}->${toState}`];
  if (!arr || arr.length === 0) return;
  for (const el of arr) {
    el.setAttribute('stroke', '#0b1220');
    el.setAttribute('stroke-width', 5);
    el.setAttribute('stroke-opacity', '0.9');
    setTimeout(() => {
      el.setAttribute('stroke', LINE_BASE_COLORS[key]);
      el.setAttribute('stroke-width', 2.5);
      el.setAttribute('stroke-opacity', '0.35');
    }, 600);
  }
}

// ---------- Generar todo ----------
function generateAll() {
  // Limpia y valida solo b/n
  const cleanPattern = (p) => (p || '')
    .trim()
    .toLowerCase()
    .replace(/[^bn]/g, '');

  const makeRandom = (n) =>
    Array.from({ length: n }, () => (Math.random() < 0.5 ? 'b' : 'n')).join('');

  // Leer patrones individuales si existen en el HTML
  let pA = patternAInput ? cleanPattern(patternAInput.value) : '';
  let pB = patternBInput ? cleanPattern(patternBInput.value) : '';
  let pC = patternCInput ? cleanPattern(patternCInput.value) : '';

  // Fallback al patrón global antiguo si no se ingresó ninguno individual
  const globalPattern = patternInput ? cleanPattern(patternInput.value) : '';
  if (!pA && !pB && !pC && globalPattern) {
    pA = pB = pC = globalPattern;
  }

  // Determinar n
  let n = Number(nInput.value) || 0;
  const lengths = [pA.length, pB.length, pC.length].filter((x) => x > 0);

  if (lengths.length === 0) {
    // No ingresaron patrones -> se requiere n
    if (!n) {
      alert('Introduce n o al menos un patrón por autómata.');
      return null;
    }
    if (n > MAX_MOVES) {
      alert('n demasiado grande. Se limita a ' + MAX_MOVES);
      n = MAX_MOVES;
      nInput.value = n;
    }
    // Generar tres patrones aleatorios de longitud n
    pA = makeRandom(n);
    pB = makeRandom(n);
    pC = makeRandom(n);
    if (patternAInput) patternAInput.value = pA;
    if (patternBInput) patternBInput.value = pB;
    if (patternCInput) patternCInput.value = pC;
    if (patternInput)  patternInput.value  = ''; // ya no se usa el global
  } else {
    // Hay al menos un patrón
    n = lengths[0];

    // Si alguno está vacío, autogenerarlo del mismo largo n
    if (pA.length === 0) pA = makeRandom(n);
    if (pB.length === 0) pB = makeRandom(n);
    if (pC.length === 0) pC = makeRandom(n);

    // Validar igualdad de longitudes
    if (!(pA.length === pB.length && pB.length === pC.length)) {
      alert('Todos los patrones (A, B y C) deben tener la MISMA longitud.');
      return null;
    }

    // Límite superior
    if (n > MAX_MOVES) {
      alert('n demasiado grande. Se limita a ' + MAX_MOVES);
      n = MAX_MOVES;
      pA = pA.slice(0, n);
      pB = pB.slice(0, n);
      pC = pC.slice(0, n);
      if (patternAInput) patternAInput.value = pA;
      if (patternBInput) patternBInput.value = pB;
      if (patternCInput) patternCInput.value = pC;
    }

    if (patternInput) patternInput.value = ''; // limpiar global si existía
  }

  // Log de patrones finales
  log(`Patrón A: ${pA}`);
  log(`Patrón B: ${pB}`);
  log(`Patrón C: ${pC}`);
  log(`n = ${n} — generando rutas por autómata...`);

  // Generar rutas por autómata con SU patrón
  for (const [k, v] of Object.entries(AUTS)) {
    const pat = k === 'A' ? pA : k === 'B' ? pB : pC;
    const res = findAllRoutes(v.start, n, pat, v.goal);
    ROUTES[k].all = res.all;
    ROUTES[k].wins = res.wins;
    log(`${k}: total=${res.all.length}, ganadoras=${res.wins.length}`);
  }

  // Habilitar descargas y simulación
  downloadAllBtn.disabled = false;
  startSimBtn.disabled = false;

  // Elegir ruta ganadora por autómata (si existe)
  let anyNoWins = false;
  for (const k of Object.keys(AUTS)) {
    if (ROUTES[k].wins.length > 0) {
      const idx = Math.floor(Math.random() * ROUTES[k].wins.length);
      chosenRoute[k] = ROUTES[k].wins[idx].slice();
      const c = nextColorFor(k);
      timelineColors[k] = Array(chosenRoute[k].length).fill(c);
    } else {
      chosenRoute[k] = null;
      anyNoWins = true;
    }
  }
  if (anyNoWins) log('⚠️ Uno o más autómatas no tienen rutas ganadoras.');

  // Reset visual y dibujo
  placePieces();
  occupied = {};
  for (const k of Object.keys(AUTS)) occupied[AUTS[k].start] = k;

  renderTimeline('A', 'timelineA');
  renderTimeline('B', 'timelineB');
  renderTimeline('C', 'timelineC');
  drawRoutesSVG();

  buildNFATrees();
  drawNFATrees();

  return { n, patternA: pA, patternB: pB, patternC: pC };
}

generateBtn.addEventListener('click', () => generateAll());

// ---------- Simulación ----------
let simInterval = null;
let turnOrder = [];
let turnIdx = 0;
let finished = {};

function startSimulation() {
  turnOrder = Object.keys(AUTS).filter((k) => chosenRoute[k] != null);
  if (turnOrder.length === 0) {
    alert('Ningún autómata tiene rutas ganadoras.');
    return;
  }
  for (let i = turnOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [turnOrder[i], turnOrder[j]] = [turnOrder[j], turnOrder[i]];
  }
  log('Orden: ' + turnOrder.join(', '));
  for (const k of Object.keys(AUTS)) {
    chosenRouteIdx[k] = 0;
    finished[k] = false;
  }
  startSimBtn.disabled = true;
  pauseSimBtn.disabled = false;
  simInterval = setInterval(simStep, 700);
}

startSimBtn.addEventListener('click', startSimulation);

pauseSimBtn.addEventListener('click', () => {
  if (simInterval) {
    clearInterval(simInterval);
    simInterval = null;
    pauseSimBtn.textContent = 'Continuar';
  } else {
    simInterval = setInterval(simStep, 700);
    pauseSimBtn.textContent = 'Pausar';
  }
});

resetBtn.addEventListener('click', () => {
  if (simInterval) clearInterval(simInterval);
  simInterval = null;
  startSimBtn.disabled = false;
  pauseSimBtn.disabled = true;
  placePieces();
  svg.innerHTML = '';
  drawNFATrees();
  log('Simulación reiniciada.');
});

function endSimulation() {
  if (simInterval) clearInterval(simInterval);
  simInterval = null;
  startSimBtn.disabled = false;
  pauseSimBtn.disabled = true;
  log('Simulación finalizada.');
}

function movePiece(key, toIdx) {
  let curPos = null;
  for (const i of Object.keys(AUTS)) {
    const pieceEl = document.getElementById('piece-' + i);
    if (!pieceEl) continue;
    const parentCell = pieceEl.closest('.cell');
    if (parentCell) {
      const idx = Number(parentCell.dataset.idx);
      if (i === key) curPos = idx;
    }
  }
  if (curPos != null) delete occupied[curPos];
  const pieceEl = document.getElementById('piece-' + key);
  const targetCell = document.querySelector(`.cell[data-idx='${toIdx}']`);
  if (targetCell && pieceEl) {
    targetCell.appendChild(pieceEl);
    occupied[toIdx] = key;
  }
  drawRoutesSVG();
}

function simStep() {
  if (turnOrder.length === 0) return;
  const curKey = turnOrder[turnIdx % turnOrder.length];
  turnIdx++;
  if (finished[curKey]) {
    if (Object.values(finished).every((v) => v)) endSimulation();
    return;
  }
  const curIdx = chosenRouteIdx[curKey];
  const route = chosenRoute[curKey];
  if (!route) return;
  if (curIdx >= route.length - 1) {
    finished[curKey] = true;
    log(`${curKey} ya terminó su ruta.`);
    if (Object.values(finished).every((v) => v)) endSimulation();
    return;
  }
  const from = route[curIdx];
  const desired = route[curIdx + 1];
  if (occupied[desired] && occupied[desired] !== curKey) {
    log(`${curKey} no puede moverse, casilla ocupada.`);
  } else {
    movePiece(curKey, desired);
    chosenRouteIdx[curKey]++;
    highlightTreeEdge(curKey, curIdx, from, desired);
    if (chosenRouteIdx[curKey] >= route.length - 1) {
      finished[curKey] = true;
      log(`${curKey} terminó su ruta y GANÓ!`);
      endSimulation();
    }
  }
}

// ---------- Automático ----------
function runAutomatic() {
  const res = generateAll();
  if (!res) return;
  startSimulation();
}
if (runAutoBtn) {
  runAutoBtn.addEventListener('click', () => {
    if (modeSelect && modeSelect.value !== 'auto') {
      alert('Selecciona "Automático (todo)" en Modo.');
      return;
    }
    runAutomatic();
  });
}

// Responsive
window.addEventListener('resize', () => {
  createBoard();
  placePieces();
  setTimeout(() => {
    drawRoutesSVG();
    drawNFATrees();
  }, 80);
});
