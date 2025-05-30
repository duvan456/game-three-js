export default class LevelManager {
    constructor(experience) {
        this.experience = experience;
        this.currentLevel = 1;
        this.totalLevels = 2;
    }

    nextLevel() {
        if (this.currentLevel < this.totalLevels) {
            this.currentLevel++;
    
            // Limpiar escena antes de cargar el nuevo nivel
            this.experience.world.clearCurrentScene();
    
            // Resetear puntos al cambiar de nivel
            this.experience.world.points = 0;
            this.experience.world.robot.points = 0;
            
            // Actualizar HUD con el nuevo nivel
            this.experience.menu.setStatus(`🎮 Nivel ${this.currentLevel} | 🎖️ Puntos: 0`);
    
            // Cargar el siguiente nivel
            this.experience.world.loadLevel(this.currentLevel);

            console.log(`🎮 Avanzando al nivel ${this.currentLevel}`);
        }
    }

    resetLevel() {
        this.currentLevel = 1;
        this.experience.world.points = 0;
        this.experience.world.robot.points = 0;
        this.experience.menu.setStatus(`🎮 Nivel 1 | 🎖️ Puntos: 0`);
        this.experience.world.loadLevel(1);
    }
}
