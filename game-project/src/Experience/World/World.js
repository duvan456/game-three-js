import * as THREE from 'three'

import Environment from './Environment.js'
import Fox from './Fox.js'
import Robot from './Robot.js'
import ToyCarLoader from '../../loaders/ToyCarLoader.js'
import Floor from './Floor.js'
import ThirdPersonCamera from './ThirdPersonCamera.js'
import Sound from './Sound.js'
import AmbientSound from './AmbientSound.js'
import MobileControls from '../../controls/MobileControls.js'
import LevelManager from './LevelManager.js';
import * as CANNON from 'cannon-es' // Añadir esta importación
import Prize from './Prize.js'  // Añadir esta línea



export default class World {
    constructor(experience) {
        this.experience = experience
        this.scene = this.experience.scene
        this.resources = this.experience.resources
        this.levelManager = new LevelManager(this.experience);

        // Sonidos
        this.coinSound = new Sound('/sounds/coin.ogg')
        this.ambientSound = new AmbientSound('/sounds/ambiente.mp3')
        this.winner = new Sound('/sounds/winner.mp3')

        this.allowPrizePickup = false
        this.hasMoved = false


        // Permitimos recoger premios tras 2s
        setTimeout(() => {
            this.allowPrizePickup = true
            // console.log('✅ Ahora se pueden recoger premios')
        }, 2000)

        // Cuando todo esté cargado...
        this.resources.on('ready', async () => {
            // 1️⃣ Mundo base
            this.floor = new Floor(this.experience)
            this.environment = new Environment(this.experience)

            this.loader = new ToyCarLoader(this.experience)
            await this.loader.loadFromAPI()

            // 2️⃣ Personajes
            this.fox = new Fox(this.experience)
            this.robot = new Robot(this.experience)


            this.experience.tracker.showCancelButton()
            //Registrando experiencia VR con el robot
            this.experience.vr.bindCharacter(this.robot)
            this.thirdPersonCamera = new ThirdPersonCamera(this.experience, this.robot.group)

            // 3️⃣ Cámara
            this.thirdPersonCamera = new ThirdPersonCamera(this.experience, this.robot.group)

            // 4️⃣ Controles móviles (tras crear robot)
            this.mobileControls = new MobileControls({
                onUp: (pressed) => { this.experience.keyboard.keys.up = pressed },
                onDown: (pressed) => { this.experience.keyboard.keys.down = pressed },
                onLeft: (pressed) => { this.experience.keyboard.keys.left = pressed },
                onRight: (pressed) => { this.experience.keyboard.keys.right = pressed }
            })


        })

    }

    toggleAudio() {
        this.ambientSound.toggle()
    }

    update(delta) {
        // Actualiza personajes y cámara
        this.fox?.update()
        this.robot?.update()

        if (this.thirdPersonCamera && this.experience.isThirdPerson && !this.experience.renderer.instance.xr.isPresenting) {
            this.thirdPersonCamera.update()
        }

        // Gira premios
        this.loader?.prizes?.forEach((prize, idx) => {
            if (prize.collected || !prize.pivot) return

            const pos = this.robot.body.position
            let dist;

            // Comprobar distancia usando la posición correcta
            if (prize.body) {
                dist = prize.body.position.distanceTo(pos)
            } else {
                dist = prize.pivot.position.distanceTo(new THREE.Vector3(pos.x, pos.y, pos.z))
            }

            if (dist < 1.2) {
                prize.collect()
                this.loader.prizes.splice(idx, 1)

                // Incrementar puntos
                this.points = (this.points || 0) + 1
                this.robot.points = this.points

                // Sonido
                if (window.userInteracted) {
                    this.coinSound.play()
                }

                // Actualizar HUD
                this.experience.menu.setStatus(
                    `🎮 Nivel ${this.levelManager.currentLevel} | 🎖️ Puntos: ${this.points}`
                )

                // Verificar si es moneda final
                if (prize.model.name === 'ticket-coin-final_lev2') {
                    this.experience.handleLevelCompletion(2)
                }
            }
        })


        // Lógica unificada de recolección de monedas
        if (this.allowPrizePickup && this.loader && this.robot) {
            this.loader.prizes.forEach((prize, idx) => {
                if (prize.collected || !prize.pivot) return

                const pos = this.robot.body.position
                const prizePos = prize.body ? prize.body.position : prize.pivot.position
                
                // Calcular distancia en 3D
                const dist = new THREE.Vector3(pos.x, pos.y, pos.z)
                    .distanceTo(new THREE.Vector3(prizePos.x, prizePos.y, prizePos.z))

                // Radio de colección aumentado
                if (dist < 2.0) {
                    console.log(`🎯 Recogiendo moneda: ${prize.model.name} a distancia: ${dist}`);
                    
                    prize.collect()
                    this.loader.prizes.splice(idx, 1)

                    // Incrementar puntos
                    this.points = (this.points || 0) + 1
                    this.robot.points = this.points

                    // Sonido
                    if (window.userInteracted) {
                        this.coinSound.play()
                    }

                    // Actualizar HUD
                    this.experience.menu.setStatus(
                        `🎮 Nivel ${this.levelManager.currentLevel} | 🎖️ Puntos: ${this.points}`
                    )

                    // Verificar si es moneda final
                    if (prize.model.name.includes('final')) {
                        if (this.levelManager.currentLevel === 2) {
                            this.experience.handleLevelCompletion(2)
                        }
                    }
                }
            })
        }

        // ✅ Evaluar fuera del bucle de premios
        if (this.points === 2 && !this.experience.tracker.finished) {
            if (this.levelManager.currentLevel < this.levelManager.totalLevels) {
                console.log("✅ Completaste el nivel, pasando al siguiente...");

                if (!this.experience.tracker.finished) { // 🔵 AGREGAR ESTE CONTROL
                    this.levelManager.nextLevel();
                    this.points = 0;
                    this.robot.points = 0;
                }

                return; // 🔥 Importantísimo detener el flujo aquí
            } else {
                console.log('🏁 Completaste el último nivel, terminando partida...');
                const elapsed = this.experience.tracker.stop();
                this.experience.tracker.saveTime(elapsed);
                this.experience.tracker.showEndGameModal(elapsed);

                this.experience.obstacleWavesDisabled = true;
                clearTimeout(this.experience.obstacleWaveTimeout);
                this.experience.raycaster?.removeAllObstacles();
                if (window.userInteracted) {
                    this.winner.play();
                }
            }
        }



    }

    async loadLevel(level) {
        try {
            // Limpiar premios existentes
            if (this.loader && this.loader.prizes) {
                this.loader.prizes.forEach(prize => {
                    if (prize.body && this.experience.physics) {
                        this.experience.physics.world.removeBody(prize.body);
                    }
                    if (prize.pivot) {
                        this.scene.remove(prize.pivot);
                    }
                });
                this.loader.prizes = [];
            }

            // Cargar nuevos datos
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
            const apiUrl = `${backendUrl}/api/blocks?level=${level}`;
            
            const response = await fetch(apiUrl, {
                cache: 'no-cache'
            });
            const data = await response.json();
            
            console.log('🎯 Datos cargados:', data);

            // Filtrar solo las monedas del nivel actual
            const coins = data.filter(item => 
                item.name && 
                (item.name.includes('coin') || item.name.includes('ticket-coin')) && 
                item.level === level
            );

            console.log(`💰 Monedas encontradas para nivel ${level}:`, coins);

            // Asegurar que el robot esté en la posición correcta
            if (this.robot) {
                this.robot.group.position.set(0, 1.2, 0);
                if (this.robot.body) {
                    this.robot.body.position.set(0, 1.2, 0);
                    this.robot.body.velocity.setZero();
                    this.robot.body.angularVelocity.setZero();
                }
            }

            // Cargar elementos del nivel
            await this.loader.loadFromURL(apiUrl);

            // Crear los premios con física
            coins.forEach(coinData => {
                const model = this.resources.items[coinData.name];
                
                if (!model) {
                    console.error(`❌ No se encontró el modelo para: ${coinData.name}`);
                    console.log('📦 Modelos disponibles:', Object.keys(this.resources.items));
                    return;
                }

                console.log(`🔍 Cargando moneda "${coinData.name}"...`);

                try {
                    const prize = new Prize({
                        model: model,
                        position: new THREE.Vector3(coinData.x, coinData.y, coinData.z),
                        scene: this.scene,
                        physics: this.experience.physics,
                        role: coinData.role || 'default'
                    });
                    
                    if (prize.model) {
                        this.loader.prizes.push(prize);
                        console.log(`✅ Moneda "${coinData.name}" cargada correctamente`);
                    }
                } catch (error) {
                    console.error(`❌ Error creando premio para ${coinData.name}:`, error);
                }
            });

            console.log(`🔍 Monedas cargadas para nivel ${level}:`, this.loader.prizes.length);

            // Actualizar HUD al cargar el nivel
            this.experience.menu.setStatus(`🎮 Nivel ${level} | 🎖️ Puntos: ${this.points || 0}`);

        } catch (error) {
            console.error('❌ Error cargando nivel:', error);
        }
    }

    clearCurrentScene() {
        if (!this.experience || !this.scene) {
            console.warn('⚠️ No se puede limpiar: experience o escena destruida.');
            return;
        }

        let visualObjectsRemoved = 0;
        let physicsBodiesRemoved = 0;

        // 🔵 Limpiar objetos visuales (Three.js)
        const childrenToRemove = [];

        this.scene.children.forEach((child) => {
            if (child.userData && child.userData.levelObject) {
                childrenToRemove.push(child);
            }
        });

        childrenToRemove.forEach((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }

            this.scene.remove(child); // 🔵 Primero limpiar la escena

            if (child.userData.physicsBody) {
                this.experience.physics.world.removeBody(child.userData.physicsBody); // 🔵 Luego limpiar la física
            }

            visualObjectsRemoved++;
        });



        let physicsBodiesRemaining = -1;

        // 🔵 Limpiar cuerpos físicos de Cannon-es
        if (this.experience.physics
            && this.experience.physics.world
            && Array.isArray(this.experience.physics.bodies)
            && this.experience.physics.bodies.length > 0) { // 🔥 Nuevo filtro aquí
        
            const survivingBodies = [];
            let bodiesBefore = this.experience.physics.bodies.length;
        
            this.experience.physics.bodies.forEach((body) => {
                if (body.userData && body.userData.levelObject) {
                    this.experience.physics.world.removeBody(body);
                    physicsBodiesRemoved++;
                } else {
                    survivingBodies.push(body);
                }
            });
        
            this.experience.physics.bodies = survivingBodies;
        
            console.log(`🧹 Physics Cleanup Report:`);
            console.log(`✅ Cuerpos físicos eliminados: ${physicsBodiesRemoved}`);
            console.log(`🎯 Cuerpos físicos sobrevivientes: ${survivingBodies.length}`);
            console.log(`📦 Estado inicial: ${bodiesBefore} cuerpos → Estado final: ${survivingBodies.length} cuerpos`);
        } else {
            console.warn('⚠️ Physics system no disponible o sin cuerpos activos, omitiendo limpieza física.');
        }
        



        console.log(`🧹 Escena limpiada antes de cargar el nuevo nivel.`);
        console.log(`✅ Objetos 3D eliminados: ${visualObjectsRemoved}`);
        console.log(`✅ Cuerpos físicos eliminados: ${physicsBodiesRemoved}`);
        console.log(`🎯 Objetos 3D actuales en escena: ${this.scene.children.length}`);

        if (physicsBodiesRemaining !== -1) {
            console.log(`🎯 Cuerpos físicos actuales en Physics World: ${physicsBodiesRemaining}`);
        }

        // Limpiar monedas
        if (this.loader && this.loader.prizes.length > 0) {
            this.loader.prizes.forEach(prize => {
                if (prize.body && this.experience.physics) {
                    this.experience.physics.world.removeBody(prize.body)
                }
                if (prize.pivot) {
                    this.scene.remove(prize.pivot)
                }
            })
            this.loader.prizes = []
            console.log('🎯 Premios del nivel anterior eliminados correctamente')
        }


    }

    handleCoinCollision(coin) {
        if (!coin || !coin.userData) return;

        // Detectar si es una moneda final
        if (coin.name === 'ticket-coin-final_lev2') {
            this.experience.handleLevelCompletion(2);
        } else if (coin.name === 'ticket-coin-final_lev1') {
            this.experience.handleLevelCompletion(1);
        } else {
            // Manejo normal de monedas
            this.points++;
            // ... resto del código de manejo de monedas
        }
    }



}
