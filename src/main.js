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

new Phaser.Game(config);
