'use client'

import { useState } from 'react'
import styles from './page.module.css'

type Tab = 'summary' | 'brackets' | 'sidepots'

const SUMMARY_DATA = [
  { name: 'Alex Rivera',   g1: 15, g2: 15, won: 15 },
  { name: 'Jordan Marsh',  g1: 14, g2: 11, won: 11 },
  { name: 'Casey Kline',   g1: 12, g2: 11, won: 11 },
  { name: 'Morgan Steele', g1: 9,  g2: 9,  won: 9  },
  { name: 'Taylor Voss',   g1: 15, g2: 7,  won: 7  },
  { name: 'Dakota Finn',   g1: 13, g2: 6,  won: 6  },
]

const BRACKET_ROUNDS = [
  {
    label: 'Round 1',
    matchLabel: 'Match',
    matches: [
      { playerA: 'Alex Rivera',  scoreA: 246, playerB: 'Jordan Marsh',  scoreB: 198, winner: 'A' as const },
      { playerA: 'Casey Kline',  scoreA: 223, playerB: 'Taylor Voss',   scoreB: 201, winner: 'A' as const },
    ],
  },
  {
    label: 'Final',
    matchLabel: 'Final',
    matches: [
      { playerA: 'Alex Rivera', scoreA: 268, playerB: 'Casey Kline', scoreB: 245, winner: 'A' as const },
    ],
  },
]

const SIDE_POT_SCRATCH = [
  { label: 'Game 1',  leaders: [{ name: 'Alex Rivera', score: 246 }, { name: 'Casey Kline', score: 223 }, { name: 'Jordan Marsh', score: 198 }] },
  { label: 'Game 2',  leaders: [{ name: 'Alex Rivera', score: 268 }, { name: 'Casey Kline', score: 245 }, { name: 'Jordan Marsh', score: 231 }] },
  { label: 'Series',  leaders: [{ name: 'Alex Rivera', score: 514 }, { name: 'Casey Kline', score: 468 }, { name: 'Jordan Marsh', score: 429 }] },
]

export function PublicViewDemo() {
  const [tab, setTab] = useState<Tab>('summary')

  return (
    <div className={styles.publicViewPanel} aria-label="Public tournament view demo">

      <div className={styles.pvHeader}>
        <div className={styles.pvTournamentInfo}>
          <span className={styles.pvPublicBadge}>PUBLIC TOURNAMENT VIEW</span>
          <p className={styles.pvTournamentName}>Brass Monkey ID State · Snake River Bowl</p>
        </div>
        <span className={styles.pvShareBtn}>↗ Share View</span>
      </div>

      <div className={styles.pvTabs}>
        <button
          className={`${styles.pvTab} ${tab === 'summary' ? styles.pvTabActive : ''}`}
          onClick={() => setTab('summary')}
          type="button"
        >
          Bracket Summary
        </button>
        <button
          className={`${styles.pvTab} ${tab === 'brackets' ? styles.pvTabActive : ''}`}
          onClick={() => setTab('brackets')}
          type="button"
        >
          Brackets
        </button>
        <button
          className={`${styles.pvTab} ${tab === 'sidepots' ? styles.pvTabActive : ''}`}
          onClick={() => setTab('sidepots')}
          type="button"
        >
          Side Pots
        </button>
      </div>

      <div className={styles.pvRefreshRow}>
        <span className={styles.pvLiveGroup}><span className={styles.pvLiveDot} />Auto-refresh on</span>
        <span className={styles.pvRefreshBtn}>↻ Refresh Now</span>
      </div>

      {tab === 'summary' && (
        <div className={styles.pvTable}>
          <div className={styles.pvTableHead}>
            <span>BOWLER</span>
            <span>AFTER G1</span>
            <span>AFTER G2</span>
            <span>1ST/2ND</span>
          </div>
          {SUMMARY_DATA.map(row => (
            <div key={row.name} className={styles.pvTableRow}>
              <span className={styles.pvBowlerName}>{row.name}</span>
              <span className={row.g1 > 0 ? styles.pvScore : styles.pvScoreElim}>{row.g1}</span>
              <span className={row.g2 > 0 ? styles.pvScore : styles.pvScoreElim}>{row.g2}</span>
              <span className={row.won > 0 ? styles.pvScoreHighlight : styles.pvScoreElim}>{row.won}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'brackets' && (
        <div className={styles.pvBracketView}>
          <div className={styles.pvBracketNav}>
            <button type="button" className={styles.pvBracketNavBtn} disabled>← Prev</button>
            <div className={styles.pvBracketNavCenter}>
              <span className={styles.pvBracketNavTitle}>Bracket #1 — 4 Person</span>
              <span className={styles.pvBracketNavCount}>1 of 1</span>
            </div>
            <button type="button" className={styles.pvBracketNavBtn} disabled>Next →</button>
          </div>
          <div className={styles.pvWinnerBanner}>
            <span className={styles.pvWinnerLabel}>Winner</span>
            <span className={styles.pvWinnerName}>Alex Rivera</span>
          </div>
          <div className={styles.pvBracketRounds}>
            {BRACKET_ROUNDS.flatMap((round, ri) => {
              const isFinals = ri === BRACKET_ROUNDS.length - 1
              const roundEl = (
                <div key={round.label} className={styles.pvBracketRound}>
                  <div className={styles.pvRoundLabel}>{round.label}</div>
                  <div className={styles.pvRoundMatches}>
                    {round.matches.map((match, i) => {
                      const margin = Math.abs(match.scoreA - match.scoreB)
                      return (
                        <div key={i} className={`${styles.pvMatchCard} ${styles.pvMatchComplete} ${isFinals ? styles.pvMatchCardFinals : ''}`}>
                          <div className={styles.pvMatchLabelRow}>
                            <span className={styles.pvMatchLabel}>{round.matchLabel}</span>
                            <span className={styles.pvMatchMargin}>+{margin}</span>
                          </div>
                          <div className={`${styles.pvMatchPlayer} ${match.winner === 'A' ? styles.pvMatchWinner : ''}`}>
                            <span>{match.playerA}</span>
                            <span className={styles.pvMatchScore}>{match.scoreA}</span>
                          </div>
                          <div className={styles.pvVsRow}>vs</div>
                          <div className={`${styles.pvMatchPlayer} ${match.winner === 'B' ? styles.pvMatchWinner : ''}`}>
                            <span>{match.playerB}</span>
                            <span className={styles.pvMatchScore}>{match.scoreB}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
              if (ri === 0) return [roundEl]
              return [
                <div key={`conn-${ri}`} className={styles.pvBracketConnector} aria-hidden="true">
                  <div className={styles.pvConnBracket} />
                </div>,
                roundEl,
              ]
            })}
          </div>
        </div>
      )}

      {tab === 'sidepots' && (
        <div className={styles.pvSidePotLeaderboard}>
          <div className={styles.pvSidePotSection}>
            <div className={styles.pvSidePotSectionTitle}>Scratch</div>
            <div className={styles.pvSidePotGrid}>
              {SIDE_POT_SCRATCH.map(({ label, leaders }) => (
                <div key={label} className={styles.pvSidePotCard}>
                  <div className={styles.pvSidePotCardLabel}>{label}</div>
                  <ol className={styles.pvSidePotPodium}>
                    {leaders.map((l, i) => (
                      <li key={i} className={`${styles.pvSidePotPodiumRow} ${i === 0 ? styles.pvSidePotPodiumFirst : ''}`}>
                        <span className={styles.pvSidePotPodiumPlace}>{i === 0 ? '1st' : i === 1 ? '2nd' : '3rd'}</span>
                        <span className={styles.pvSidePotPodiumName}>{l.name}</span>
                        <span className={styles.pvSidePotPodiumScore}>{l.score}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
