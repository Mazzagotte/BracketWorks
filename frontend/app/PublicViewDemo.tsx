'use client'

import { useState } from 'react'
import styles from './page.module.css'

type Tab = 'summary' | 'brackets' | 'sidepots'

type MatchWinner = 'A' | 'B'

type BracketMatch = {
  playerA: string
  scoreA: number
  playerB: string
  scoreB: number
  winner: MatchWinner
}

type BracketRound = {
  label: string
  matchLabel: string
  matches: BracketMatch[]
}

const SUMMARY_DATA = [
  { name: 'Alley Oops',    g1: 15, g2: 15, won: 15 },
  { name: 'Rick Rack',     g1: 14, g2: 11, won: 11 },
  { name: 'Polly Pin',     g1: 12, g2: 11, won: 11 },
  { name: 'Tommy Turkey',  g1: 9,  g2: 9,  won: 9  },
  { name: 'Larry Lane',    g1: 15, g2: 7,  won: 7  },
  { name: 'Connie Count',  g1: 13, g2: 6,  won: 6  },
]

const BRACKET_ROUNDS: BracketRound[] = [
  {
    label: 'Round 1',
    matchLabel: 'Match',
    matches: [
      { playerA: 'Alley Oops',   scoreA: 246, playerB: 'Connie Count',  scoreB: 189, winner: 'A' },
      { playerA: 'Rick Rack',    scoreA: 214, playerB: 'Larry Lane',    scoreB: 201, winner: 'A' },
      { playerA: 'Polly Pin',    scoreA: 223, playerB: 'Tommy Turkey',  scoreB: 197, winner: 'A' },
      { playerA: 'Pete Pocket',  scoreA: 232, playerB: 'Carrie Carry',  scoreB: 209, winner: 'A' },
    ],
  },
  {
    label: 'Round 2',
    matchLabel: 'Semi',
    matches: [
      { playerA: 'Alley Oops', scoreA: 257, playerB: 'Rick Rack', scoreB: 233, winner: 'A' },
      { playerA: 'Polly Pin', scoreA: 245, playerB: 'Pete Pocket', scoreB: 221, winner: 'A' },
    ],
  },
  {
    label: 'Final',
    matchLabel: 'Final',
    matches: [
      { playerA: 'Alley Oops', scoreA: 268, playerB: 'Polly Pin', scoreB: 245, winner: 'A' },
    ],
  },
]

const SIDE_POT_SCRATCH = [
  { label: 'Game 1',  leaders: [{ name: 'Alley Oops', score: 246 }, { name: 'Polly Pin', score: 223 }, { name: 'Rick Rack', score: 198 }] },
  { label: 'Game 2',  leaders: [{ name: 'Alley Oops', score: 268 }, { name: 'Polly Pin', score: 245 }, { name: 'Rick Rack', score: 231 }] },
  { label: 'Series',  leaders: [{ name: 'Alley Oops', score: 514 }, { name: 'Polly Pin', score: 468 }, { name: 'Rick Rack', score: 429 }] },
]

const SIDE_POT_HANDICAP = [
  { label: 'Game 1', leaders: [{ name: 'Bobby Brooklyn', score: 278 }, { name: 'Sandy Split', score: 267 }, { name: 'Annie Anchor', score: 261 }] },
  { label: 'Game 2', leaders: [{ name: 'Sandy Split', score: 282 }, { name: 'Bobby Brooklyn', score: 276 }, { name: 'Danny Double', score: 259 }] },
  { label: 'Series', leaders: [{ name: 'Sandy Split', score: 549 }, { name: 'Bobby Brooklyn', score: 544 }, { name: 'Annie Anchor', score: 518 }] },
]

export function PublicViewDemo() {
  const [tab, setTab] = useState<Tab>('summary')

  return (
    <div className={styles.publicViewPanel} aria-label="Public tournament view demo">

      <div className={styles.pvHeader}>
        <div className={styles.pvBrandCol}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static branding mark for landing demo */}
          <img src="/logo 2.svg" alt="BracketWorks" className={styles.pvBrandLogo} />
          <div className={styles.pvTournamentInfo}>
            <span className={styles.pvPublicBadge}>BRACKETWORKS · PUBLIC TOURNAMENT VIEW</span>
            <p className={styles.pvTournamentName}>Brass Monkey ID State 2026 · Snake River Bowl</p>
          </div>
        </div>

        <div className={styles.pvControlsPanel}>
          <div className={styles.pvControlsTopRow}>
            <div className={styles.pvSquadSelector}>
              <span className={styles.pvSquadLabel}>Squad</span>
              <span className={styles.pvSquadSelect}>Sat, May 16 11:00 AM ▾</span>
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
        </div>
      </div>

      {tab === 'summary' && (
        <>
          <div className={styles.pvSummaryControls}>
            <div className={styles.pvSearchRow}>
              <input className={styles.pvSearchInput} type="search" placeholder="Find bowler" readOnly value="" />
              <span className={styles.pvSummaryCount}>22 shown</span>
            </div>
            <div className={styles.pvRefreshRow}>
              <span className={styles.pvRefreshMeta}>Last updated 7:27:17 PM</span>
              <span className={styles.pvLiveGroup}><span className={styles.pvLiveDot} />Auto-refresh on</span>
              <span className={styles.pvRefreshBtn}>↻ Refresh Now</span>
            </div>
          </div>

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
        </>
      )}

      {tab === 'brackets' && (
        <div className={styles.pvBracketView}>
          <div className={styles.pvBracketNav}>
            <button type="button" className={styles.pvBracketNavBtn} disabled>Prev</button>
            <div className={styles.pvBracketNavCenter}>
              <span className={styles.pvBracketNavTitle}>Bracket #1 — 4 Person</span>
              <span className={styles.pvBracketNavCount}>1 of 1</span>
            </div>
            <button type="button" className={styles.pvBracketNavBtn} disabled>Next</button>
          </div>
          <div className={styles.pvWinnerBanner}>
            <span className={styles.pvWinnerLabel}>Winner</span>
            <span className={styles.pvWinnerName}>Alley Oops</span>
          </div>
          <div className={styles.pvBracketRounds}>
            {BRACKET_ROUNDS.flatMap((round, ri) => {
              const isFinals = ri === BRACKET_ROUNDS.length - 1
              const roundClass = ri === 0
                ? styles.pvBracketRoundR1
                : ri === 1
                  ? styles.pvBracketRoundR2
                  : styles.pvBracketRoundR3
              const matchesClass = ri === 0
                ? styles.pvRoundMatchesR1
                : ri === 1
                  ? styles.pvRoundMatchesR2
                  : styles.pvRoundMatchesR3
              const roundEl = (
                <div key={round.label} className={`${styles.pvBracketRound} ${roundClass}`}>
                  <div className={styles.pvRoundLabel}>{round.label}</div>
                  <div className={`${styles.pvRoundMatches} ${matchesClass}`}>
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
              const connectorClass = ri === 1 ? styles.pvBracketConnectorR2 : styles.pvBracketConnectorFinal
              const segmentCount = ri === 1 ? 2 : 1
              return [
                <div key={`conn-${ri}`} className={`${styles.pvBracketConnector} ${connectorClass}`} aria-hidden="true">
                  {Array.from({ length: segmentCount }).map((_, si) => (
                    <div key={si} className={styles.pvConnBracket} />
                  ))}
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

          <div className={styles.pvSidePotSection}>
            <div className={styles.pvSidePotSectionTitle}>Handicap</div>
            <div className={styles.pvSidePotGrid}>
              {SIDE_POT_HANDICAP.map(({ label, leaders }) => (
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
