import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import gsap from 'gsap'
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import { colorForIndex, layoutText, type FXContext, type TextMode } from './core'

interface Letter {
  mesh: THREE.Mesh
  body: CANNON.Body
  home: THREE.Vector3
  phase: number
  halfY: number
  index: number
  pop: { v: number }
  string?: THREE.Line
}

const STRING_SEGMENTS = 14

/** Inflated foil-balloon letters with helium physics, drag & throw. */
export class BalloonMode implements TextMode {
  private ctx: FXContext
  private world: CANNON.World
  private cursorBody: CANNON.Body
  private walls: CANNON.Body[] = []
  private letters: Letter[] = []

  private dragged: Letter | null = null
  private dragConstraint: CANNON.PointToPointConstraint | null = null
  private dragDepth = 0

  constructor(ctx: FXContext) {
    this.ctx = ctx
    this.world = new CANNON.World()
    this.world.gravity.set(0, 0, 0)
    this.world.allowSleep = false
    this.world.defaultContactMaterial.restitution = 0.35
    this.world.defaultContactMaterial.friction = 0.02

    this.cursorBody = new CANNON.Body({ type: CANNON.Body.KINEMATIC, mass: 0 })
    this.cursorBody.addShape(new CANNON.Sphere(0.2))
    this.world.addBody(this.cursorBody)

    this.buildWalls()
  }

  private buildWalls() {
    const make = (nx: number, ny: number, nz: number) => {
      const body = new CANNON.Body({ type: CANNON.Body.STATIC, mass: 0 })
      body.addShape(new CANNON.Plane())
      body.quaternion.setFromVectors(
        new CANNON.Vec3(0, 0, 1),
        new CANNON.Vec3(nx, ny, nz),
      )
      this.world.addBody(body)
      this.walls.push(body)
    }
    make(1, 0, 0)
    make(-1, 0, 0)
    make(0, 1, 0)
    make(0, -1, 0)
    make(0, 0, 1)
    make(0, 0, -1)
    this.onResize()
  }

  onResize() {
    const { w, h, d } = this.ctx.getBounds()
    const p: [number, number, number][] = [
      [-w / 2, 0, 0],
      [w / 2, 0, 0],
      [0, -h / 2, 0],
      [0, h / 2, 0],
      [0, 0, -d / 2],
      [0, 0, d / 2],
    ]
    this.walls.forEach((body, i) => body.position.set(...p[i]))
  }

  build(text: string, font: Font) {
    this.dispose(true)
    const glyphs = layoutText(text, font, this.ctx.getBounds().w)
    glyphs.forEach((g, index) => {
      const material = new THREE.MeshPhysicalMaterial({
        metalness: 0.35,
        roughness: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.18,
        sheen: 1,
        iridescence: 0.5,
        iridescenceIOR: 1.3,
        envMapIntensity: 1.2,
      })
      const mesh = new THREE.Mesh(g.geo, material)
      const home = new THREE.Vector3(g.cx, 0, 0)
      mesh.position.copy(home)
      mesh.scale.setScalar(0.001)
      this.ctx.scene.add(mesh)

      const bb = g.bbox
      const half = new CANNON.Vec3(
        Math.max(0.2, (bb.max.x - bb.min.x) / 2),
        Math.max(0.2, (bb.max.y - bb.min.y) / 2),
        Math.max(0.2, (bb.max.z - bb.min.z) / 2),
      )
      const body = new CANNON.Body({
        mass: 1.1,
        shape: new CANNON.Box(half),
        position: new CANNON.Vec3(g.cx, 0, 0),
        linearDamping: 0.55,
        angularDamping: 0.7,
      })
      body.collisionResponse = false
      this.world.addBody(body)

      const letter: Letter = {
        mesh,
        body,
        home,
        phase: Math.random() * Math.PI * 2,
        halfY: bb.max.y,
        index,
        pop: { v: 0.001 },
      }
      this.letters.push(letter)
      this.applyColor(letter)
      if (this.ctx.options.strings) this.makeString(letter)

      gsap.to(letter.pop, {
        v: 1,
        duration: 1.1,
        ease: 'elastic.out(1, 0.45)',
        delay: 0.06 * index,
        onComplete: () => {
          body.collisionResponse = true
        },
      })
    })
  }

  // ----- colour & strings -----

  private applyColor(letter: Letter) {
    const c = colorForIndex(this.ctx.options, letter.index)
    const mat = letter.mesh.material as THREE.MeshPhysicalMaterial
    mat.color.copy(c)
    mat.sheenColor = c.clone().lerp(new THREE.Color('#ffffff'), 0.4)
    mat.needsUpdate = true
  }

  applyColors() {
    this.letters.forEach((l) => this.applyColor(l))
  }

  setStrings(on: boolean) {
    for (const l of this.letters) {
      if (on && !l.string) this.makeString(l)
      else if (!on && l.string) this.removeString(l)
    }
  }

  private makeString(letter: Letter) {
    const positions = new Float32Array(STRING_SEGMENTS * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
    })
    const line = new THREE.Line(geo, mat)
    line.frustumCulled = false
    this.ctx.scene.add(line)
    letter.string = line
    this.updateString(letter)
  }

  private removeString(letter: Letter) {
    if (!letter.string) return
    this.ctx.scene.remove(letter.string)
    letter.string.geometry.dispose()
    ;(letter.string.material as THREE.Material).dispose()
    letter.string = undefined
  }

  private updateString(letter: Letter) {
    const line = letter.string
    if (!line) return
    const attach = new THREE.Vector3(0, -letter.halfY * letter.mesh.scale.y, 0)
    attach.applyQuaternion(letter.mesh.quaternion).add(letter.mesh.position)
    const len = letter.halfY * 3 + 1.4
    const bottom = attach.clone().add(new THREE.Vector3(0, -len, 0))
    const control = attach.clone().add(bottom).multiplyScalar(0.5)
    control.x -= letter.body.velocity.x * 0.08
    control.z -= letter.body.velocity.z * 0.08
    control.y -= len * 0.12

    const pos = line.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < STRING_SEGMENTS; i++) {
      const t = i / (STRING_SEGMENTS - 1)
      const mt = 1 - t
      const a = mt * mt
      const b = 2 * mt * t
      const c = t * t
      pos.setXYZ(
        i,
        a * attach.x + b * control.x + c * bottom.x,
        a * attach.y + b * control.y + c * bottom.y,
        a * attach.z + b * control.z + c * bottom.z,
      )
    }
    pos.needsUpdate = true
  }

  // ----- interaction -----

  onPointerDown() {
    this.ctx.raycaster.setFromCamera(this.ctx.pointer, this.ctx.camera)
    const meshes = this.letters.map((l) => l.mesh)
    const hit = this.ctx.raycaster.intersectObjects(meshes, false)[0]
    if (!hit) return
    const letter = this.letters.find((l) => l.mesh === hit.object)
    if (!letter) return

    this.dragged = letter
    this.dragDepth = letter.body.position.z
    const p = hit.point
    this.cursorBody.position.set(p.x, p.y, p.z)
    letter.body.wakeUp()

    this.dragConstraint = new CANNON.PointToPointConstraint(
      letter.body,
      new CANNON.Vec3(
        p.x - letter.body.position.x,
        p.y - letter.body.position.y,
        p.z - letter.body.position.z,
      ),
      this.cursorBody,
      new CANNON.Vec3(0, 0, 0),
      28,
    )
    this.world.addConstraint(this.dragConstraint)
  }

  onPointerUp() {
    if (this.dragConstraint) {
      this.world.removeConstraint(this.dragConstraint)
      this.dragConstraint = null
    }
    this.dragged = null
  }

  pop() {
    const current = [...this.letters]
    this.letters = []
    for (const l of current) {
      this.world.removeBody(l.body)
      this.removeString(l)
      gsap.to(l.mesh.scale, {
        x: 1.5,
        y: 1.5,
        z: 1.5,
        duration: 0.12,
        ease: 'power2.out',
        onComplete: () => {
          gsap.to(l.mesh.scale, {
            x: 0.001,
            y: 0.001,
            z: 0.001,
            duration: 0.18,
            ease: 'power3.in',
            onComplete: () => {
              this.ctx.scene.remove(l.mesh)
              l.mesh.geometry.dispose()
              ;(l.mesh.material as THREE.Material).dispose()
            },
          })
        },
      })
    }
  }

  // ----- loop -----

  update(dt: number, time: number) {
    const cursorWorld = new THREE.Vector3()
    if (this.dragged) {
      this.ctx.pointerToWorld(this.dragDepth, cursorWorld)
      this.cursorBody.position.set(cursorWorld.x, cursorWorld.y, cursorWorld.z)
    }

    const repel = new THREE.Vector3()
    const active = this.ctx.isPointerActive()
    if (active) this.ctx.pointerToWorld(0, repel)

    for (const l of this.letters) {
      const b = l.body
      if (l !== this.dragged) {
        b.applyForce(
          new CANNON.Vec3(
            (l.home.x - b.position.x) * 6,
            (l.home.y - b.position.y) * 6,
            (l.home.z - b.position.z) * 6,
          ),
        )
        b.applyForce(
          new CANNON.Vec3(
            Math.cos(time * 0.9 + l.phase) * 1.4,
            Math.sin(time * 1.3 + l.phase) * 1.8,
            Math.sin(time * 0.7 + l.phase) * 0.8,
          ),
        )
        if (active && !this.dragConstraint) {
          const dx = b.position.x - repel.x
          const dy = b.position.y - repel.y
          const d2 = dx * dx + dy * dy
          if (d2 < 9) {
            const f = (9 - d2) * 2.2
            const len = Math.sqrt(d2) || 1
            b.applyForce(new CANNON.Vec3((dx / len) * f, (dy / len) * f, 0))
          }
        }
      }
    }

    this.world.step(1 / 60, dt, 3)

    for (const l of this.letters) {
      l.mesh.position.set(l.body.position.x, l.body.position.y, l.body.position.z)
      l.mesh.quaternion.set(
        l.body.quaternion.x,
        l.body.quaternion.y,
        l.body.quaternion.z,
        l.body.quaternion.w,
      )
      l.mesh.scale.setScalar(l.pop.v)
      if (l.string) this.updateString(l)
    }
  }

  dispose(keepWorld = false) {
    for (const l of this.letters) {
      this.removeString(l)
      this.ctx.scene.remove(l.mesh)
      l.mesh.geometry.dispose()
      ;(l.mesh.material as THREE.Material).dispose()
      this.world.removeBody(l.body)
    }
    this.letters = []
    if (this.dragConstraint) {
      this.world.removeConstraint(this.dragConstraint)
      this.dragConstraint = null
    }
    this.dragged = null
    if (keepWorld) return
  }
}
