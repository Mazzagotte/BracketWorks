'use client'

import HelpGuideModal from '../../components/HelpGuideModal'

interface ExplainBracketsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ExplainBracketsModal({ isOpen, onClose }: ExplainBracketsModalProps) {
  return (
    <HelpGuideModal open={isOpen} onClose={onClose} title="Bracket guide" section="brackets">
      <section>
        <h3>Single elimination</h3>
        <p>
          BracketWorks runs single-elimination brackets. With 8 bowlers there are three rounds.
          Winners move on and the other bowler is out, except in the tie cases below.
        </p>
        <ul>
          <li><strong>Quarterfinals</strong>: 8 bowlers to 4 winners</li>
          <li><strong>Semifinals</strong>: 4 bowlers to 2 winners</li>
          <li><strong>Final</strong>: 2 bowlers to 1 champion</li>
        </ul>
      </section>
      <section>
        <h3>Ties</h3>
        <h4>Quarterfinal and semifinal ties: both advance</h4>
        <p>
          If two bowlers tie, both move to the next round and their next-round scores are compared.
          The lower score is out, and the higher score counts as the winner of the tied match.
          For example, A and B tie at 210 and both advance. In the semifinal A scores 220 and B scores 180, so B is out.
        </p>
        <h4>Ties that carry forward</h4>
        <p>
          If the same bowlers tie again, both keep advancing until a round breaks the tie.
          For example, A and B tie in two rounds; in the final A shoots 240 and B shoots 220, so A wins the bracket.
        </p>
        <h4>Tied final: split pot</h4>
        <p>If the final ends in a tie with no carried tie left, both finalists split the prize pot evenly.</p>
      </section>
      <section>
        <h3>Bracket types</h3>
        <h4>Scratch</h4>
        <p>Bowlers compete on their actual scores. The higher score wins each match.</p>
        <h4>Handicap</h4>
        <p>Scores are adjusted by average to level the field. Bowlers with lower averages get bonus pins.</p>
        <h4>Reverse</h4>
        <p>
          A standard bracket uses game 1 for the quarterfinals, game 2 for the semifinals, and game 3 for the final.
          Reverse brackets flip that order. Reverse is available for scratch and handicap.
        </p>
      </section>
      <section>
        <h3>Reading a match</h3>
        <p>Bowlers are placed in brackets at random. If match history is on, BracketWorks avoids recent rematches. Each match shows:</p>
        <ul>
          <li><strong>Winner</strong>: bold with a check mark</li>
          <li><strong>Margin</strong>: how many pins the winner won by, at the top right</li>
          <li><strong>Ties</strong>: &quot;Tie, both advance&quot; or &quot;Split pot&quot; in place of the margin</li>
          <li><strong>Highlight</strong>: select a bowler, or search for one, to shade their matches</li>
        </ul>
      </section>
    </HelpGuideModal>
  )
}
