import { useEffect, useRef, useState } from 'react'
import { BalloonText, FONTS } from './balloon/BalloonText'
import './App.css'

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<BalloonText | null>(null)

  const [text, setText] = useState('hello')
  const [textColor, setTextColor] = useState('#ff5d8f')
  const [multicolor, setMulticolor] = useState(true)
  const [bgColor, setBgColor] = useState('#141233')
  const [strings, setStrings] = useState(false)
  const [fontKey, setFontKey] = useState('helvetiker_bold')

  useEffect(() => {
    if (!canvasRef.current) return
    const engine = new BalloonText(canvasRef.current)
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

  return (
    <div className="stage" style={{ backgroundColor: bgColor }}>
      <canvas ref={canvasRef} className="scene" />

      <header className="topbar">
        <span className="brand">🎈 balloon.type</span>
        <span className="tip">drag a letter · fling it · watch it bob</span>
      </header>

      <aside className="controls">
        <label className="row">
          <span>Text color</span>
          <input
            type="color"
            value={textColor}
            onChange={(e) => onPickTextColor(e.target.value)}
          />
        </label>

        <label className="row">
          <span>Multicolor</span>
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
          <span>Background</span>
          <input
            type="color"
            value={bgColor}
            onChange={(e) => setBgColor(e.target.value)}
          />
        </label>

        <label className="row">
          <span>Strings</span>
          <button
            type="button"
            className={`toggle ${strings ? 'on' : ''}`}
            onClick={onToggleStrings}
            aria-pressed={strings}
          >
            <span className="knob" />
          </button>
        </label>

        <label className="row">
          <span>Font</span>
          <select value={fontKey} onChange={(e) => onPickFont(e.target.value)}>
            {FONTS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </aside>

      <form className="panel" onSubmit={onSubmit}>
        <input
          className="field"
          value={text}
          maxLength={14}
          placeholder="type a name…"
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <button type="submit" className="go">
          Inflate
        </button>
        <button
          type="button"
          className="pop"
          onClick={() => engineRef.current?.popAll()}
          title="Pop them all"
        >
          Pop
        </button>
      </form>
    </div>
  )
}

export default App
