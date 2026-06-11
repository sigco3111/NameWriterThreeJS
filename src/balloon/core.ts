import * as THREE from 'three'
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import helvetikerBold from 'three/examples/fonts/helvetiker_bold.typeface.json?url'
import optimerBold from 'three/examples/fonts/optimer_bold.typeface.json?url'
import gentilisBold from 'three/examples/fonts/gentilis_bold.typeface.json?url'
import droidSansBold from 'three/examples/fonts/droid/droid_sans_bold.typeface.json?url'
import droidSerifBold from 'three/examples/fonts/droid/droid_serif_bold.typeface.json?url'

/** A glossy, candy-foil colour palette used when "multicolor" is on. */
export const PALETTE = [
  '#ff5d8f',
  '#ff8c42',
  '#ffd23f',
  '#6ee7b7',
  '#4cc9f0',
  '#7c5cff',
  '#ff5e7e',
  '#22d3ee',
]

/** Fonts the user can pick from (all ship with three.js). */
export const FONTS: { key: string; label: string; url: string }[] = [
  { key: 'helvetiker_bold', label: 'Helvetiker', url: helvetikerBold },
  { key: 'optimer_bold', label: 'Optimer', url: optimerBold },
  { key: 'gentilis_bold', label: 'Gentilis', url: gentilisBold },
  { key: 'droid_sans_bold', label: 'Droid Sans', url: droidSansBold },
  { key: 'droid_serif_bold', label: 'Droid Serif', url: droidSerifBold },
]

export type ModeKind = 'balloon' | 'particles' | 'bubbles'

export interface FXOptions {
  color: string
  multicolor: boolean
  strings: boolean
  fontKey: string
  sphereCount: number
  sphereSize: number
}

/** Shared services every render mode can use. */
export interface FXContext {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  raycaster: THREE.Raycaster
  pointer: THREE.Vector2
  options: FXOptions
  getBounds(): { w: number; h: number; d: number }
  isPointerActive(): boolean
  pointerToWorld(z: number, out: THREE.Vector3): THREE.Vector3
}

/** A swappable way of turning text into an interactive 3D effect. */
export interface TextMode {
  build(text: string, font: Font): void
  update(dt: number, time: number): void
  applyColors(): void
  setStrings(on: boolean): void
  pop(): void
  onPointerDown(): void
  onPointerUp(): void
  onResize(): void
  dispose(): void
}

export interface Glyph {
  geo: TextGeometry
  cx: number
  bbox: THREE.Box3
  size: number
}

/** Build centred, puffy letter geometries laid out horizontally on screen. */
export function layoutText(text: string, font: Font, boundsW: number): Glyph[] {
  const chars = [...text]
  const usableW = boundsW * 0.82
  const size = Math.min(
    2.6,
    Math.max(0.9, usableW / (Math.max(1, chars.length) * 0.85)),
  )
  const gap = size * 0.32

  const tmp: { geo: TextGeometry | null; width: number }[] = []
  for (const char of chars) {
    if (char === ' ') {
      tmp.push({ geo: null, width: size * 0.5 })
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
    tmp.push({ geo, width: bb.max.x - bb.min.x })
  }

  const total = tmp.reduce((s, t) => s + t.width, 0) + gap * (tmp.length - 1)
  let cursorX = -total / 2
  const glyphs: Glyph[] = []
  for (const t of tmp) {
    const cx = cursorX + t.width / 2
    cursorX += t.width + gap
    if (!t.geo) continue
    glyphs.push({ geo: t.geo, cx, bbox: t.geo.boundingBox!.clone(), size })
  }
  return glyphs
}

export function colorForIndex(opts: FXOptions, i: number): THREE.Color {
  return new THREE.Color(opts.multicolor ? PALETTE[i % PALETTE.length] : opts.color)
}
