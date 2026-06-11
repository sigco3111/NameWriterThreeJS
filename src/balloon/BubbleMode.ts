import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'
import { colorForIndex, layoutText, type FXContext, type TextMode } from './core'

interface Magnet {
  home: THREE.Vector3
  center: THREE.Vector3
  slots: Float32Array // slot offsets relative to home (count * 3)
  count: number
  phase: number
  proxy: THREE.Mesh // invisible hit target for dragging the cluster
}

const FAR = new CANNON.Vec3(0, 0, 999)

/**
 * Each letter is a cluster of glossy balloon spheres that genuinely collide
 * with one another (cannon-es). Drag a cluster to plough it through the
 * others, or shove the balls around with the cursor collider.
 */
export class BubbleMode implements TextMode {
  private ctx: FXContext
  private world: CANNON.World
  private cursorBody: CANNON.Body

  private magnets: Magnet[] = []
  private mesh: THREE.InstancedMesh | null = null
  private dummy = new THREE.Object3D()

  private n = 0
  private bodies: CANNON.Body[] = []
  private key!: Float32Array
  private owner!: Int16Array
  private seed!: Float32Array
  private slot!: Int32Array // resolved slot index * 3 per sphere
  private baseRadius = 0.1
  private lastSize = -1

  private dragged = -1
  private dragOffset = new THREE.Vector3()

  constructor(ctx: FXContext) {
    this.ctx = ctx
    this.world = new CANNON.World()
    this.world.gravity.set(0, 0, 0)
    this.world.allowSleep = false
    this.world.broadphase = new CANNON.SAPBroadphase(this.world)
    this.world.defaultContactMaterial.restitution = 0.08
    this.world.defaultContactMaterial.friction = 0

    this.cursorBody = new CANNON.Body({ type: CANNON.Body.KINEMATIC, mass: 0 })
    this.cursorBody.addShape(new CANNON.Sphere(0.8))
    this.cursorBody.position.copy(FAR)
    this.world.addBody(this.cursorBody)
  }

  build(text: string, font: Font) {
    this.dispose()
    const glyphs = layoutText(text, font, this.ctx.getBounds().w)
    if (glyphs.length === 0) return

    this.baseRadius = glyphs[0].size * 0.09
    const total = Math.round(this.ctx.options.sphereCount)
    const r0 = this.baseRadius * this.ctx.options.sphereSize
    this.cursorBody.shapes[0] = new CANNON.Sphere(glyphs[0].size * 0.55)
    this.cursorBody.updateBoundingRadius()

    const areas = glyphs.map((g) => {
      const b = g.bbox
      return Math.max(0.01, (b.max.x - b.min.x) * (b.max.y - b.min.y))
    })
    const totalArea = areas.reduce((s, a) => s + a, 0)
    const counts = areas.map((a) =>
      Math.max(6, Math.round((total * a) / totalArea)),
    )
    this.n = counts.reduce((s, c) => s + c, 0)

    this.key = new Float32Array(this.n)
    this.owner = new Int16Array(this.n)
    this.seed = new Float32Array(this.n)
    this.slot = new Int32Array(this.n)

    const proxyMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })

    const sample = new THREE.Vector3()
    const spawnR = this.ctx.getBounds().w * 0.45
    let p = 0
    glyphs.forEach((g, gi) => {
      const home = new THREE.Vector3(g.cx, 0, 0)
      const slots = new Float32Array(counts[gi] * 3)

      const sgeo = g.geo.clone()
      sgeo.translate(g.cx, 0, 0)
      const sampler = new MeshSurfaceSampler(new THREE.Mesh(sgeo)).build()
      for (let k = 0; k < counts[gi]; k++) {
        sampler.sample(sample)
        slots[k * 3] = sample.x - home.x
        slots[k * 3 + 1] = sample.y - home.y
        slots[k * 3 + 2] = sample.z - home.z

        const dir = new THREE.Vector3()
          .randomDirection()
          .multiplyScalar(spawnR * (0.3 + Math.random() * 0.7))
        const body = new CANNON.Body({
          mass: 1,
          shape: new CANNON.Sphere(r0),
          position: new CANNON.Vec3(
            sample.x + dir.x,
            sample.y + dir.y,
            sample.z + dir.z,
          ),
          linearDamping: 0.6,
          angularDamping: 0.6,
        })
        this.world.addBody(body)
        this.bodies.push(body)

        this.key[p] = (k + 0.5) / counts[gi]
        this.owner[p] = gi
        this.seed[p] = Math.random() * Math.PI * 2
        this.slot[p] = Math.min(counts[gi] - 1, (this.key[p] * counts[gi]) | 0) * 3
        p++
      }
      sgeo.dispose()
      g.geo.dispose()

      const bb = g.bbox
      const proxy = new THREE.Mesh(
        new THREE.BoxGeometry(
          bb.max.x - bb.min.x,
          bb.max.y - bb.min.y,
          bb.max.z - bb.min.z,
        ),
        proxyMat,
      )
      proxy.position.copy(home)
      this.ctx.scene.add(proxy)

      this.magnets.push({
        home,
        center: home.clone(),
        slots,
        count: counts[gi],
        phase: Math.random() * Math.PI * 2,
        proxy,
      })
    })

    const geo = new THREE.IcosahedronGeometry(this.baseRadius, 2)
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.3,
      roughness: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.18,
      sheen: 1,
      sheenColor: new THREE.Color('#ffffff'),
      iridescence: 0.4,
      iridescenceIOR: 1.3,
      envMapIntensity: 1.2,
    })
    this.mesh = new THREE.InstancedMesh(geo, mat, this.n)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.ctx.scene.add(this.mesh)
    this.lastSize = this.ctx.options.sphereSize
    this.applyColors()
  }

  applyColors() {
    if (!this.mesh) return
    const c = new THREE.Color()
    for (let i = 0; i < this.n; i++) {
      c.copy(colorForIndex(this.ctx.options, this.owner[i]))
      this.mesh.setColorAt(i, c)
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  setStrings() {}

  onPointerDown() {
    this.ctx.raycaster.setFromCamera(this.ctx.pointer, this.ctx.camera)
    const proxies = this.magnets.map((m) => m.proxy)
    const hit = this.ctx.raycaster.intersectObjects(proxies, false)[0]
    if (!hit) return
    const idx = this.magnets.findIndex((m) => m.proxy === hit.object)
    this.dragged = idx
    this.dragOffset.copy(hit.point).sub(this.magnets[idx].center)
  }

  onPointerUp() {
    this.dragged = -1
  }

  onResize() {}

  pop() {
    for (const b of this.bodies) {
      const len = b.position.length() || 1
      const f = 18
      b.velocity.x += (b.position.x / len) * f
      b.velocity.y += (b.position.y / len) * f
      b.velocity.z += (b.position.z / len) * f
    }
  }

  update(dt: number, time: number) {
    if (!this.mesh || this.n === 0) return

    // keep collider radius in sync with the size slider
    if (this.ctx.options.sphereSize !== this.lastSize) {
      this.lastSize = this.ctx.options.sphereSize
      const r = this.baseRadius * this.lastSize
      for (const b of this.bodies) {
        ;(b.shapes[0] as CANNON.Sphere).radius = r
        b.shapes[0].updateBoundingSphereRadius()
        b.updateBoundingRadius()
      }
    }

    // cursor collider: follows the pointer (when not dragging a cluster)
    const cur = new THREE.Vector3()
    const active = this.ctx.isPointerActive()
    if (active) this.ctx.pointerToWorld(0, cur)
    if (active && this.dragged < 0) {
      this.cursorBody.position.set(cur.x, cur.y, cur.z)
    } else {
      this.cursorBody.position.copy(FAR)
    }

    // move magnet centres
    if (this.dragged >= 0 && active) {
      this.magnets[this.dragged].center.set(
        cur.x - this.dragOffset.x,
        cur.y - this.dragOffset.y,
        0,
      )
    }
    this.magnets.forEach((m, i) => {
      if (i !== this.dragged) {
        const bx = m.home.x + Math.cos(time * 0.7 + m.phase) * 0.12
        const by = m.home.y + Math.sin(time * 0.9 + m.phase) * 0.12
        m.center.x += (bx - m.center.x) * 0.05
        m.center.y += (by - m.center.y) * 0.05
        m.center.z += (m.home.z - m.center.z) * 0.05
      }
      m.proxy.position.copy(m.center)
    })

    // pull each ball toward its slot; collisions resolve the packing
    for (let i = 0; i < this.n; i++) {
      const b = this.bodies[i]
      const mg = this.magnets[this.owner[i]]
      const s = this.slot[i]
      const k = this.owner[i] === this.dragged ? 60 : 34
      b.applyForce(
        new CANNON.Vec3(
          (mg.center.x + mg.slots[s] - b.position.x) * k,
          (mg.center.y + mg.slots[s + 1] - b.position.y) * k,
          (mg.center.z + mg.slots[s + 2] - b.position.z) * k,
        ),
      )
      const sd = this.seed[i]
      b.applyForce(
        new CANNON.Vec3(
          Math.sin(time * 1.4 + sd) * 0.6,
          Math.cos(time * 1.1 + sd) * 0.6,
          0,
        ),
      )
    }

    this.world.step(1 / 60, dt, 3)

    const scale = this.ctx.options.sphereSize
    for (let i = 0; i < this.n; i++) {
      const b = this.bodies[i]
      this.dummy.position.set(b.position.x, b.position.y, b.position.z)
      this.dummy.quaternion.set(
        b.quaternion.x,
        b.quaternion.y,
        b.quaternion.z,
        b.quaternion.w,
      )
      this.dummy.scale.setScalar(scale)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(i, this.dummy.matrix)
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }

  dispose() {
    if (this.mesh) {
      this.ctx.scene.remove(this.mesh)
      this.mesh.geometry.dispose()
      ;(this.mesh.material as THREE.Material).dispose()
      this.mesh = null
    }
    for (const b of this.bodies) this.world.removeBody(b)
    this.bodies = []
    for (const m of this.magnets) {
      this.ctx.scene.remove(m.proxy)
      m.proxy.geometry.dispose()
    }
    this.magnets = []
    this.n = 0
    this.dragged = -1
  }
}
