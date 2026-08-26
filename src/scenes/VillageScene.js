import Phaser from 'phaser';

const TILE_SIZE = 64;
const GRID_COLS = 10;
const GRID_ROWS = 8;

// Fase 0: solo el núcleo visual del pueblo (grid + una casa de ejemplo colocable).
export default class VillageScene extends Phaser.Scene {
  constructor() {
    super('VillageScene');
    this.houses = new Map(); // "col,row" -> Phaser.GameObjects.Image
  }

  create() {
    this.createTileTextures();
    this.createHouseTexture();
    this.drawGrid();
    this.drawHud();

    this.input.on('pointerdown', this.handlePointerDown, this);
  }

  createTileTextures() {
    const g = this.add.graphics();

    g.fillStyle(0x3c6e3c, 1);
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.lineStyle(1, 0x2c522c, 1);
    g.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.generateTexture('tile-light', TILE_SIZE, TILE_SIZE);
    g.clear();

    g.fillStyle(0x356035, 1);
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.lineStyle(1, 0x2c522c, 1);
    g.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.generateTexture('tile-dark', TILE_SIZE, TILE_SIZE);

    g.destroy();
  }

  createHouseTexture() {
    const g = this.add.graphics();
    const s = TILE_SIZE;

    g.fillStyle(0xd9b48f, 1);
    g.fillRect(s * 0.15, s * 0.45, s * 0.7, s * 0.45);

    g.fillStyle(0xa8402d, 1);
    g.beginPath();
    g.moveTo(s * 0.5, s * 0.1);
    g.lineTo(s * 0.08, s * 0.48);
    g.lineTo(s * 0.92, s * 0.48);
    g.closePath();
    g.fillPath();

    g.fillStyle(0x5b3a29, 1);
    g.fillRect(s * 0.44, s * 0.68, s * 0.12, s * 0.22);

    g.generateTexture('house', s, s);
    g.destroy();
  }

  drawGrid() {
    const offsetX = Math.round((this.scale.width - GRID_COLS * TILE_SIZE) / 2);
    const offsetY = Math.round((this.scale.height - GRID_ROWS * TILE_SIZE) / 2);
    this.gridOffset = { x: offsetX, y: offsetY };

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const texture = (row + col) % 2 === 0 ? 'tile-light' : 'tile-dark';
        const x = offsetX + col * TILE_SIZE;
        const y = offsetY + row * TILE_SIZE;
        this.add.image(x, y, texture).setOrigin(0);
      }
    }
  }

  drawHud() {
    this.add.text(16, 12, 'Deflord — Fase 0: núcleo visual del pueblo', {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#e8f0e8',
    });
    this.add.text(16, 36, 'Toca una casilla para colocar/quitar una casa', {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: '#b7c9b7',
    });
  }

  handlePointerDown(pointer) {
    const { x: offsetX, y: offsetY } = this.gridOffset;
    const col = Math.floor((pointer.worldX - offsetX) / TILE_SIZE);
    const row = Math.floor((pointer.worldY - offsetY) / TILE_SIZE);

    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;

    const key = `${col},${row}`;
    const existing = this.houses.get(key);

    if (existing) {
      existing.destroy();
      this.houses.delete(key);
      return;
    }

    const x = offsetX + col * TILE_SIZE;
    const y = offsetY + row * TILE_SIZE;
    const house = this.add.image(x, y, 'house').setOrigin(0);
    this.houses.set(key, house);
  }
}
