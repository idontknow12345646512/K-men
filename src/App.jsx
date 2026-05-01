import { useState, useRef, useEffect } from 'react'

// ─── Confetti particle component ───────────────────────────────────────────────
function Confetti({ active }) {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.6,
    color: ['#ffd700', '#ff4f8b', '#4fb8ff', '#4dff91', '#ff9d4f'][Math.floor(Math.random() * 5)],
    size: 6 + Math.random() * 8,
    shape: Math.random() > 0.5 ? '50%' : '0%',
  }))

  if (!active) return null
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 100 }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          left: `${p.x}%`,
          top: '-20px',
          width: p.size,
          height: p.size,
          borderRadius: p.shape,
          background: p.color,
          animation: `confetti-fall 1.2s ${p.delay}s ease-in forwards`,
        }} />
      ))}
    </div>
  )
}

// ─── Chain item ────────────────────────────────────────────────────────────────
function ChainItem({ item, emoji, index }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      animation: 'fadeIn 0.4s ease both',
      animationDelay: `${index * 0.05}s`,
    }}>
      {index > 0 && (
        <span style={{ color: 'var(--text-dim)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>→</span>
      )}
      <div style={{
        background: 'var(--bg3)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: '4px 12px',
        fontSize: 13,
        color: index === 0 ? 'var(--yellow)' : 'var(--text-dim)',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        whiteSpace: 'nowrap',
        fontWeight: index === 0 ? 600 : 400,
      }}>
        {emoji && <span>{emoji}</span>}
        {item}
      </div>
    </div>
  )
}

// ─── Score badge ───────────────────────────────────────────────────────────────
function ScoreBadge({ score }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: 'var(--bg3)',
      border: '1px solid var(--yellow-dim)',
      borderRadius: 30,
      padding: '6px 16px',
      fontFamily: 'var(--font-mono)',
      fontSize: 14,
      color: 'var(--yellow)',
    }}>
      <span>🏆</span>
      <span>{score}</span>
    </div>
  )
}

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase] = useState('intro') // 'intro' | 'game' | 'result'
  const [currentItem, setCurrentItem] = useState('Kámen')
  const [currentEmoji, setCurrentEmoji] = useState('🪨')
  const [chain, setChain] = useState([{ item: 'Kámen', emoji: '🪨' }])
  const [score, setScore] = useState(0)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState(null) // { type: 'win'|'lose', explanation, emoji }
  const [showConfetti, setShowConfetti] = useState(false)
  const [shake, setShake] = useState(false)
  const [finalScore, setFinalScore] = useState(0)
  const [finalChain, setFinalChain] = useState([])
  const inputRef = useRef(null)
  const chainRef = useRef(null)

  useEffect(() => {
    if (phase === 'game' && inputRef.current) {
      inputRef.current.focus()
    }
  }, [phase, feedback])

  useEffect(() => {
    if (chainRef.current) {
      chainRef.current.scrollLeft = chainRef.current.scrollWidth
    }
  }, [chain])

  const startGame = () => {
    setPhase('game')
    setCurrentItem('Kámen')
    setCurrentEmoji('🪨')
    setChain([{ item: 'Kámen', emoji: '🪨' }])
    setScore(0)
    setInput('')
    setFeedback(null)
  }

  const submitAnswer = async () => {
    const answer = input.trim()
    if (!answer || isLoading) return

    setIsLoading(true)
    setFeedback(null)

    try {
      const res = await fetch('https://dgskmkkmrhsmlzxujsez.supabase.co/functions/v1/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentItem,
          playerAnswer: answer,
          chain: chain.map(c => c.item),
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setFeedback({ type: 'error', explanation: 'Chyba serveru, zkus to znovu.' })
        setIsLoading(false)
        return
      }

      // Podpora obou formátů klíčů (s i bez háčků)
      const beats = data.porazi ?? data['porazí'] ?? false
      const explanation = data.vysvetleni ?? data['vysvětlení'] ?? ''

      if (beats) {
        const newChain = [...chain, { item: answer, emoji: data.emoji || '✨' }]
        setFeedback({ type: 'win', explanation, emoji: data.emoji })
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 1500)

        setTimeout(() => {
          setChain(newChain)
          setCurrentItem(answer)
          setCurrentEmoji(data.emoji || '✨')
          setScore(s => s + 1)
          setFeedback(null)
          setInput('')
          setIsLoading(false)
        }, 1800)
      } else {
        setFeedback({ type: 'lose', explanation, emoji: data.emoji })
        setShake(true)
        setTimeout(() => setShake(false), 600)

        setTimeout(() => {
          setFinalScore(score)
          setFinalChain([...chain])
          setPhase('result')
          setIsLoading(false)
        }, 2200)
      }
    } catch (err) {
      setFeedback({ type: 'error', explanation: 'Nepodařilo se spojit se serverem.' })
      setIsLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter') submitAnswer()
  }

  // ── INTRO SCREEN ─────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 32,
        animation: 'fadeIn 0.6s ease',
      }}>
        {/* Rock emoji animated */}
        <div style={{
          fontSize: 80,
          animation: 'float 3s ease-in-out infinite',
          filter: 'drop-shadow(0 0 30px rgba(255,215,0,0.4))',
        }}>🪨</div>

        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontSize: 'clamp(2.4rem, 8vw, 4.5rem)',
            fontWeight: 700,
            lineHeight: 1.1,
            background: 'linear-gradient(135deg, var(--yellow) 0%, var(--pink) 50%, var(--blue) 100%)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'shimmer 3s linear infinite',
          }}>
            Co Porazí Kámen?
          </h1>
          <p style={{
            color: 'var(--text-dim)',
            fontSize: '1.1rem',
            marginTop: 12,
            fontWeight: 400,
          }}>
            Řekni AI co porazí předchozí věc. Jak daleko dojdeš?
          </p>
        </div>

        {/* How to play */}
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: '24px 32px',
          maxWidth: 460,
          width: '100%',
        }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16, color: 'var(--yellow)' }}>
            Jak hrát?
          </h2>
          <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              ['🪨', 'Hra začíná s Kamenem'],
              ['💬', 'Napiš co porazí aktuální věc'],
              ['🤖', 'AI rozhodne jestli to dává smysl'],
              ['🔗', 'Pokračuj co nejdéle!'],
            ].map(([emoji, text], i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.95rem' }}>
                <span style={{
                  width: 36, height: 36,
                  background: 'var(--bg3)',
                  borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, flexShrink: 0,
                }}>{emoji}</span>
                <span style={{ color: 'var(--text-dim)' }}>{text}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Start button */}
        <button
          onClick={startGame}
          style={{
            background: 'linear-gradient(135deg, var(--yellow), var(--pink))',
            border: 'none',
            borderRadius: 50,
            padding: '16px 48px',
            fontSize: '1.2rem',
            fontWeight: 700,
            fontFamily: 'var(--font-main)',
            color: '#000',
            cursor: 'pointer',
            animation: 'pulse-glow 2s ease-in-out infinite',
            transition: 'transform 0.15s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          Hrát! 🎮
        </button>
      </div>
    )
  }

  // ── RESULT SCREEN ─────────────────────────────────────────────────────────────
  if (phase === 'result') {
    const medal = finalScore >= 15 ? '🥇' : finalScore >= 8 ? '🥈' : finalScore >= 4 ? '🥉' : '💀'
    const message = finalScore >= 15 ? 'Génius!' : finalScore >= 8 ? 'Skvělé!' : finalScore >= 4 ? 'Dobrý pokus!' : 'Příště lépe!'

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 28,
        animation: 'fadeIn 0.5s ease',
      }}>
        <div style={{ fontSize: 72, animation: 'popIn 0.5s ease' }}>{medal}</div>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--yellow)' }}>{message}</h2>
          <p style={{ color: 'var(--text-dim)', marginTop: 8 }}>Tvoje skóre</p>
          <div style={{
            fontSize: '5rem',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text)',
            lineHeight: 1.1,
          }}>{finalScore}</div>
        </div>

        {/* Chain recap */}
        {finalChain.length > 1 && (
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: '20px 24px',
            maxWidth: 560,
            width: '100%',
          }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: 12 }}>Tvůj řetěz:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {finalChain.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {i > 0 && <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>→</span>}
                  <span style={{
                    background: 'var(--bg3)',
                    borderRadius: 12,
                    padding: '3px 10px',
                    fontSize: 13,
                    color: i === 0 ? 'var(--yellow)' : 'var(--text-dim)',
                  }}>
                    {c.emoji} {c.item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={startGame}
            style={{
              background: 'linear-gradient(135deg, var(--yellow), var(--pink))',
              border: 'none',
              borderRadius: 50,
              padding: '14px 36px',
              fontSize: '1.1rem',
              fontWeight: 700,
              fontFamily: 'var(--font-main)',
              color: '#000',
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            Znovu! 🔄
          </button>
          <button
            onClick={() => setPhase('intro')}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 50,
              padding: '14px 36px',
              fontSize: '1.1rem',
              fontWeight: 600,
              fontFamily: 'var(--font-main)',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-dim)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
          >
            Menu
          </button>
        </div>
      </div>
    )
  }

  // ── GAME SCREEN ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 16px',
      maxWidth: 640,
      margin: '0 auto',
      gap: 20,
    }}>
      <Confetti active={showConfetti} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => setPhase('intro')}
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: '6px 14px',
            fontSize: 13,
            color: 'var(--text-dim)',
            cursor: 'pointer',
            fontFamily: 'var(--font-main)',
          }}
        >
          ← Menu
        </button>
        <ScoreBadge score={score} />
      </div>

      {/* Chain scroll */}
      {chain.length > 1 && (
        <div
          ref={chainRef}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            overflowX: 'auto',
            padding: '8px 4px',
            scrollbarWidth: 'thin',
          }}
        >
          {chain.map((c, i) => (
            <ChainItem key={i} item={c.item} emoji={c.emoji} index={i} />
          ))}
        </div>
      )}

      {/* Main card */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        paddingTop: 16,
        paddingBottom: 32,
      }}>
        {/* Current item display */}
        <div style={{
          textAlign: 'center',
          animation: 'fadeIn 0.4s ease',
          key: currentItem,
        }}>
          <div style={{
            fontSize: 72,
            marginBottom: 8,
            animation: 'float 3s ease-in-out infinite',
            display: 'block',
            filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.3))',
          }}>
            {currentEmoji}
          </div>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: 6 }}>
            Co porazí
          </p>
          <h2 style={{
            fontSize: 'clamp(1.8rem, 6vw, 3rem)',
            fontWeight: 700,
            color: 'var(--yellow)',
          }}>
            {currentItem}?
          </h2>
        </div>

        {/* Feedback banner */}
        {feedback && (
          <div style={{
            background: feedback.type === 'win'
              ? 'rgba(77, 255, 145, 0.1)'
              : feedback.type === 'lose'
              ? 'rgba(255, 79, 79, 0.1)'
              : 'rgba(255, 157, 79, 0.1)',
            border: `1px solid ${
              feedback.type === 'win' ? 'rgba(77,255,145,0.4)'
              : feedback.type === 'lose' ? 'rgba(255,79,79,0.4)'
              : 'rgba(255,157,79,0.4)'
            }`,
            borderRadius: 16,
            padding: '16px 24px',
            maxWidth: 420,
            width: '100%',
            textAlign: 'center',
            animation: 'popIn 0.35s ease',
          }}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>
              {feedback.type === 'win' ? '✅' : feedback.type === 'lose' ? '❌' : '⚠️'}
            </div>
            <p style={{
              color: feedback.type === 'win' ? 'var(--green)'
                : feedback.type === 'lose' ? 'var(--red)'
                : '#ff9d4f',
              fontSize: '1rem',
              fontWeight: 500,
            }}>
              {feedback.explanation}
            </p>
          </div>
        )}

        {/* Input area */}
        {!feedback && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            width: '100%',
            maxWidth: 420,
            animation: shake ? 'shake 0.5s ease' : 'fadeIn 0.3s ease',
          }}>
            <div style={{
              display: 'flex',
              gap: 10,
              background: 'var(--card)',
              border: '2px solid var(--border)',
              borderRadius: 16,
              padding: '4px 4px 4px 18px',
              transition: 'border-color 0.2s ease',
            }}
              onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--yellow-dim)'}
              onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={`Co porazí ${currentItem}?`}
                disabled={isLoading}
                maxLength={80}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-main)',
                  fontSize: '1.1rem',
                  fontWeight: 500,
                  minWidth: 0,
                }}
              />
              <button
                onClick={submitAnswer}
                disabled={isLoading || !input.trim()}
                style={{
                  background: input.trim() && !isLoading
                    ? 'linear-gradient(135deg, var(--yellow), var(--pink))'
                    : 'var(--bg3)',
                  border: 'none',
                  borderRadius: 12,
                  padding: '10px 20px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-main)',
                  color: input.trim() && !isLoading ? '#000' : 'var(--text-dim)',
                  cursor: input.trim() && !isLoading ? 'pointer' : 'default',
                  transition: 'all 0.2s ease',
                  flexShrink: 0,
                  minWidth: 80,
                }}
              >
                {isLoading ? '...' : 'Odeslat →'}
              </button>
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', textAlign: 'center' }}>
              Stiskni Enter nebo tlačítko Odeslat
            </p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && !feedback && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: 'var(--text-dim)',
            fontSize: '0.95rem',
          }}>
            <span style={{ animation: 'spin-slow 1s linear infinite', display: 'inline-block' }}>⚙️</span>
            AI přemýšlí...
          </div>
        )}
      </div>
    </div>
  )
}
