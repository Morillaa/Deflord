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

const STARTING_RESOURCES = { wood: 30, food: 20, gold: 10 };

// Zona inicial edificable: un bloque central de 5x5 dentro del grid de 10x8.
const BUILDABLE_BOUNDS = { colStart: 2, colEnd: 7, rowStart: 1, rowEnd: 6 };

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
    intervals: [12000, 7000, 5000], // más lento que los otros dos en cada tramo
    cost: { wood: 20, gold: 15 },
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
  }

  create() {
    this.drawGrid();
    this.drawHud();
    this.createBuildMenu();
    this.renderFreeVillagers();

    this.input.on('pointerdown', this.handlePointerDown, this);
  }

  isBuildable(col, row) {
    return (
      col >= BUILDABLE_BOUNDS.colStart &&
      col < BUILDABLE_BOUNDS.colEnd &&
      row >= BUILDABLE_BOUNDS.rowStart &&
      row < BUILDABLE_BOUNDS.rowEnd
    );
  }

  drawGrid() {
    const offsetX = Math.round((this.scale.width - GRID_WIDTH) / 2);
    const offsetY = GRID_TOP;
    this.gridOffset = { x: offsetX, y: offsetY };

    const g = this.add.graphics();
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const x = offsetX + col * TILE_SIZE;
        const y = offsetY + row * TILE_SIZE;

        if (this.isBuildable(col, row)) {
          const color = (row + col) % 2 === 0 ? 0x3c6e3c : 0x356035;
          g.fillStyle(color, 1);
          g.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          g.lineStyle(1, 0x2c522c, 1);
          g.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
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

  drawHud() {
    this.add.text(16, 6, 'Deflord — Fase 3 · cada edificio tiene un coste; solo la zona central es edificable', {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: '#b7c9b7',
    });

    const resourceY = 26;
    this.resourceTexts = {};
    let x = 16;
    for (const key of ['wood', 'food', 'gold']) {
      this.resourceTexts[key] = this.add.text(x, resourceY, `${RESOURCE_ICONS[key]} ${this.resources[key]}`, {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#f2f2f2',
      });
      x += 90;
    }

    this.populationText = this.add.text(x + 10, resourceY, '🧑 Aldeanos: 0/0', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#f2f2f2',
    });
  }

  createBuildMenu() {
    const panelY = this.gridOffset.y + GRID_HEIGHT + PANEL_GAP;
    const panelWidth = this.scale.width - 20;
    const buttonGap = 10;
    const buttonWidth = (panelWidth - buttonGap * 3) / 4;
    const buttonHeight = PANEL_HEIGHT - 20;

    this.buildButtons = {};

    Object.values(BUILDING_TYPES).forEach((def, i) => {
      const x = 10 + i * (buttonWidth + buttonGap);
      const container = this.add.container(x, panelY);

      const bg = this.add
        .rectangle(buttonWidth / 2, buttonHeight / 2, buttonWidth, buttonHeight, def.color, 0.85)
        .setStrokeStyle(2, 0xffffff, 0.25)
        .setInteractive({ useHandCursor: true });

      const icon = this.add
        .text(buttonWidth / 2, buttonHeight * 0.22, def.emoji, { fontSize: '22px' })
        .setOrigin(0.5);

      const label = this.add
        .text(buttonWidth / 2, buttonHeight * 0.52, def.label, {
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

    if (!this.isBuildable(col, row)) {
      this.showMessage('Esta zona aún no está desbloqueada');
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
    const entry = { type: def.key, container, timer: null, workers: 0, workerIcons: [] };

    if (def.resource) {
      entry.timer = this.time.addEvent({
        delay: def.intervals[0],
        loop: true,
        callback: () => this.addResource(def.resource, 1),
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
      callback: () => this.addResource(def.resource, 1),
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

    const bg = this.add
      .rectangle(s / 2, s / 2, s * 0.82, s * 0.82, def.color, 1)
      .setStrokeStyle(2, 0x1c2b1c, 0.7);
    const icon = this.add.text(s / 2, s / 2, def.emoji, { fontSize: `${Math.floor(s * 0.5)}px` }).setOrigin(0.5);

    container.add([bg, icon]);
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
