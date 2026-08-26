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

const RESOURCE_ICONS = { wood: '🪵', food: '🌾', gold: '💰' };

const BUILDING_TYPES = {
  house: {
    key: 'house',
    label: 'Vivienda',
    emoji: '🏠',
    color: 0x8a6d3f,
    populationCap: 5,
  },
  lumberyard: {
    key: 'lumberyard',
    label: 'Almacén',
    emoji: '🪵',
    color: 0x5c4632,
    resource: 'wood',
    interval: 5000,
  },
  farm: {
    key: 'farm',
    label: 'Granja',
    emoji: '🌾',
    color: 0x7cb342,
    resource: 'food',
    interval: 5000,
  },
  market: {
    key: 'market',
    label: 'Mercado',
    emoji: '💰',
    color: 0xd4af37,
    resource: 'gold',
    interval: 12000,
  },
};

// Fase 1: recursos (madera/comida/oro) + 4 edificios básicos colocables/removibles.
export default class VillageScene extends Phaser.Scene {
  constructor() {
    super('VillageScene');
    this.buildings = new Map(); // "col,row" -> { type, container, timer }
    this.resources = { wood: 0, food: 0, gold: 0 };
    this.populationCap = 0;
    this.selectedBuildingType = null;
  }

  create() {
    this.drawGrid();
    this.drawHud();
    this.createBuildMenu();

    this.input.on('pointerdown', this.handlePointerDown, this);
  }

  drawGrid() {
    const offsetX = Math.round((this.scale.width - GRID_WIDTH) / 2);
    const offsetY = GRID_TOP;
    this.gridOffset = { x: offsetX, y: offsetY };

    const g = this.add.graphics();
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const color = (row + col) % 2 === 0 ? 0x3c6e3c : 0x356035;
        const x = offsetX + col * TILE_SIZE;
        const y = offsetY + row * TILE_SIZE;
        g.fillStyle(color, 1);
        g.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        g.lineStyle(1, 0x2c522c, 1);
        g.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  drawHud() {
    this.add.text(16, 6, 'Deflord — Fase 1 · elige un edificio abajo y toca una casilla', {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: '#b7c9b7',
    });

    const resourceY = 26;
    this.resourceTexts = {};
    let x = 16;
    for (const key of ['wood', 'food', 'gold']) {
      this.resourceTexts[key] = this.add.text(x, resourceY, `${RESOURCE_ICONS[key]} 0`, {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#f2f2f2',
      });
      x += 90;
    }

    this.populationCapText = this.add.text(x + 10, resourceY, '🏠 Cap: 0', {
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
        .text(buttonWidth / 2, buttonHeight * 0.32, def.emoji, { fontSize: '26px' })
        .setOrigin(0.5);

      const label = this.add
        .text(buttonWidth / 2, buttonHeight * 0.72, def.label, {
          fontFamily: 'sans-serif',
          fontSize: '12px',
          color: '#ffffff',
        })
        .setOrigin(0.5);

      container.add([bg, icon, label]);
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
    const { x: offsetX, y: offsetY } = this.gridOffset;
    const col = Math.floor((pointer.worldX - offsetX) / TILE_SIZE);
    const row = Math.floor((pointer.worldY - offsetY) / TILE_SIZE);

    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;

    const key = `${col},${row}`;
    const existing = this.buildings.get(key);

    if (existing) {
      this.removeBuilding(key, existing);
      return;
    }

    if (!this.selectedBuildingType) return;

    const def = BUILDING_TYPES[this.selectedBuildingType];
    const x = offsetX + col * TILE_SIZE;
    const y = offsetY + row * TILE_SIZE;
    this.placeBuilding(key, def, x, y);
  }

  placeBuilding(key, def, x, y) {
    const container = this.createBuildingVisual(x, y, def);

    let timer = null;
    if (def.resource) {
      timer = this.time.addEvent({
        delay: def.interval,
        loop: true,
        callback: () => this.addResource(def.resource, 1),
      });
    }

    if (def.populationCap) {
      this.populationCap += def.populationCap;
      this.updatePopulationCapHud();
    }

    this.buildings.set(key, { type: def.key, container, timer });
  }

  removeBuilding(key, entry) {
    entry.container.destroy();
    if (entry.timer) entry.timer.remove();

    const def = BUILDING_TYPES[entry.type];
    if (def.populationCap) {
      this.populationCap -= def.populationCap;
      this.updatePopulationCapHud();
    }

    this.buildings.delete(key);
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

  addResource(key, amount) {
    this.resources[key] += amount;
    this.resourceTexts[key].setText(`${RESOURCE_ICONS[key]} ${this.resources[key]}`);
  }

  updatePopulationCapHud() {
    this.populationCapText.setText(`🏠 Cap: ${this.populationCap}`);
  }
}
