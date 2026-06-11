import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import gsap from 'gsap'
import { FontLoader, type Font } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import helvetikerBold from 'three/examples/fonts/helvetiker_bold.typeface.json?url'
import optimerBold from 'three/examples/fonts/optimer_bold.typeface.json?url'
import gentilisBold from 'three/examples/fonts/gentilis_bold.typeface.json?url'
import droidSansBold from 'three/examples/fonts/droid/droid_sans_bold.typeface.json?url'
import droidSerifBold from 'three/examples/fonts/droid/droid_serif_bold.typeface.json?url'

/** A glossy, candy-foil colour palette for the balloon letters. */
const PALETTE = [
  '#ff5d8f', // pink
  '#ff8c42', // tangerine
  '#ffd23f', // sunshine
  '#6ee7b7', // mint
  '#4cc9f0', // sky
  '#7c5cff', // violet
  '#ff5e7e', // coral
  '#22d3ee', // cyan
]

/** Fonts the user can pick from (all ship with three.js). */
export const FONTS: { key: string; label: string; url: string }[] = [
  { key: 'helvetiker_bold', label: 'Helvetiker', url: helvetikerBold },
  { key: 'optimer_bold', label: 'Optimer', url: optimerBold },
  { key: 'gentilis_bold', label: 'Gentilis', url: gentilisBold },
  { key: 'droid_sans_bold', label: 'Droid Sans', url: droidSansBold },
  { key: 'droid_serif_bold', label: 'Droid Serif', url: droidSerifBold },
]

export interface BalloonOptions {
  color: string
  multicolor: boolean
  strings: boolean
  fontKey: string
}

interface Letter {
  mesh: THREE.Mesh
  body: CANNON.Body
  home: THREE.Vector3
  phase: number
  halfY: number
  index: number
  string?: THREE.Line
}

const STRING_SEGMENTS = 14

export class BalloonText {
  private renderer!: THREE.WebGLRenderer
  private scene!: THREE.Scene
  private camera!: THREE.PerspectiveCamera
  private world!: CANNON.World
  private clock = new THREE.Clock()

  private letters: Letter[] = []
  private fontCache = new Map<string, Font>()
  private currentText = ''

  private opts: BalloonOptions = {
    color: '#ff5d8f',
    multicolor: true,
    strings: false,
    fontKey: 'helvetiker_bold',
  }

  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private pointerActive = false

  private dragged: Letter | null = null
  private dragConstraint: CANNON.PointToPointConstraint | null = null
  private cursorBody!: CANNON.Body
  private dragDepth = 0

  private walls: CANNON.Body[] = []
  private bounds = { w: 20, h: 12, d: 6 }

  private frameId = 0
  private disposed = false
  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.initThree()
    this.initPhysics()
    this.bindEvents()
    this.loop()
  }

  // ---------------------------------------------------------------- setup ---

  private initThree() {
    const { clientWidth: w, clientHeight: h } = this.canvas
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h, false)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05

    this.scene = new THREE.Scene()

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
    this.camera.position.set(0, 0, 16)

    // Free, asset-less reflections so the foil material actually shines.
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

    const key = new THREE.DirectionalLight(0xffffff, 2.2)
    key.position.set(5, 8, 10)
    this.scene.add(key)

    const rim = new THREE.DirectionalLight(0x9ad0ff, 1.4)
    rim.position.set(-8, -4, 4)
    this.scene.add(rim)

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4))

    this.updateBounds()
  }

  private initPhysics() {
    this.world = new CANNON.World()
    this.world.gravity.set(0, 0, 0) // helium: no gravity, letters drift
    this.world.allowSleep = false
    this.world.defaultContactMaterial.restitution = 0.35
    this.world.defaultContactMaterial.friction = 0.02

    // Kinematic body the mouse drags letters toward.
    this.cursorBody = new CANNON.Body({ type: CANNON.Body.KINEMATIC, mass: 0 })
    this.cursorBody.addShape(new CANNON.Sphere(0.2))
    this.world.addBody(this.cursorBody)

    this.buildWalls()
  }

  /** Compute the visible width/height at z = 0 for the current camera. */
  private updateBounds() {
    const dist = this.camera.position.z
    const vFov = (this.camera.fov * Math.PI) / 180
    const h = 2 * Math.tan(vFov / 2) * dist
    const w = h * this.camera.aspect
    this.bounds = { w, h, d: 6 }
  }

  private buildWalls() {
    const make = (nx: number, ny: number, nz: number, px: number, py: number, pz: number) => {
      const body = new CANNON.Body({ type: CANNON.Body.STATIC, mass: 0 })
      body.addShape(new CANNON.Plane())
      const n = new CANNON.Vec3(nx, ny, nz)
      body.quaternion.setFromVectors(new CANNON.Vec3(0, 0, 1), n)
      body.position.set(px, py, pz)
      this.world.addBody(body)
      this.walls.push(body)
    }
    const { w, h, d } = this.bounds
    make(1, 0, 0, -w / 2, 0, 0)
    make(-1, 0, 0, w / 2, 0, 0)
    make(0, 1, 0, 0, -h / 2, 0)
    make(0, -1, 0, 0, h / 2, 0)
    make(0, 0, 1, 0, 0, -d / 2)
    make(0, 0, -1, 0, 0, d / 2)
  }

  private repositionWalls() {
    const { w, h, d } = this.bounds
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

  private async loadFont(key: string): Promise<Font> {
    const cached = this.fontCache.get(key)
    if (cached) return cached
    const entry = FONTS.find((f) => f.key === key) ?? FONTS[0]
    const font = await new FontLoader().loadAsync(entry.url)
    this.fontCache.set(key, font)
    return font
  }

  // --------------------------------------------------------------- public ---

  /** Apply a full set of options at once (used on first render). */
  setOptions(opts: Partial<BalloonOptions>) {
    Object.assign(this.opts, opts)
  }

  /** Inflate a fresh set of balloon letters from the given text. */
  async setText(text: string) {
    this.currentText = text
    const font = await this.loadFont(this.opts.fontKey)
    if (this.disposed) return
    this.clear()

    const chars = [...text]
    if (chars.length === 0) return

    const usableW = this.bounds.w * 0.82
    const size = Math.min(2.6, Math.max(0.9, usableW / (chars.length * 0.85)))

    type Built = { geo: TextGeometry | null; width: number; char: string }
    const built: Built[] = []
    for (const char of chars) {
      if (char === ' ') {
        built.push({ geo: null, width: size * 0.5, char })
        continue
      }
      const geo = new TextGeometry(char, {
        font,
        size,
        depth: size * 0.6,
        curveSegments: 14,
        bevelEnabled: true,
        bevelThickness: size * 0.32,
        bevelSize: size * 0.22,
        bevelSegments: 12,
      })
      geo.center()
      geo.computeBoundingBox()
      const bb = geo.boundingBox!
      built.push({ geo, width: bb.max.x - bb.min.x, char })
    }

    const gap = size * 0.32
    const total =
      built.reduce((s, b) => s + b.width, 0) + gap * (built.length - 1)
    let cursorX = -total / 2

    built.forEach((b) => {
      const cx = cursorX + b.width / 2
      cursorX += b.width + gap
      if (b.char === ' ' || !b.geo) return

      const index = this.letters.length
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

      const mesh = new THREE.Mesh(b.geo, material)
      const home = new THREE.Vector3(cx, 0, 0)
      mesh.position.copy(home)
      mesh.scale.setScalar(0.001)
      this.scene.add(mesh)

      const bb = b.geo.boundingBox!
      const half = new CANNON.Vec3(
        Math.max(0.2, (bb.max.x - bb.min.x) / 2),
        Math.max(0.2, (bb.max.y - bb.min.y) / 2),
        Math.max(0.2, (bb.max.z - bb.min.z) / 2),
      )
      const body = new CANNON.Body({
        mass: 1.1,
        shape: new CANNON.Box(half),
        position: new CANNON.Vec3(cx, 0, 0),
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
      }
      this.letters.push(letter)
      this.applyColor(letter)
      if (this.opts.strings) this.makeString(letter)

      gsap.to(mesh.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 1.1,
        ease: 'elastic.out(1, 0.45)',
        delay: 0.06 * index,
        onComplete: () => {
          body.collisionResponse = true
        },
      })
    })
  }

  clear() {
    for (const l of this.letters) {
      this.removeString(l)
      this.scene.remove(l.mesh)
      l.mesh.geometry.dispose()
      ;(l.mesh.material as THREE.Material).dispose()
      this.world.removeBody(l.body)
    }
    this.letters = []
    this.releaseDrag()
  }

  popAll() {
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
              this.scene.remove(l.mesh)
              l.mesh.geometry.dispose()
              ;(l.mesh.material as THREE.Material).dispose()
            },
          })
        },
      })
    }
  }

  // ----------------------------------------------------------- appearance ---

  private colorFor(letter: Letter): string {
    return this.opts.multicolor ? PALETTE[letter.index % PALETTE.length] : this.opts.color
  }

  private applyColor(letter: Letter) {
    const hex = this.colorFor(letter)
    const mat = letter.mesh.material as THREE.MeshPhysicalMaterial
    const c = new THREE.Color(hex)
    mat.color.copy(c)
    mat.sheenColor = c.clone().lerp(new THREE.Color('#ffffff'), 0.4)
    mat.needsUpdate = true
  }

  setColor(hex: string) {
    this.opts.color = hex
    if (!this.opts.multicolor) this.letters.forEach((l) => this.applyColor(l))
  }

  setMulticolor(on: boolean) {
    this.opts.multicolor = on
    this.letters.forEach((l) => this.applyColor(l))
  }

  setStrings(on: boolean) {
    this.opts.strings = on
    for (const l of this.letters) {
      if (on && !l.string) this.makeString(l)
      else if (!on && l.string) this.removeString(l)
    }
  }

  async setFont(key: string) {
    this.opts.fontKey = key
    if (this.currentText) await this.setText(this.currentText)
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
    this.scene.add(line)
    letter.string = line
    this.updateString(letter)
  }

  private removeString(letter: Letter) {
    if (!letter.string) return
    this.scene.remove(letter.string)
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
    control.y -= len * 0.12 // slack so the string droops

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

  // ---------------------------------------------------------------- input ---

  private bindEvents() {
    const el = this.renderer.domElement
    el.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointermove', this.onPointerMove)
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('resize', this.onResize)
  }

  private setPointer(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect()
    this.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    )
  }

  private pointerToWorld(z: number, out: THREE.Vector3) {
    const v = new THREE.Vector3(this.pointer.x, this.pointer.y, 0.5)
    v.unproject(this.camera)
    v.sub(this.camera.position).normalize()
    const distance = (z - this.camera.position.z) / v.z
    out.copy(this.camera.position).add(v.multiplyScalar(distance))
    return out
  }

  private onPointerDown = (e: PointerEvent) => {
    this.setPointer(e)
    this.pointerActive = true
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const meshes = this.letters.map((l) => l.mesh)
    const hit = this.raycaster.intersectObjects(meshes, false)[0]
    if (!hit) return
    const letter = this.letters.find((l) => l.mesh === hit.object)
    if (!letter) return

    this.dragged = letter
    this.dragDepth = letter.body.position.z
    const p = hit.point
    this.cursorBody.position.set(p.x, p.y, p.z)
    letter.body.wakeUp()

    const pivot = new CANNON.Vec3(
      p.x - letter.body.position.x,
      p.y - letter.body.position.y,
      p.z - letter.body.position.z,
    )
    this.dragConstraint = new CANNON.PointToPointConstraint(
      letter.body,
      pivot,
      this.cursorBody,
      new CANNON.Vec3(0, 0, 0),
      28,
    )
    this.world.addConstraint(this.dragConstraint)
  }

  private onPointerMove = (e: PointerEvent) => {
    this.setPointer(e)
    this.pointerActive = true
  }

  private onPointerUp = () => {
    this.releaseDrag()
  }

  private releaseDrag() {
    if (this.dragConstraint) {
      this.world.removeConstraint(this.dragConstraint)
      this.dragConstraint = null
    }
    this.dragged = null
  }

  private onResize = () => {
    const { clientWidth: w, clientHeight: h } = this.canvas
    if (w === 0 || h === 0) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
    this.updateBounds()
    this.repositionWalls()
  }

  // ----------------------------------------------------------------- loop ---

  private loop = () => {
    if (this.disposed) return
    this.frameId = requestAnimationFrame(this.loop)
    const dt = Math.min(this.clock.getDelta(), 1 / 30)
    const t = this.clock.elapsedTime

    const cursorWorld = new THREE.Vector3()
    if (this.dragged) {
      this.pointerToWorld(this.dragDepth, cursorWorld)
      this.cursorBody.position.set(cursorWorld.x, cursorWorld.y, cursorWorld.z)
    }

    const repelWorld = new THREE.Vector3()
    if (this.pointerActive) this.pointerToWorld(0, repelWorld)
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
            Math.cos(t * 0.9 + l.phase) * 1.4,
            Math.sin(t * 1.3 + l.phase) * 1.8,
            Math.sin(t * 0.7 + l.phase) * 0.8,
          ),
        )
        if (this.pointerActive && !this.dragConstraint) {
          const dx = b.position.x - repelWorld.x
          const dy = b.position.y - repelWorld.y
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
      if (l.string) this.updateString(l)
    }

    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.frameId)
    const el = this.renderer.domElement
    el.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('resize', this.onResize)
    this.clear()
    this.renderer.dispose()
  }
}
