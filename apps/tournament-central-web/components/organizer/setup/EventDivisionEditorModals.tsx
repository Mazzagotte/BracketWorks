'use client';

import { Layers, Trophy, X } from 'lucide-react';

import type { DivisionConfig, EventConfig, SquadConfig } from '../types';
import styles from '../tournament-setup.module.css';
import { InlineDivisionEditor, InlineEventEditor } from './InlineEditors';

type EventDivisionEditorModalsProps = {
  events: EventConfig[];
  divisions: DivisionConfig[];
  squads: SquadConfig[];
  selectedEventId: string | null;
  selectedDivisionId: string | null;
  onCloseEvent: () => void;
  onCloseDivision: () => void;
  onSaveEvent: (event: EventConfig) => void;
  onSaveDivision: (division: DivisionConfig) => void;
};

export default function EventDivisionEditorModals({
  events,
  divisions,
  squads,
  selectedEventId,
  selectedDivisionId,
  onCloseEvent,
  onCloseDivision,
  onSaveEvent,
  onSaveDivision,
}: EventDivisionEditorModalsProps) {
  const selectedEvent = events.find((event) => event.id === selectedEventId);
  const selectedDivision = divisions.find((division) => division.id === selectedDivisionId);

  return (
    <>
      {selectedEvent ? (
        <div className={styles.editorModal} role="dialog" aria-modal="true" aria-labelledby="event-editor-title">
          <div className={styles.editorModalBox}>
            <div className={styles.editorModalHead}>
              <div className={styles.divisionEditorHeadBlock}>
                <span className={styles.divisionEditorHeadBadge}><Trophy size={14} aria-hidden="true" /></span>
                <div className={styles.divisionEditorHeadText}>
                  <span id="event-editor-title" className={styles.editorModalTitle}>Event Details</span>
                  <small className={styles.divisionEditorHeadSubtitle}>{selectedEvent.name || 'New Event'}</small>
                </div>
              </div>
              <button type="button" className={`${styles.iconButton} ${styles.modalCloseButton}`} onClick={onCloseEvent} aria-label="Close event editor">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className={styles.editorModalBody}>
              <InlineEventEditor
                key={selectedEvent.id}
                event={selectedEvent}
                divisions={divisions}
                squads={squads}
                onSave={(updated) => {
                  onSaveEvent(updated);
                  onCloseEvent();
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {selectedDivision ? (
        <div className={styles.editorModal} role="dialog" aria-modal="true" aria-labelledby="division-editor-title">
          <div className={styles.editorModalBox}>
            <div className={styles.editorModalHead}>
              <div className={styles.divisionEditorHeadBlock}>
                <span className={styles.divisionEditorHeadBadge}><Layers size={14} aria-hidden="true" /></span>
                <div className={styles.divisionEditorHeadText}>
                  <span id="division-editor-title" className={styles.editorModalTitle}>Division Details</span>
                  <small className={styles.divisionEditorHeadSubtitle}>{selectedDivision.name || 'New Division'}</small>
                </div>
              </div>
              <button type="button" className={`${styles.iconButton} ${styles.modalCloseButton}`} onClick={onCloseDivision} aria-label="Close division editor">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className={styles.editorModalBody}>
              <InlineDivisionEditor
                key={selectedDivision.id}
                division={selectedDivision}
                events={events}
                onSave={(updated) => {
                  onSaveDivision(updated);
                  onCloseDivision();
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
