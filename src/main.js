import Phaser from 'phaser';
import VillageScene from './scenes/VillageScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#1b2a1b',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 800,
    height: 712,
  },
  scene: [VillageScene],
};

const game = new Phaser.Game(config);

// Acceso de conveniencia para depuración manual desde la consola del navegador.
window.__deflordGame = game;
