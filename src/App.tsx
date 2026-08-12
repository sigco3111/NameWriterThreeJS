import { useEffect, useRef, useState } from 'react'
import { TextFX, FONTS, type ModeKind } from './balloon/TextFX'
import { t } from './i18n'
import './App.css'

const MODES: { key: ModeKind; label: string; icon: string }[] = [
  { key: 'balloon', label: t('modeBalloon'), icon: '🎈' },
  { key: 'particles', label: t('modeParticles'), icon: '✨' },
  { key: 'bubbles', label: t('modeBubbles'), icon: '🫧' },
]

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<TextFX | null>(null)

  const [text, setText] = useState('hello')
  const [mode, setMode] = useState<ModeKind>('balloon')
  const [textColor, setTextColor] = useState('#ff5d8f')
  const [multicolor, setMulticolor] = useState(true)
  const [bgColor, setBgColor] = useState('#141233')
  const [strings, setStrings] = useState(false)
  const [fontKey, setFontKey] = useState('helvetiker_bold')
  const [sphereCount, setSphereCount] = useState(420)
  const [sphereSize, setSphereSize] = useState(1)

  useEffect(() => {
    if (!canvasRef.current) return
    const engine = new TextFX(canvasRef.current)
    engineRef.current = engine
    engine.setOptions({ color: textColor, multicolor, strings, fontKey })
    engine.setText('hello')
    return () => {
      engine.dispose()
      engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const inflate = () => {
    const value = text.trim().slice(0, 14)
    if (!value) return
    engineRef.current?.setText(value)
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    inflate()
  }

  const onPickMode = (key: ModeKind) => {
    setMode(key)
    engineRef.current?.setMode(key)
  }

  const onPickTextColor = (hex: string) => {
    setTextColor(hex)
    setMulticolor(false)
    engineRef.current?.setMulticolor(false)
    engineRef.current?.setColor(hex)
  }

  const onToggleMulticolor = () => {
    const next = !multicolor
    setMulticolor(next)
    engineRef.current?.setMulticolor(next)
  }

  const onToggleStrings = () => {
    const next = !strings
    setStrings(next)
    engineRef.current?.setStrings(next)
  }

  const onPickFont = (key: string) => {
    setFontKey(key)
    engineRef.current?.setFont(key)
  }

  const onSphereSize = (v: number) => {
    setSphereSize(v)
    engineRef.current?.setSphereSize(v)
  }

  const onSphereCount = (v: number) => {
    setSphereCount(v)
    engineRef.current?.setSphereCount(v)
  }

  return (
    <div className="stage" style={{ backgroundColor: bgColor }}>
      <canvas ref={canvasRef} className="scene" />

      <header className="topbar">
        <span className="brand" title={t('brandHover')}>{t('appBrand')}</span>
        <span className="tip">{t('tip')}</span>
      </header>

      <div className="modebar">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            className={`modebtn ${mode === m.key ? 'active' : ''}`}
            onClick={() => onPickMode(m.key)}
          >
            <span className="modeicon">{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      <aside className="controls">
        <label className="row">
          <span>{t('textColor')}</span>
          <input
            type="color"
            value={textColor}
            onChange={(e) => onPickTextColor(e.target.value)}
          />
        </label>

        <label className="row">
          <span>{t('multicolor')}</span>
          <button
            type="button"
            className={`toggle ${multicolor ? 'on' : ''}`}
            onClick={onToggleMulticolor}
            aria-pressed={multicolor}
          >
            <span className="knob" />
          </button>
        </label>

        <label className="row">
          <span>{t('background')}</span>
          <input
            type="color"
            value={bgColor}
            onChange={(e) => setBgColor(e.target.value)}
          />
        </label>

        <label className={`row ${mode !== 'balloon' ? 'disabled' : ''}`}>
          <span>{t('strings')}</span>
          <button
            type="button"
            className={`toggle ${strings ? 'on' : ''}`}
            onClick={onToggleStrings}
            disabled={mode !== 'balloon'}
            aria-pressed={strings}
          >
            <span className="knob" />
          </button>
        </label>

        <label className="row">
          <span>{t('font')}</span>
          <select value={fontKey} onChange={(e) => onPickFont(e.target.value)}>
            {FONTS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        {mode === 'bubbles' && (
          <>
            <label className="row slider">
              <span>{t('spheresCount')(sphereCount)}</span>
              <input
                type="range"
                min={100}
                max={1000}
                step={20}
                value={sphereCount}
                onChange={(e) => onSphereCount(Number(e.target.value))}
              />
            </label>
            <label className="row slider">
              <span>{t('ballSize')(sphereSize)}</span>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.1}
                value={sphereSize}
                onChange={(e) => onSphereSize(Number(e.target.value))}
              />
            </label>
          </>
        )}
      </aside>

      <form className="panel" onSubmit={onSubmit}>
        <input
          className="field"
          value={text}
          maxLength={14}
          placeholder={t('placeholder')}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <button type="submit" className="go">
          {t('generate')}
        </button>
        <button
          type="button"
          className="pop"
          onClick={() => engineRef.current?.popAll()}
          title={t('popTitle')}
        >
          {t('pop')}
        </button>
      </form>
    </div>
  )
}

export default App
