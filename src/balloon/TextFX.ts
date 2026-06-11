import * as THREE from 'three'
import { FontLoader, type Font } from 'three/examples/jsm/loaders/FontLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import {
  FONTS,
  type FXContext,
  type FXOptions,
  type ModeKind,
  type TextMode,
} from './core'
import { BalloonMode } from './BalloonMode'
import { ParticleMode } from './ParticleMode'
import { BubbleMode } from './BubbleMode'

export { FONTS } from './core'
export type { ModeKind } from './core'

/**
 * Host engine: owns the renderer, camera, pointer + animation loop, and
 * delegates the actual text rendering to a swappable TextMode.
 */
export class TextFX {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private clock = new THREE.Clock()

  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private pointerActive = false

  private bounds = { w: 20, h: 12, d: 6 }
  private ctx: FXContext

  private mode: TextMode | null = null
  private modeKind: ModeKind = 'balloon'
  private currentText = ''

  private opts: FXOptions = {
    color: '#ff5d8f',
    multicolor: true,
    strings: false,
    fontKey: 'helvetiker_bold',
    sphereCount: 420,
    sphereSize: 1,
  }

  private fontCache = new Map<string, Font>()
  private frameId = 0
  private disposed = false
  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const { clientWidth: w, clientHeight: h } = canvas

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w, h, false)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
    this.camera.position.set(0, 0, 16)

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

    this.ctx = {
      scene: this.scene,
      camera: this.camera,
      renderer: this.renderer,
      raycaster: this.raycaster,
      pointer: this.pointer,
      options: this.opts,
      getBounds: () => this.bounds,
      isPointerActive: () => this.pointerActive,
      pointerToWorld: (z, out) => this.pointerToWorld(z, out),
    }

    this.bindEvents()
    this.loop()
  }

  private updateBounds() {
    const dist = this.camera.position.z
    const vFov = (this.camera.fov * Math.PI) / 180
    const h = 2 * Math.tan(vFov / 2) * dist
    this.bounds = { w: h * this.camera.aspect, h, d: 6 }
  }

  private async loadFont(key: string): Promise<Font> {
    const cached = this.fontCache.get(key)
    if (cached) return cached
    const entry = FONTS.find((f) => f.key === key) ?? FONTS[0]
    const font = await new FontLoader().loadAsync(entry.url)
    this.fontCache.set(key, font)
    return font
  }

  private createMode(kind: ModeKind): TextMode {
    if (kind === 'balloon') return new BalloonMode(this.ctx)
    if (kind === 'bubbles') return new BubbleMode(this.ctx)
    return new ParticleMode(this.ctx)
  }

  // ------------------------------------------------------------- public ---

  setOptions(opts: Partial<FXOptions>) {
    Object.assign(this.opts, opts)
  }

  async setMode(kind: ModeKind) {
    if (kind === this.modeKind && this.mode) return
    this.modeKind = kind
    this.mode?.dispose()
    this.mode = this.createMode(kind)
    if (this.currentText) await this.setText(this.currentText)
  }

  async setText(text: string) {
    this.currentText = text
    if (!this.mode) this.mode = this.createMode(this.modeKind)
    const font = await this.loadFont(this.opts.fontKey)
    if (this.disposed) return
    this.mode.build(text, font)
  }

  setColor(hex: string) {
    this.opts.color = hex
    if (!this.opts.multicolor) this.mode?.applyColors()
  }

  setMulticolor(on: boolean) {
    this.opts.multicolor = on
    this.mode?.applyColors()
  }

  setStrings(on: boolean) {
    this.opts.strings = on
    this.mode?.setStrings(on)
  }

  async setFont(key: string) {
    this.opts.fontKey = key
    if (this.currentText) await this.setText(this.currentText)
  }

  /** Bubbles mode: live size multiplier for the spheres. */
  setSphereSize(v: number) {
    this.opts.sphereSize = v
  }

  /** Bubbles mode: number of spheres (rebuilds the current text). */
  setSphereCount(v: number) {
    this.opts.sphereCount = v
    if (this.modeKind === 'bubbles' && this.currentText) {
      void this.setText(this.currentText)
    }
  }

  popAll() {
    this.mode?.pop()
  }

  // ------------------------------------------------------------- input ---

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
    this.mode?.onPointerDown()
  }

  private onPointerMove = (e: PointerEvent) => {
    this.setPointer(e)
    this.pointerActive = true
  }

  private onPointerUp = () => {
    this.mode?.onPointerUp()
  }

  private onResize = () => {
    const { clientWidth: w, clientHeight: h } = this.canvas
    if (w === 0 || h === 0) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
    this.updateBounds()
    this.mode?.onResize()
  }

  // -------------------------------------------------------------- loop ---

  private loop = () => {
    if (this.disposed) return
    this.frameId = requestAnimationFrame(this.loop)
    const dt = Math.min(this.clock.getDelta(), 1 / 30)
    this.mode?.update(dt, this.clock.elapsedTime)
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
    this.mode?.dispose()
    this.renderer.dispose()
  }
}
