import * as THREE from 'three'
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'
import { colorForIndex, layoutText, type FXContext, type TextMode } from './core'

const CFG = {
  count: 9000,
  size: 0.085,
  springK: 11, // snappier assembly
  damping: 0.8,
  wander: 0.7,
  cursorRadius: 2.6,
  cursorStrength: 16,
}

/** Builds a soft round sprite so points read as glow dots. */
function makeSprite(): THREE.Texture {
  const s = 64
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.3, 'rgba(255,255,255,0.85)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  const tex = new THREE.Texture(c)
  tex.needsUpdate = true
  return tex
}

/** Text rendered as thousands of glowing points that fly in and assemble. */
export class ParticleMode implements TextMode {
  private ctx: FXContext
  private sprite: THREE.Texture
  private points: THREE.Points | null = null

  private count = 0
  private pos!: Float32Array
  private vel!: Float32Array
  private target!: Float32Array
  private seed!: Float32Array
  private letterIndex!: Uint16Array

  constructor(ctx: FXContext) {
    this.ctx = ctx
    this.sprite = makeSprite()
  }

  build(text: string, font: Font) {
    this.dispose()
    const glyphs = layoutText(text, font, this.ctx.getBounds().w)
    if (glyphs.length === 0) return

    const areas = glyphs.map((g) => {
      const b = g.bbox
      return Math.max(0.01, (b.max.x - b.min.x) * (b.max.y - b.min.y))
    })
    const totalArea = areas.reduce((s, a) => s + a, 0)
    const counts = areas.map((a) =>
      Math.max(1, Math.round((CFG.count * a) / totalArea)),
    )
    this.count = counts.reduce((s, c) => s + c, 0)

    this.pos = new Float32Array(this.count * 3)
    this.vel = new Float32Array(this.count * 3)
    this.target = new Float32Array(this.count * 3)
    this.seed = new Float32Array(this.count)
    this.letterIndex = new Uint16Array(this.count)

    const sample = new THREE.Vector3()
    const spawnR = this.ctx.getBounds().w * 0.4
    let p = 0
    glyphs.forEach((g, gi) => {
      const sgeo = g.geo.clone()
      sgeo.translate(g.cx, 0, 0)
      const sampler = new MeshSurfaceSampler(new THREE.Mesh(sgeo)).build()
      for (let k = 0; k < counts[gi]; k++) {
        sampler.sample(sample)
        const i3 = p * 3
        this.target[i3] = sample.x
        this.target[i3 + 1] = sample.y
        this.target[i3 + 2] = sample.z
        // start near the target so it assembles quickly
        const dir = new THREE.Vector3()
          .randomDirection()
          .multiplyScalar(spawnR * (0.3 + Math.random() * 0.7))
        this.pos[i3] = sample.x + dir.x
        this.pos[i3 + 1] = sample.y + dir.y
        this.pos[i3 + 2] = sample.z + dir.z
        this.seed[p] = Math.random() * Math.PI * 2
        this.letterIndex[p] = gi
        p++
      }
      sgeo.dispose()
      g.geo.dispose()
    })

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(new Float32Array(this.count * 3), 3),
    )

    const material = new THREE.PointsMaterial({
      size: CFG.size,
      map: this.sprite,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.95,
      sizeAttenuation: true,
    })

    this.points = new THREE.Points(geometry, material)
    this.points.frustumCulled = false
    this.ctx.scene.add(this.points)
    this.applyColors()
  }

  applyColors() {
    if (!this.points) return
    const colorAttr = this.points.geometry.getAttribute(
      'color',
    ) as THREE.BufferAttribute
    const c = new THREE.Color()
    for (let i = 0; i < this.count; i++) {
      c.copy(colorForIndex(this.ctx.options, this.letterIndex[i]))
      colorAttr.setXYZ(i, c.r, c.g, c.b)
    }
    colorAttr.needsUpdate = true
  }

  setStrings() {}
  onPointerDown() {}
  onPointerUp() {}
  onResize() {}

  pop() {
    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3
      const len =
        Math.hypot(this.pos[i3], this.pos[i3 + 1], this.pos[i3 + 2]) || 1
      const f = 14
      this.vel[i3] += (this.pos[i3] / len) * f
      this.vel[i3 + 1] += (this.pos[i3 + 1] / len) * f
      this.vel[i3 + 2] += (this.pos[i3 + 2] / len) * f
    }
  }

  update(dt: number, time: number) {
    if (!this.points) return
    const { springK, damping, wander, cursorRadius, cursorStrength } = CFG
    const r2 = cursorRadius * cursorRadius

    const cur = new THREE.Vector3()
    const active = this.ctx.isPointerActive()
    if (active) this.ctx.pointerToWorld(0, cur)

    for (let i = 0; i < this.count; i++) {
      const i3 = i * 3
      const s = this.seed[i]
      const x = this.pos[i3]
      const y = this.pos[i3 + 1]
      const z = this.pos[i3 + 2]

      let ax = (this.target[i3] - x) * springK
      let ay = (this.target[i3 + 1] - y) * springK
      let az = (this.target[i3 + 2] - z) * springK

      ax += Math.sin(time * 1.7 + s) * wander
      ay += Math.cos(time * 1.3 + s * 1.3) * wander
      az += Math.sin(time * 1.1 + s * 0.7) * wander * 0.5

      if (active) {
        const dx = x - cur.x
        const dy = y - cur.y
        const d2 = dx * dx + dy * dy
        if (d2 < r2) {
          const d = Math.sqrt(d2) || 1
          const falloff = (1 - d / cursorRadius) * cursorStrength
          ax += (dx / d) * falloff
          ay += (dy / d) * falloff
        }
      }

      const vx = this.vel[i3] * damping + ax * dt
      const vy = this.vel[i3 + 1] * damping + ay * dt
      const vz = this.vel[i3 + 2] * damping + az * dt
      this.vel[i3] = vx
      this.vel[i3 + 1] = vy
      this.vel[i3 + 2] = vz
      this.pos[i3] = x + vx * dt
      this.pos[i3 + 1] = y + vy * dt
      this.pos[i3 + 2] = z + vz * dt
    }

    ;(
      this.points.geometry.getAttribute('position') as THREE.BufferAttribute
    ).needsUpdate = true
  }

  dispose() {
    if (this.points) {
      this.ctx.scene.remove(this.points)
      this.points.geometry.dispose()
      ;(this.points.material as THREE.Material).dispose()
      this.points = null
    }
    this.count = 0
  }
}
