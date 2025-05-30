import * as THREE from 'three'
import * as CANNON from 'cannon-es'

export default class Prize {
    constructor({ model, position, scene, physics, role = 'default' }) {
        this.scene = scene
        this.physics = physics
        this.collected = false
        this.role = role

        // Crear el pivot
        this.pivot = new THREE.Group()
        this.pivot.position.copy(position)

        // Clonar el modelo
        this.model = model.scene ? model.scene.clone() : model.clone()

        // Configurar colisión para TODAS las monedas
        if (physics && physics.world) {
            const shape = new CANNON.Sphere(0.8) // Aumentado el radio para mejor detección
            this.body = new CANNON.Body({
                mass: 0,
                shape: shape,
                position: new CANNON.Vec3(position.x, position.y, position.z),
                isTrigger: true,
                collisionResponse: false
            })

            this.body.userData = {
                isCoin: true,
                name: this.model.name,
                role: this.role
            }

            physics.world.addBody(this.body)
            console.log(`💰 Moneda creada: ${this.model.name} en (${position.x}, ${position.y}, ${position.z})`)
        }

        // Agregar visual
        this.pivot.add(this.model)
        this.scene.add(this.pivot)
    }

    update(delta) {
        if (this.collected) return

        // Rotar moneda
        this.pivot.rotation.y += delta * 1.5

        // Actualizar posición física con la visual
        if (this.body) {
            this.pivot.position.copy(this.body.position)
        }
    }

    collect() {
        if (this.collected) return

        this.collected = true
        console.log(`💫 Moneda recolectada: ${this.model.name}`)

        // Limpiar física
        if (this.body && this.physics && this.physics.world) {
            this.physics.world.removeBody(this.body)
        }

        // Limpiar visual
        if (this.pivot && this.scene) {
            this.scene.remove(this.pivot)
        }
    }
}