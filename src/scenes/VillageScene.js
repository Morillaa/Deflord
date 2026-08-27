import Phaser from 'phaser';

const TILE_SIZE = 64;
const GRID_COLS = 10;
const GRID_ROWS = 8;
const GRID_WIDTH = GRID_COLS * TILE_SIZE;
const GRID_HEIGHT = GRID_ROWS * TILE_SIZE;

const HUD_HEIGHT = 58;
const GRID_TOP = HUD_HEIGHT + 8;
const PANEL_HEIGHT = 110;
const PANEL_GAP = 12;

const MAX_WORKERS_PER_BUILDING = 2;

const RESOURCE_ICONS = { wood: '🪵', food: '🌾', gold: '💰' };

const STARTING_RESOURCES = { wood: 30, food: 20, gold: 15 };

// Ciclo día/noche
const DAY_DURATION = 60000;
const NIGHT_DURATION = 20000;
const MIN_ENEMIES = 2;
const MAX_ENEMIES = 4;
const ENEMY_SPEED = 40; // px/s
const ENEMY_HIT_DISTANCE = TILE_SIZE * 0.5;
const DAMAGE_DURATION = 15000;
const ENEMY_MAX_HP = 3;

// Torre de vigilancia
const TOWER_RANGE_TILES = 2;
const TOWER_FIRE_INTERVAL = 1500;
const TOWER_DAMAGE = 1;

// Zona inicial edificable: un bloque central de 5x5 dentro del grid de 10x8.
const BUILDABLE_BOUNDS = { colStart: 2, colEnd: 7, rowStart: 1, rowEnd: 6 };

// Camino fijo de entrada: desde el borde superior hasta el centro del pueblo.
// No es edificable, para poder colocar defensas junto a él más adelante.
const PATH_TILES = [
  { col: 4, row: 0 },
  { col: 4, row: 1 },
  { col: 4, row: 2 },
  { col: 4, row: 3 },
];
const ENTRY_POINT = PATH_TILES[0];

const BUILDING_TYPES = {
  house: {
    key: 'house',
    label: 'Vivienda',
    emoji: '🏠',
    color: 0x8a6d3f,
    populationCap: 3,
    cost: { wood: 20 },
  },
  lumberyard: {
    key: 'lumberyard',
    label: 'Almacén',
    emoji: '🪵',
    color: 0x5c4632,
    resource: 'wood',
    intervals: [5000, 3000, 2000], // por nº de aldeanos asignados (0,1,2)
    cost: { wood: 15 },
  },
  farm: {
    key: 'farm',
    label: 'Granja',
    emoji: '🌾',
    color: 0x7cb342,
    resource: 'food',
    intervals: [5000, 3000, 2000],
    cost: { wood: 15, gold: 10 },
  },
  market: {
    key: 'market',
    label: 'Mercado',
    emoji: '💰',
    color: 0xd4af37,
    resource: 'gold',
    intervals: [8000, 5000, 3000], // más lento que los otros dos en cada tramo, pero alcanzable
    cost: { wood: 20, gold: 15 },
  },
  tower: {
    key: 'tower',
    label: 'Torre',
    emoji: '🗼',
    color: 0x55597a,
    cost: { wood: 20, gold: 15 },
    isTower: true,
    range: TOWER_RANGE_TILES,
    fireInterval: TOWER_FIRE_INTERVAL,
    damage: TOWER_DAMAGE,
  },
};

// Fase 2: aldeanos con roles — asignables a edificios generadores para acelerar su producción.
export default class VillageScene extends Phaser.Scene {
  constructor() {
    super('VillageScene');
    this.buildings = new Map(); // "col,row" -> { type, container, timer, workers, workerIcons }
    this.resources = { ...STARTING_RESOURCES };
    this.populationCap = 0;
    this.globalAssignmentOrder = []; // grid keys, en orden cronológico de asignación
    this.selectedBuildingType = null;
    this.activePanel = null;
    this.suppressNextClick = false;
    this.freeVillagerIcons = [];
    this.messageText = null;
    this.cyclePhase = 'day';
    this.cycleTimeRemaining = DAY_DURATION;
    this.enemies = [];
  }

  create() {
    this.createSkyBackground();
    this.createBuildingTextures();
    this.createEnemyTexture();
    this.drawGrid();
    this.drawHud();
    this.createBuildMenu();
    this.renderFreeVillagers();
    this.createNightOverlay();
    this.updateCycleHud();

    this.input.on('pointerdown', this.handlePointerDown, this);
  }

  // Cielo cálido de fondo detrás de todo el tablero, para que no sea un negro plano.
  createSkyBackground() {
    const g = this.add.graphics().setDepth(-100);
    g.fillGradientStyle(0x8fd3ea, 0x8fd3ea, 0xffe3ae, 0xffe3ae, 1);
    g.fillRect(0, 0, this.scale.width, this.scale.height);
  }

  bakeTexture(key, size, drawFn) {
    const g = this.add.graphics();
    drawFn(g, size);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  // Dibuja cada edificio (y la torre) con formas de Phaser Graphics en vez de
  // emojis, con sombra propia, volumen y una paleta cálida tipo cartoon.
  createBuildingTextures() {
    const s = TILE_SIZE;
    const shadow = (g) => {
      g.fillStyle(0x140a04, 0.32);
      g.fillEllipse(s * 0.5, s * 0.92, s * 0.62, s * 0.15);
    };

    this.bakeTexture('house', s, (g) => {
      shadow(g);
      g.fillStyle(0xdba26a, 1);
      g.fillRoundedRect(s * 0.2, s * 0.52, s * 0.6, s * 0.34, 4);
      g.lineStyle(2, 0x8a5a34, 1);
      g.strokeRoundedRect(s * 0.2, s * 0.52, s * 0.6, s * 0.34, 4);

      g.fillGradientStyle(0xe0653f, 0xe0653f, 0x8a2f1f, 0x8a2f1f, 1);
      g.fillTriangle(s * 0.5, s * 0.12, s * 0.1, s * 0.54, s * 0.9, s * 0.54);
      g.lineStyle(2, 0x6b2416, 1);
      g.strokeTriangle(s * 0.5, s * 0.12, s * 0.1, s * 0.54, s * 0.9, s * 0.54);

      g.fillStyle(0x5b3a29, 1);
      g.fillRoundedRect(s * 0.44, s * 0.68, s * 0.12, s * 0.18, 2);
      g.fillStyle(0xffe6a0, 1);
      g.fillRoundedRect(s * 0.26, s * 0.58, s * 0.1, s * 0.1, 2);
      g.lineStyle(1.5, 0xb5793d, 0.8);
      g.strokeRoundedRect(s * 0.26, s * 0.58, s * 0.1, s * 0.1, 2);
    });

    this.bakeTexture('lumberyard', s, (g) => {
      shadow(g);
      g.fillStyle(0x8a5a34, 1);
      g.fillRoundedRect(s * 0.16, s * 0.46, s * 0.68, s * 0.4, 4);
      g.lineStyle(2, 0x5c3b20, 1);
      g.strokeRoundedRect(s * 0.16, s * 0.46, s * 0.68, s * 0.4, 4);

      g.lineStyle(1.5, 0x6b4527, 0.85);
      for (let i = 1; i <= 2; i++) {
        const py = s * 0.46 + (s * 0.4 * i) / 3;
        g.beginPath();
        g.moveTo(s * 0.19, py);
        g.lineTo(s * 0.81, py);
        g.strokePath();
      }

      g.fillStyle(0x5c3b20, 1);
      g.fillRoundedRect(s * 0.13, s * 0.36, s * 0.74, s * 0.13, 3);

      const logColors = [0xc98a4b, 0xb5793d];
      [
        [s * 0.28, s * 0.87],
        [s * 0.4, s * 0.89],
        [s * 0.5, s * 0.87],
      ].forEach(([lx, ly], i) => {
        g.fillStyle(logColors[i % 2], 1);
        g.fillCircle(lx, ly, s * 0.075);
        g.lineStyle(1.5, 0x7a4e28, 1);
        g.strokeCircle(lx, ly, s * 0.075);
      });
    });

    this.bakeTexture('farm', s, (g) => {
      shadow(g);
      g.fillStyle(0xecdcb0, 1);
      g.fillRoundedRect(s * 0.22, s * 0.5, s * 0.56, s * 0.36, 4);
      g.lineStyle(2, 0xb8a173, 1);
      g.strokeRoundedRect(s * 0.22, s * 0.5, s * 0.56, s * 0.36, 4);

      g.fillGradientStyle(0xc0432c, 0xc0432c, 0x7a2618, 0x7a2618, 1);
      g.fillTriangle(s * 0.5, s * 0.14, s * 0.14, s * 0.52, s * 0.86, s * 0.52);
      g.lineStyle(2, 0x5c1d11, 1);
      g.strokeTriangle(s * 0.5, s * 0.14, s * 0.14, s * 0.52, s * 0.86, s * 0.52);

      g.fillStyle(0x8a5a34, 1);
      g.fillRoundedRect(s * 0.42, s * 0.66, s * 0.16, s * 0.2, 2);

      g.fillStyle(0x6fae3a, 1);
      for (let i = 0; i < 4; i++) {
        const cx = s * 0.2 + i * s * 0.16;
        g.fillTriangle(cx, s * 0.9, cx - 3, s * 0.98, cx + 3, s * 0.98);
      }
    });

    this.bakeTexture('market', s, (g) => {
      shadow(g);
      g.fillStyle(0x8a5a34, 1);
      g.fillRoundedRect(s * 0.22, s * 0.62, s * 0.56, s * 0.24, 3);
      g.lineStyle(2, 0x5c3b20, 1);
      g.strokeRoundedRect(s * 0.22, s * 0.62, s * 0.56, s * 0.24, 3);

      g.lineStyle(3, 0x6b4527, 1);
      g.beginPath();
      g.moveTo(s * 0.26, s * 0.62);
      g.lineTo(s * 0.26, s * 0.28);
      g.strokePath();
      g.beginPath();
      g.moveTo(s * 0.74, s * 0.62);
      g.lineTo(s * 0.74, s * 0.28);
      g.strokePath();

      const stripeColors = [0xd4af37, 0xf1d98a];
      const stripes = 4;
      for (let i = 0; i < stripes; i++) {
        const x0 = s * 0.2 + ((s * 0.6) / stripes) * i;
        const x1 = x0 + (s * 0.6) / stripes;
        g.fillStyle(stripeColors[i % 2], 1);
        g.fillTriangle(x0, s * 0.3, x1, s * 0.3, (x0 + x1) / 2, s * 0.14);
      }
      g.lineStyle(2, 0x8a6d1f, 0.8);
      g.beginPath();
      g.moveTo(s * 0.18, s * 0.3);
      g.lineTo(s * 0.82, s * 0.3);
      g.strokePath();

      g.fillStyle(0xffe066, 1);
      g.fillCircle(s * 0.38, s * 0.68, s * 0.05);
      g.fillCircle(s * 0.5, s * 0.66, s * 0.05);
      g.fillCircle(s * 0.62, s * 0.68, s * 0.05);
    });

    this.bakeTexture('tower', s, (g) => {
      g.fillStyle(0x140a04, 0.32);
      g.fillEllipse(s * 0.5, s * 0.94, s * 0.66, s * 0.14);

      g.fillStyle(0x6b6f8a, 1);
      g.beginPath();
      g.moveTo(s * 0.24, s * 0.9);
      g.lineTo(s * 0.76, s * 0.9);
      g.lineTo(s * 0.66, s * 0.56);
      g.lineTo(s * 0.34, s * 0.56);
      g.closePath();
      g.fillPath();
      g.lineStyle(2, 0x454863, 1);
      g.strokePath();

      g.fillStyle(0x777bab, 1);
      g.fillRect(s * 0.38, s * 0.22, s * 0.24, s * 0.36);
      g.lineStyle(2, 0x454863, 1);
      g.strokeRect(s * 0.38, s * 0.22, s * 0.24, s * 0.36);

      g.fillStyle(0x2a2c40, 1);
      g.fillRoundedRect(s * 0.47, s * 0.34, s * 0.06, s * 0.14, 2);

      g.fillStyle(0x8b8fc0, 1);
      g.fillRoundedRect(s * 0.28, s * 0.16, s * 0.44, s * 0.1, 2);
      g.lineStyle(2, 0x454863, 1);
      g.strokeRoundedRect(s * 0.28, s * 0.16, s * 0.44, s * 0.1, 2);

      [0.3, 0.44, 0.58, 0.68].forEach((fx) => {
        g.fillStyle(0x8b8fc0, 1);
        g.fillRect(s * fx, s * 0.09, s * 0.05, s * 0.08);
      });

      g.lineStyle(2, 0x454863, 1);
      g.beginPath();
      g.moveTo(s * 0.5, s * 0.09);
      g.lineTo(s * 0.5, s * 0.0);
      g.strokePath();
      g.fillStyle(0xc0432c, 1);
      g.fillTriangle(s * 0.5, s * 0.0, s * 0.5, s * 0.06, s * 0.66, s * 0.03);
    });
  }

  // Silueta de enemigo propia (no emoji genérico): forma angulosa oscura con
  // contorno brillante para que destaque sobre el terreno, más ojos y cuernos.
  createEnemyTexture() {
    const size = 48;
    this.bakeTexture('enemy', size, (g) => {
      g.fillStyle(0x7a1a5c, 0.35);
      g.fillCircle(size / 2, size / 2, size * 0.46);

      g.fillStyle(0x6b1220, 1);
      g.beginPath();
      g.moveTo(size * 0.5, size * 0.08);
      g.lineTo(size * 0.78, size * 0.28);
      g.lineTo(size * 0.86, size * 0.62);
      g.lineTo(size * 0.62, size * 0.92);
      g.lineTo(size * 0.38, size * 0.92);
      g.lineTo(size * 0.14, size * 0.62);
      g.lineTo(size * 0.22, size * 0.28);
      g.closePath();
      g.fillPath();
      g.lineStyle(2.5, 0xff5577, 0.9);
      g.strokePath();

      g.fillStyle(0x4a0d16, 1);
      g.fillTriangle(size * 0.32, size * 0.14, size * 0.4, size * 0.04, size * 0.42, size * 0.22);
      g.fillTriangle(size * 0.68, size * 0.14, size * 0.6, size * 0.04, size * 0.58, size * 0.22);

      g.fillStyle(0xffe066, 1);
      g.fillCircle(size * 0.38, size * 0.48, size * 0.07);
      g.fillCircle(size * 0.62, size * 0.48, size * 0.07);
      g.fillStyle(0x1a0510, 1);
      g.fillCircle(size * 0.38, size * 0.48, size * 0.032);
      g.fillCircle(size * 0.62, size * 0.48, size * 0.032);
    });
  }

  update(time, delta) {
    this.updateCycle(delta);
    if (this.cyclePhase === 'night') {
      this.updateEnemies(delta);
      this.updateTowers(delta);
    }
  }

  isPathTile(col, row) {
    return PATH_TILES.some((p) => p.col === col && p.row === row);
  }

  isBuildable(col, row) {
    if (this.isPathTile(col, row)) return false;
    return (
      col >= BUILDABLE_BOUNDS.colStart &&
      col < BUILDABLE_BOUNDS.colEnd &&
      row >= BUILDABLE_BOUNDS.rowStart &&
      row < BUILDABLE_BOUNDS.rowEnd
    );
  }

  // Las torres solo pueden ir junto al camino (no encima), para no bloquear el paso.
  isTowerSpot(col, row) {
    if (this.isPathTile(col, row)) return false;
    const neighbors = [
      { col: col - 1, row },
      { col: col + 1, row },
      { col, row: row - 1 },
      { col, row: row + 1 },
    ];
    return neighbors.some((n) => this.isPathTile(n.col, n.row));
  }

  tileCenter(col, row) {
    return {
      x: this.gridOffset.x + col * TILE_SIZE + TILE_SIZE / 2,
      y: this.gridOffset.y + row * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  createNightOverlay() {
    // OJO: el 6º argumento de add.rectangle() es fillAlpha, una propiedad DISTINTA
    // de .alpha (se multiplican entre sí). Si se deja en 0 aquí, animar .alpha
    // después nunca lo hace visible (fillAlpha=0 * cualquier alpha = 0 siempre).
    // Por eso el oscurecimiento nocturno nunca se veía pese a que darkenGrid()
    // "funcionaba" (el valor de .alpha sí cambiaba, solo que no importaba).
    this.nightOverlay = this.add
      .rectangle(this.gridOffset.x, this.gridOffset.y, GRID_WIDTH, GRID_HEIGHT, 0x2a1840, 1)
      .setOrigin(0)
      .setDepth(450)
      .setAlpha(0);
  }

  updateCycle(delta) {
    this.cycleTimeRemaining -= delta;
    if (this.cycleTimeRemaining <= 0) {
      this.togglePhase();
    }
    this.updateCycleHud();
  }

  togglePhase() {
    if (this.cyclePhase === 'day') {
      this.cyclePhase = 'night';
      this.cycleTimeRemaining = NIGHT_DURATION;
      this.onNightStart();
    } else {
      this.cyclePhase = 'day';
      this.cycleTimeRemaining = DAY_DURATION;
      this.onDayStart();
    }
  }

  onNightStart() {
    this.showMessage('¡Cae la noche!');
    this.darkenGrid(true);
    this.spawnEnemies();
  }

  onDayStart() {
    this.showMessage('Amanece');
    this.darkenGrid(false);
    this.clearEnemies();
  }

  darkenGrid(toNight) {
    this.tweens.add({
      targets: this.nightOverlay,
      alpha: toNight ? 0.45 : 0,
      duration: 800,
      ease: 'Sine.easeInOut',
    });
  }

  updateCycleHud() {
    const seconds = Math.max(0, Math.ceil(this.cycleTimeRemaining / 1000));
    const icon = this.cyclePhase === 'day' ? '☀️' : '🌙';
    const label = this.cyclePhase === 'day' ? 'Día' : 'Noche';
    this.cycleText.setText(`${icon} ${label} · ${seconds}s`);
  }

  spawnEnemies() {
    const count = Phaser.Math.Between(MIN_ENEMIES, MAX_ENEMIES);
    const spawn = this.tileCenter(ENTRY_POINT.col, ENTRY_POINT.row);
    for (let i = 0; i < count; i++) {
      // Pequeño desvío lateral + variación de velocidad para que no queden
      // perfectamente superpuestos al compartir el mismo punto de entrada y camino.
      const jitter = Phaser.Math.Between(-18, 18);

      const container = this.add.container(spawn.x + jitter, spawn.y).setDepth(500);
      const icon = this.add.image(0, 0, 'enemy').setOrigin(0.5).setDisplaySize(36, 36);
      const hpBg = this.add.rectangle(0, -20, 24, 4, 0x2a1414, 0.9).setOrigin(0.5);
      const hpFill = this.add.rectangle(0, -20, 24, 4, 0x4caf50, 1).setOrigin(0.5);
      container.add([icon, hpBg, hpFill]);

      this.enemies.push({
        container,
        hpFill,
        hp: ENEMY_MAX_HP,
        arrived: false,
        pathIndex: 1, // ya nacen sobre PATH_TILES[0], el punto de entrada
        jitter,
        speedFactor: 0.85 + Math.random() * 0.3,
        spawnDelay: Math.random() * 700,
      });
    }
  }

  clearEnemies() {
    this.enemies.forEach((enemy) => enemy.container.destroy());
    this.enemies = [];
  }

  destroyEnemy(enemy) {
    enemy.container.destroy();
    this.enemies = this.enemies.filter((e) => e !== enemy);
  }

  // Objetivo tras terminar el camino: SOLO un edificio realmente cerca del final
  // del sendero (radio pequeño), nunca "el más cercano de todo el mapa". Antes, un
  // edificio simplemente adyacente al camino (pero lejos del centro real) podía
  // ganar esa búsqueda global y el enemigo se quedaba enganchado en él para siempre.
  findVillageCenterTarget() {
    const centerTile = PATH_TILES[PATH_TILES.length - 1];
    const center = this.tileCenter(centerTile.col, centerTile.row);
    const radiusPx = TILE_SIZE * 1.5;

    let nearestKey = null;
    let nearestX = 0;
    let nearestY = 0;
    let nearestDist = Infinity;

    for (const [key, entry] of this.buildings.entries()) {
      const cx = entry.container.x + TILE_SIZE / 2;
      const cy = entry.container.y + TILE_SIZE / 2;
      const dist = Math.hypot(cx - center.x, cy - center.y);
      if (dist <= radiusPx && dist < nearestDist) {
        nearestDist = dist;
        nearestKey = key;
        nearestX = cx;
        nearestY = cy;
      }
    }

    if (!nearestKey) return null;
    return { x: nearestX, y: nearestY, key: nearestKey };
  }

  updateEnemies(delta) {
    this.enemies.forEach((enemy) => {
      if (enemy.arrived) return;

      if (enemy.spawnDelay > 0) {
        enemy.spawnDelay -= delta;
        return;
      }

      // Movimiento "clamped": nunca se pasa del punto objetivo en un frame, así que
      // no puede quedar oscilando/atascado si un frame tarda más de la cuenta (algo
      // normal en un navegador real). Si sobra distancia por recorrer, encadena el
      // siguiente tramo del camino en el mismo frame.
      let remainingMove = ENEMY_SPEED * enemy.speedFactor * (delta / 1000);

      while (remainingMove > 0 && !enemy.arrived) {
        const onPath = enemy.pathIndex < PATH_TILES.length;
        let target;

        if (onPath) {
          const wp = PATH_TILES[enemy.pathIndex];
          const c = this.tileCenter(wp.col, wp.row);
          target = { x: c.x + enemy.jitter, y: c.y, key: null };
        } else {
          target = this.findVillageCenterTarget();
          if (!target) {
            // Terminó el camino y no hay nada que atacar justo ahí: se detiene sin más.
            enemy.arrived = true;
            break;
          }
        }

        const dx = target.x - enemy.container.x;
        const dy = target.y - enemy.container.y;
        const dist = Math.hypot(dx, dy);

        // Solo se puede "llegar" a un edificio una vez terminado el camino fijo;
        // mientras onPath, los edificios cercanos al sendero no afectan su avance.
        if (!onPath && dist < ENEMY_HIT_DISTANCE) {
          enemy.arrived = true;
          this.damageBuilding(target.key);
          break;
        }

        if (dist <= remainingMove) {
          // Llega exactamente al punto objetivo este frame, sin pasarse de largo.
          enemy.container.x = target.x;
          enemy.container.y = target.y;
          remainingMove -= dist;
          if (onPath) enemy.pathIndex += 1;
          continue;
        }

        enemy.container.x += (dx / dist) * remainingMove;
        enemy.container.y += (dy / dist) * remainingMove;
        remainingMove = 0;
      }
    });
  }

  updateTowers(delta) {
    for (const entry of this.buildings.values()) {
      const def = BUILDING_TYPES[entry.type];
      if (!def.isTower) continue;

      entry.fireCooldown -= delta;
      if (entry.fireCooldown > 0) continue;

      const target = this.findNearestEnemyInRange(entry, def);
      if (!target) continue;

      this.fireTowerAt(entry, target, def);
      entry.fireCooldown = def.fireInterval;
    }
  }

  findNearestEnemyInRange(entry, def) {
    const towerX = entry.container.x + TILE_SIZE / 2;
    const towerY = entry.container.y + TILE_SIZE / 2;
    const rangePx = def.range * TILE_SIZE;

    let nearest = null;
    let nearestDist = Infinity;
    for (const enemy of this.enemies) {
      const dist = Math.hypot(enemy.container.x - towerX, enemy.container.y - towerY);
      if (dist <= rangePx && dist < nearestDist) {
        nearestDist = dist;
        nearest = enemy;
      }
    }
    return nearest;
  }

  fireTowerAt(entry, enemy, def) {
    const towerCenter = { x: entry.container.x + TILE_SIZE / 2, y: entry.container.y + TILE_SIZE / 2 };
    const enemyPos = { x: enemy.container.x, y: enemy.container.y };

    this.drawProjectile(towerCenter, enemyPos);
    this.flashTower(towerCenter);
    this.flashImpact(enemyPos);

    enemy.hp -= def.damage;
    const ratio = Math.max(enemy.hp, 0) / ENEMY_MAX_HP;
    enemy.hpFill.setSize(24 * ratio, 4);

    if (enemy.hp <= 0) {
      this.destroyEnemy(enemy);
    }
  }

  // Pulso breve en la torre: deja claro que SÍ tenía un enemigo en rango y disparó.
  flashTower(center) {
    const ring = this.add.circle(center.x, center.y, TILE_SIZE * 0.28, 0xfff2a8, 0.5).setDepth(550);
    this.tweens.add({
      targets: ring,
      radius: TILE_SIZE * 0.6,
      alpha: 0,
      duration: 280,
      onComplete: () => ring.destroy(),
    });
  }

  // Destello de impacto sobre el enemigo alcanzado.
  flashImpact(pos) {
    const burst = this.add.text(pos.x, pos.y, '✦', { fontSize: '18px', color: '#fff2a8' }).setOrigin(0.5).setDepth(600);
    this.tweens.add({
      targets: burst,
      scale: 1.8,
      alpha: 0,
      duration: 220,
      onComplete: () => burst.destroy(),
    });
  }

  drawProjectile(from, to) {
    const line = this.add.graphics().setDepth(600);
    line.lineStyle(3, 0xfff2a8, 1);
    line.beginPath();
    line.moveTo(from.x, from.y);
    line.lineTo(to.x, to.y);
    line.strokePath();

    this.tweens.add({
      targets: line,
      alpha: 0,
      duration: 220,
      onComplete: () => line.destroy(),
    });
  }

  damageBuilding(key) {
    const entry = this.buildings.get(key);
    if (!entry) return;

    entry.damaged = true;
    entry.bg.setTint(0xff5555);
    if (!entry.damageIcon) {
      entry.damageIcon = this.add.text(TILE_SIZE * 0.82, TILE_SIZE * 0.18, '💥', { fontSize: '16px' }).setOrigin(0.5);
      entry.container.add(entry.damageIcon);
    }

    if (entry.damageTimer) entry.damageTimer.remove();
    entry.damageTimer = this.time.delayedCall(DAMAGE_DURATION, () => this.repairBuilding(key));
  }

  repairBuilding(key) {
    const entry = this.buildings.get(key);
    if (!entry) return;

    entry.damaged = false;
    entry.damageTimer = null;
    entry.bg.clearTint();
    if (entry.damageIcon) {
      entry.damageIcon.destroy();
      entry.damageIcon = null;
    }
  }

  drawGrid() {
    const offsetX = Math.round((this.scale.width - GRID_WIDTH) / 2);
    const offsetY = GRID_TOP;
    this.gridOffset = { x: offsetX, y: offsetY };

    const g = this.add.graphics();
    const grassColors = [0x4a9a3c, 0x3f8a35, 0x5aab47, 0x357a30];
    const dirtColors = [0xad8352, 0x9c7345];

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const x = offsetX + col * TILE_SIZE;
        const y = offsetY + row * TILE_SIZE;
        // Semillas deterministas (no Math.random) para que la decoración sea
        // estable pero no se repita en un patrón demasiado regular.
        const seedA = (col * 7 + row * 13) % grassColors.length;
        const seedB = (col * 5 + row * 3) % 7;
        const seedC = (col * 3 + row * 11) % 9;

        if (this.isPathTile(col, row)) {
          this.drawPathTile(g, x, y, dirtColors[(col + row) % dirtColors.length]);
        } else if (this.isBuildable(col, row)) {
          this.drawGrassTile(g, x, y, grassColors[seedA], seedB, seedC);
        } else {
          // Zona sin desbloquear: tono apagado + algún icono de candado suelto.
          g.fillStyle(0x1a2318, 1);
          g.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          g.lineStyle(1, 0x121a10, 1);
          g.strokeRect(x, y, TILE_SIZE, TILE_SIZE);

          if ((row * GRID_COLS + col) % 4 === 0) {
            this.add
              .text(x + TILE_SIZE / 2, y + TILE_SIZE / 2, '🔒', { fontSize: '16px' })
              .setOrigin(0.5)
              .setAlpha(0.3);
          }
        }
      }
    }
  }

  drawGrassTile(g, x, y, baseColor, seedB, seedC) {
    const s = TILE_SIZE;
    g.fillStyle(baseColor, 1);
    g.fillRect(x, y, s, s);
    g.lineStyle(1, 0x2c522c, 0.5);
    g.strokeRect(x, y, s, s);

    // Tuft de hierba mas oscuro, solo en algunas casillas.
    if (seedB === 0 || seedB === 3) {
      const tx = x + s * (0.25 + (seedC % 3) * 0.15);
      const ty = y + s * (0.6 + (seedC % 2) * 0.15);
      g.lineStyle(2, 0x1f4d1c, 0.7);
      for (let i = -1; i <= 1; i++) {
        g.beginPath();
        g.moveTo(tx + i * 3, ty + 6);
        g.lineTo(tx + i * 5, ty - 4);
        g.strokePath();
      }
    }

    // Flor pequeña ocasional.
    if (seedB === 5 && seedC % 2 === 0) {
      const fx = x + s * (0.4 + (seedC % 3) * 0.1);
      const fy = y + s * (0.35 + (seedC % 4) * 0.1);
      const petal = seedC % 3 === 0 ? 0xfff3b0 : seedC % 3 === 1 ? 0xffb6c1 : 0xffffff;
      g.fillStyle(petal, 0.95);
      [[-3, 0], [3, 0], [0, -3], [0, 3]].forEach(([dx, dy]) => {
        g.fillCircle(fx + dx, fy + dy, 2.2);
      });
      g.fillStyle(0xffe066, 1);
      g.fillCircle(fx, fy, 2);
    }
  }

  drawPathTile(g, x, y, baseColor) {
    const s = TILE_SIZE;
    g.fillStyle(baseColor, 1);
    g.fillRect(x, y, s, s);

    // Parches de desgaste (manchas irregulares mas oscuras) para romper lo plano.
    g.fillStyle(0x7a5a34, 0.35);
    g.fillEllipse(x + s * 0.3, y + s * 0.35, s * 0.4, s * 0.22);
    g.fillEllipse(x + s * 0.68, y + s * 0.72, s * 0.36, s * 0.2);

    // Guijarros sueltos.
    const pebbles = [
      [0.22, 0.65, 0x8a8a82],
      [0.62, 0.28, 0x7a7a72],
      [0.78, 0.55, 0x9a9a90],
    ];
    pebbles.forEach(([px, py, color]) => {
      g.fillStyle(color, 0.85);
      g.fillEllipse(x + s * px, y + s * py, 6, 4);
      g.fillStyle(0xffffff, 0.25);
      g.fillEllipse(x + s * px - 1, y + s * py - 1, 2, 1.4);
    });

    // Borde suavizado (tono intermedio en vez de un contorno duro).
    g.lineStyle(2, 0x6e5433, 0.4);
    g.strokeRect(x + 1, y + 1, s - 2, s - 2);
  }

  drawHud() {
    const panels = this.add.graphics();
    const panelColor = 0x3a2410;
    const panelAlpha = 0.6;

    panels.fillStyle(panelColor, panelAlpha);
    panels.fillRoundedRect(10, 4, 150, 21, 8);

    this.cycleText = this.add.text(20, 6, '', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#ffe9b0',
    });

    const resourceY = 31;
    this.resourceTexts = {};
    let x = 16;
    for (const key of ['wood', 'food', 'gold']) {
      panels.fillStyle(panelColor, panelAlpha);
      panels.fillRoundedRect(x - 6, resourceY - 4, 82, 25, 10);

      this.resourceTexts[key] = this.add.text(x, resourceY, `${RESOURCE_ICONS[key]} ${this.resources[key]}`, {
        fontFamily: 'sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#fff3d6',
      });
      x += 90;
    }

    panels.fillStyle(panelColor, panelAlpha);
    panels.fillRoundedRect(x + 4, resourceY - 4, 142, 25, 10);

    this.populationText = this.add.text(x + 12, resourceY, '🧑 Aldeanos: 0/0', {
      fontFamily: 'sans-serif',
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#fff3d6',
    });
  }

  createBuildMenu() {
    const panelY = this.gridOffset.y + GRID_HEIGHT + PANEL_GAP;
    const panelWidth = this.scale.width - 20;
    const types = Object.values(BUILDING_TYPES);
    const buttonGap = 8;
    const buttonWidth = (panelWidth - buttonGap * (types.length - 1)) / types.length;
    const buttonHeight = PANEL_HEIGHT - 20;

    this.buildButtons = {};

    types.forEach((def, i) => {
      const x = 10 + i * (buttonWidth + buttonGap);
      const container = this.add.container(x, panelY);

      const bg = this.add
        .rectangle(buttonWidth / 2, buttonHeight / 2, buttonWidth, buttonHeight, def.color, 0.85)
        .setStrokeStyle(2, 0xffffff, 0.25)
        .setInteractive({ useHandCursor: true });

      const icon = this.add
        .image(buttonWidth / 2, buttonHeight * 0.28, def.key)
        .setOrigin(0.5)
        .setDisplaySize(36, 36);

      const label = this.add
        .text(buttonWidth / 2, buttonHeight * 0.6, def.label, {
          fontFamily: 'sans-serif',
          fontSize: '11px',
          color: '#ffffff',
        })
        .setOrigin(0.5);

      const costText = this.add
        .text(buttonWidth / 2, buttonHeight * 0.8, this.formatCost(def.cost), {
          fontFamily: 'sans-serif',
          fontSize: '11px',
          color: '#ffe066',
        })
        .setOrigin(0.5);

      container.add([bg, icon, label, costText]);
      container.bg = bg;

      bg.on('pointerdown', () => this.selectBuildingType(def.key));

      this.buildButtons[def.key] = container;
    });
  }

  selectBuildingType(key) {
    this.selectedBuildingType = this.selectedBuildingType === key ? null : key;
    this.refreshBuildMenuHighlight();
  }

  refreshBuildMenuHighlight() {
    for (const [key, container] of Object.entries(this.buildButtons)) {
      const selected = key === this.selectedBuildingType;
      container.bg.setStrokeStyle(selected ? 4 : 2, selected ? 0xffe066 : 0xffffff, selected ? 1 : 0.25);
      container.setScale(selected ? 1.05 : 1);
    }
  }

  handlePointerDown(pointer) {
    // Cerrar el panel (botón ✕, fondo o "Quitar edificio") dispara closeBuildingPanel()
    // ANTES de que este listener de escena vea el mismo click; sin esta bandera, ese
    // clic se colaría como una acción sobre la casilla del grid bajo ese botón.
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      return;
    }
    if (this.activePanel) return; // el panel modal bloquea la interacción de fondo

    const { x: offsetX, y: offsetY } = this.gridOffset;
    const col = Math.floor((pointer.worldX - offsetX) / TILE_SIZE);
    const row = Math.floor((pointer.worldY - offsetY) / TILE_SIZE);

    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;

    const key = `${col},${row}`;
    const existing = this.buildings.get(key);

    if (existing) {
      const def = BUILDING_TYPES[existing.type];
      if (def.resource) {
        this.openBuildingPanel(key);
      } else {
        this.removeBuilding(key, existing);
      }
      return;
    }

    if (!this.selectedBuildingType) return;

    const def = BUILDING_TYPES[this.selectedBuildingType];
    const placementOk = def.isTower ? this.isTowerSpot(col, row) : this.isBuildable(col, row);

    if (!placementOk) {
      this.showMessage(
        def.isTower ? 'La torre debe colocarse junto al camino' : 'Esta zona aún no está desbloqueada'
      );
      return;
    }

    if (!this.canAfford(def.cost)) {
      this.showMessage('Recursos insuficientes');
      this.flashButtonError(def.key);
      return;
    }

    this.spendResources(def.cost);
    const x = offsetX + col * TILE_SIZE;
    const y = offsetY + row * TILE_SIZE;
    this.placeBuilding(key, def, x, y);
  }

  formatCost(cost) {
    return Object.entries(cost)
      .map(([res, amount]) => `${RESOURCE_ICONS[res]}${amount}`)
      .join(' ');
  }

  canAfford(cost) {
    return Object.entries(cost).every(([res, amount]) => this.resources[res] >= amount);
  }

  spendResources(cost) {
    Object.entries(cost).forEach(([res, amount]) => {
      this.resources[res] -= amount;
      this.resourceTexts[res].setText(`${RESOURCE_ICONS[res]} ${this.resources[res]}`);
    });
  }

  flashButtonError(buildingKey) {
    const container = this.buildButtons[buildingKey];
    if (!container) return;
    const originalColor = BUILDING_TYPES[buildingKey].color;
    container.bg.setFillStyle(0xcc3333, 0.9);
    this.time.delayedCall(350, () => {
      if (container.bg) container.bg.setFillStyle(originalColor, 0.85);
    });
  }

  showMessage(text) {
    if (this.messageText) {
      this.tweens.killTweensOf(this.messageText);
      this.messageText.destroy();
    }

    this.messageText = this.add
      .text(this.scale.width / 2, this.gridOffset.y + 24, text, {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        color: '#ff6b6b',
        backgroundColor: '#00000099',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5)
      .setDepth(2000);

    this.tweens.add({
      targets: this.messageText,
      alpha: 0,
      delay: 900,
      duration: 400,
      onComplete: () => {
        if (this.messageText) {
          this.messageText.destroy();
          this.messageText = null;
        }
      },
    });
  }

  placeBuilding(key, def, x, y) {
    const container = this.createBuildingVisual(x, y, def);
    const entry = {
      type: def.key,
      container,
      bg: container.bg,
      timer: null,
      workers: 0,
      workerIcons: [],
      damaged: false,
      damageIcon: null,
      damageTimer: null,
      fireCooldown: 0,
    };

    if (def.resource) {
      entry.timer = this.time.addEvent({
        delay: def.intervals[0],
        loop: true,
        callback: () => {
          if (entry.damaged) return;
          this.addResource(def.resource, 1);
        },
      });
    }

    if (def.populationCap) {
      this.populationCap += def.populationCap;
    }

    this.buildings.set(key, entry);
    this.updatePopulationHud();
    this.renderFreeVillagers();
  }

  removeBuilding(key, entry) {
    entry.container.destroy();
    if (entry.timer) entry.timer.remove();
    if (entry.damageTimer) entry.damageTimer.remove();

    if (entry.workers) {
      this.globalAssignmentOrder = this.globalAssignmentOrder.filter((k) => k !== key);
    }

    const def = BUILDING_TYPES[entry.type];
    if (def.populationCap) {
      this.populationCap -= def.populationCap;
    }

    this.buildings.delete(key);
    this.enforcePopulationCap();
    this.updatePopulationHud();
    this.renderFreeVillagers();
  }

  // Si el nuevo límite de población es menor que los aldeanos asignados,
  // libera trabajadores empezando por los asignados más recientemente.
  enforcePopulationCap() {
    let overflow = this.globalAssignmentOrder.length - this.populationCap;
    while (overflow > 0) {
      const bKey = this.globalAssignmentOrder.pop();
      const liveEntry = this.buildings.get(bKey);
      if (liveEntry) {
        liveEntry.workers = Math.max(0, liveEntry.workers - 1);
        this.updateBuildingInterval(bKey, liveEntry);
        this.updateWorkerDots(liveEntry);
      }
      overflow -= 1;
    }
  }

  assignVillager(key) {
    const entry = this.buildings.get(key);
    if (!entry) return;
    const def = BUILDING_TYPES[entry.type];
    if (!def.intervals) return;

    const free = this.populationCap - this.globalAssignmentOrder.length;
    if (entry.workers >= MAX_WORKERS_PER_BUILDING || free <= 0) return;

    entry.workers += 1;
    this.globalAssignmentOrder.push(key);
    this.updateBuildingInterval(key, entry);
    this.updateWorkerDots(entry);
    this.updatePopulationHud();
    this.renderFreeVillagers();
  }

  unassignVillager(key) {
    const entry = this.buildings.get(key);
    if (!entry || entry.workers <= 0) return;

    entry.workers -= 1;
    const idx = this.globalAssignmentOrder.lastIndexOf(key);
    if (idx !== -1) this.globalAssignmentOrder.splice(idx, 1);
    this.updateBuildingInterval(key, entry);
    this.updateWorkerDots(entry);
    this.updatePopulationHud();
    this.renderFreeVillagers();
  }

  updateBuildingInterval(key, entry) {
    const def = BUILDING_TYPES[entry.type];
    if (!def.intervals) return;
    if (entry.timer) entry.timer.remove();
    entry.timer = this.time.addEvent({
      delay: def.intervals[entry.workers],
      loop: true,
      callback: () => {
        if (entry.damaged) return;
        this.addResource(def.resource, 1);
      },
    });
  }

  updateWorkerDots(entry) {
    entry.workerIcons.forEach((icon) => icon.destroy());
    entry.workerIcons = [];

    const s = TILE_SIZE;
    for (let i = 0; i < entry.workers; i++) {
      const dx = s * (0.7 + i * 0.18);
      const dy = s * 0.86;
      const dot = this.add.text(dx, dy, '🧍', { fontSize: '14px' }).setOrigin(0.5);
      entry.container.add(dot);
      entry.workerIcons.push(dot);
    }
  }

  createBuildingVisual(x, y, def) {
    const s = TILE_SIZE;
    const container = this.add.container(x, y);

    const sprite = this.add.image(s / 2, s / 2, def.key).setOrigin(0.5);

    container.add(sprite);
    container.bg = sprite;
    return container;
  }

  // Aldeanos libres, dibujados como iconos sueltos junto al grid (con un ligero balanceo).
  renderFreeVillagers() {
    this.freeVillagerIcons.forEach((icon) => icon.destroy());
    this.freeVillagerIcons = [];

    const free = this.populationCap - this.globalAssignmentOrder.length;
    const areaX = this.gridOffset.x + GRID_WIDTH + 14;
    const areaYStart = this.gridOffset.y + 4;
    const perRow = 3;
    const spacing = 20;

    for (let i = 0; i < free; i++) {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const x = areaX + col * spacing;
      const y = areaYStart + row * spacing;
      const icon = this.add.text(x, y, '🧍', { fontSize: '15px' }).setOrigin(0.5);

      this.tweens.add({
        targets: icon,
        y: y - 4,
        duration: 600 + Math.random() * 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 500,
      });

      this.freeVillagerIcons.push(icon);
    }
  }

  openBuildingPanel(key) {
    this.closeBuildingPanel();

    const entry = this.buildings.get(key);
    const def = BUILDING_TYPES[entry.type];

    const panelWidth = 380;
    const panelHeight = 240;
    const px = Math.round((this.scale.width - panelWidth) / 2);
    const py = Math.round((this.scale.height - panelHeight) / 2);

    const container = this.add.container(0, 0).setDepth(1000);

    const backdrop = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.55)
      .setOrigin(0)
      .setInteractive();
    backdrop.on('pointerdown', () => this.closeBuildingPanel());

    const panelBg = this.add
      .rectangle(px, py, panelWidth, panelHeight, 0x203020, 0.98)
      .setOrigin(0)
      .setStrokeStyle(2, 0xffffff, 0.3)
      .setInteractive();

    const title = this.add
      .text(px + panelWidth / 2, py + 26, `${def.emoji} ${def.label}`, {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const workersText = this.add
      .text(px + panelWidth / 2, py + 68, '', {
        fontFamily: 'sans-serif',
        fontSize: '16px',
        color: '#e8f0e8',
      })
      .setOrigin(0.5);

    const intervalText = this.add
      .text(px + panelWidth / 2, py + 94, '', {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        color: '#b7c9b7',
      })
      .setOrigin(0.5);

    const freeText = this.add
      .text(px + panelWidth / 2, py + 114, '', {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        color: '#b7c9b7',
      })
      .setOrigin(0.5);

    const minusBtn = this.createPanelButton(px + panelWidth / 2 - 70, py + 154, '−', 0x8a3a3a, () => {
      this.unassignVillager(key);
      refreshPanelTexts();
    });
    const plusBtn = this.createPanelButton(px + panelWidth / 2 + 70, py + 154, '+', 0x3a7a4a, () => {
      this.assignVillager(key);
      refreshPanelTexts();
    });

    const removeBtn = this.createWideButton(px + panelWidth / 2, py + 202, 'Quitar edificio', 0x6b2b2b, () => {
      const liveEntry = this.buildings.get(key);
      if (liveEntry) this.removeBuilding(key, liveEntry);
      this.closeBuildingPanel();
    });

    const closeBtn = this.add
      .text(px + panelWidth - 22, py + 16, '✕', {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeBuildingPanel());

    const refreshPanelTexts = () => {
      const liveEntry = this.buildings.get(key);
      if (!liveEntry) {
        this.closeBuildingPanel();
        return;
      }
      const free = this.populationCap - this.globalAssignmentOrder.length;
      workersText.setText(`Aldeanos asignados: ${liveEntry.workers}/${MAX_WORKERS_PER_BUILDING}`);
      intervalText.setText(
        `Genera 1 ${RESOURCE_ICONS[def.resource]} cada ${def.intervals[liveEntry.workers] / 1000}s`
      );
      freeText.setText(`Aldeanos libres: ${free}`);
    };

    refreshPanelTexts();

    container.add([
      backdrop,
      panelBg,
      title,
      workersText,
      intervalText,
      freeText,
      minusBtn,
      plusBtn,
      removeBtn,
      closeBtn,
    ]);

    this.activePanel = { key, container };
  }

  closeBuildingPanel() {
    if (this.activePanel) {
      this.activePanel.container.destroy();
      this.activePanel = null;
      this.suppressNextClick = true;
    }
  }

  createPanelButton(x, y, label, color, onClick) {
    const container = this.add.container(x, y);
    const bg = this.add
      .circle(0, 0, 22, color, 1)
      .setStrokeStyle(2, 0xffffff, 0.4)
      .setInteractive({ useHandCursor: true });
    const text = this.add.text(0, 0, label, { fontFamily: 'sans-serif', fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);
    container.add([bg, text]);
    bg.on('pointerdown', onClick);
    return container;
  }

  createWideButton(x, y, label, color, onClick) {
    const container = this.add.container(x, y);
    const bg = this.add
      .rectangle(0, 0, 220, 34, color, 1)
      .setStrokeStyle(2, 0xffffff, 0.3)
      .setInteractive({ useHandCursor: true });
    const text = this.add.text(0, 0, label, { fontFamily: 'sans-serif', fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
    container.add([bg, text]);
    bg.on('pointerdown', onClick);
    return container;
  }

  addResource(key, amount) {
    this.resources[key] += amount;
    this.resourceTexts[key].setText(`${RESOURCE_ICONS[key]} ${this.resources[key]}`);
  }

  updatePopulationHud() {
    const assigned = this.globalAssignmentOrder.length;
    const free = this.populationCap - assigned;
    this.populationText.setText(`🧑 Aldeanos: ${free}/${this.populationCap}`);
  }
}
