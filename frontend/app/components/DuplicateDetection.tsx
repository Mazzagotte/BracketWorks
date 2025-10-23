'use client';

import React, { useState, useEffect, useCallback } from 'react';

import { 
  DuplicateGroup, 
  DuplicateMatch, 
  scanForDuplicateGroups, 
  findDuplicatesForPlayer,
  getSmartSuggestions 
} from '../utils/duplicateDetection';
import {
  generateMergePreview, 
  validateMergeOperation, 
  calculateMergeConfidence,
  ExtendedPlayer,
  MergePreview 
} from '../utils/playerMerging';
import { logger } from '../lib/logger';

interface DuplicateDetectionProps {
  players: any[];
  onMergeComplete?: (mergedPlayerId: number, removedPlayerIds: number[]) => void;
  onDuplicateResolved?: (groupId: string) => void;
}

export default function DuplicateDetection({ players, onMergeComplete, onDuplicateResolved }: DuplicateDetectionProps) {
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [threshold, setThreshold] = useState(0.85);

  const performDuplicateScan = useCallback(async () => {
    setIsScanning(true);
    try {
      // Simulate async operation for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const groups = scanForDuplicateGroups(players, threshold);
      setDuplicateGroups(groups);
    } catch (error) {
      logger.error('Error scanning for duplicates:', error);
    } finally {
      setIsScanning(false);
    }
  }, [players, threshold]);

  // Scan for duplicates on component mount and when players change
  useEffect(() => {
    if (players.length > 0) {
      performDuplicateScan();
    }
  }, [players, threshold, performDuplicateScan]);

  const handleGroupSelect = (group: DuplicateGroup) => {
    setSelectedGroup(group);
    
    // Generate merge preview
    const primaryPlayer = group.primaryPlayer as ExtendedPlayer;
    const playersToMerge = group.duplicates.map(d => d.player as ExtendedPlayer);
    
    const preview = generateMergePreview(primaryPlayer, playersToMerge);
    setMergePreview(preview);
  };

  const handleMergeConfirm = () => {
    if (mergePreview) {
      setShowMergeDialog(true);
    }
  };

  const handleMergeDismiss = (groupId: string) => {
    setDuplicateGroups(prev => prev.filter(g => g.id !== groupId));
    if (onDuplicateResolved) {
      onDuplicateResolved(groupId);
    }
  };

  const getConfidenceColor = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high': return '#dc2626'; // Red
      case 'medium': return '#d97706'; // Orange  
      case 'low': return '#65a30d'; // Green
    }
  };

  const getActionColor = (action: 'merge' | 'review' | 'ignore') => {
    switch (action) {
      case 'merge': return '#059669'; // Green
      case 'review': return '#d97706'; // Orange
      case 'ignore': return '#6b7280'; // Gray
    }
  };

  if (isScanning) {
    return (
      <div style={{
        background: 'linear-gradient(145deg, #ffffff 0%, #f8fafb 100%)',
        borderRadius: '16px',
        padding: '32px',
        textAlign: 'center',
        border: '1px solid rgba(240, 165, 0, 0.12)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid #f0a500',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px'
        }} />
        <h3 style={{ margin: '0 0 8px 0', color: '#374151', fontSize: '18px', fontWeight: '600' }}>
          🔍 Scanning for Duplicates
        </h3>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
          Analyzing {players.length} players for potential duplicates...
        </p>
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(145deg, #ffffff 0%, #f8fafb 100%)',
      borderRadius: '16px',
      padding: '24px',
      border: '1px solid rgba(240, 165, 0, 0.12)',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', color: '#374151', fontSize: '20px', fontWeight: '700' }}>
            🔍 Duplicate Player Detection
          </h2>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
            Found {duplicateGroups.length} potential duplicate group{duplicateGroups.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Threshold Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>
              Sensitivity:
            </label>
            <input
              type="range"
              min="0.7"
              max="0.95"
              step="0.05"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              style={{
                width: '80px',
                accentColor: '#f0a500'
              }}
            />
            <span style={{ fontSize: '12px', color: '#6b7280', minWidth: '30px' }}>
              {Math.round(threshold * 100)}%
            </span>
          </div>
          
          <button
            onClick={performDuplicateScan}
            style={{
              background: 'linear-gradient(135deg, #f0a500 0%, #e89700 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(240, 165, 0, 0.25)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(240, 165, 0, 0.35)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(240, 165, 0, 0.25)';
            }}
          >
            🔄 Re-scan
          </button>
        </div>
      </div>

      {/* No Duplicates Found */}
      {duplicateGroups.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '32px',
          color: '#059669',
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.05) 0%, rgba(16, 185, 129, 0.05) 100%)',
          borderRadius: '12px',
          border: '1px solid rgba(5, 150, 105, 0.15)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>
            No Duplicates Found
          </h3>
          <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>
            All {players.length} players appear to be unique
          </p>
        </div>
      )}

      {/* Duplicate Groups List */}
      {duplicateGroups.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {duplicateGroups.map((group, index) => (
            <DuplicateGroupCard
              key={group.id}
              group={group}
              index={index}
              onSelect={() => handleGroupSelect(group)}
              onDismiss={() => handleMergeDismiss(group.id)}
              isSelected={selectedGroup?.id === group.id}
            />
          ))}
        </div>
      )}

      {/* Merge Preview Panel */}
      {mergePreview && selectedGroup && (
        <MergePreviewPanel
          preview={mergePreview}
          onConfirm={handleMergeConfirm}
          onCancel={() => {
            setSelectedGroup(null);
            setMergePreview(null);
          }}
        />
      )}

      {/* Merge Confirmation Dialog */}
      {showMergeDialog && mergePreview && (
        <MergeConfirmationDialog
          preview={mergePreview}
          onConfirm={(mergedId, removedIds) => {
            setShowMergeDialog(false);
            setSelectedGroup(null);
            setMergePreview(null);
            if (onMergeComplete) {
              onMergeComplete(mergedId, removedIds);
            }
          }}
          onCancel={() => setShowMergeDialog(false)}
        />
      )}
    </div>
  );
}

// Duplicate Group Card Component
function DuplicateGroupCard({ 
  group, 
  index, 
  onSelect, 
  onDismiss, 
  isSelected 
}: {
  group: DuplicateGroup;
  index: number;
  onSelect: () => void;
  onDismiss: () => void;
  isSelected: boolean;
}) {
  const confidenceColor = group.confidence === 'high' ? '#dc2626' : group.confidence === 'medium' ? '#d97706' : '#65a30d';
  const actionColor = group.suggestedAction === 'merge' ? '#059669' : group.suggestedAction === 'review' ? '#d97706' : '#6b7280';

  return (
    <div style={{
      background: isSelected ? 'linear-gradient(135deg, rgba(240, 165, 0, 0.05) 0%, rgba(232, 151, 0, 0.05) 100%)' : '#ffffff',
      border: isSelected ? '2px solid #f0a500' : '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '16px',
      transition: 'all 0.2s ease',
      cursor: 'pointer'
    }}
    onClick={onSelect}
    onMouseEnter={(e) => {
      if (!isSelected) {
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }
    }}
    onMouseLeave={(e) => {
      if (!isSelected) {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }
    }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{
              background: confidenceColor,
              color: '#ffffff',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: '600',
              textTransform: 'uppercase'
            }}>
              {group.confidence} Confidence
            </div>
            <div style={{
              background: actionColor,
              color: '#ffffff',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: '600',
              textTransform: 'uppercase'
            }}>
              {group.suggestedAction}
            </div>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>
              Group #{index + 1}
            </span>
          </div>

          {/* Primary Player */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
              📋 Primary: {group.primaryPlayer.firstName} {group.primaryPlayer.lastName}
            </div>
            <div style={{ fontSize: '13px', color: '#6b7280', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {group.primaryPlayer.usbc && <span>USBC: {group.primaryPlayer.usbc}</span>}
              {group.primaryPlayer.average && <span>Avg: {group.primaryPlayer.average}</span>}
              {group.primaryPlayer.division && <span>Division: {group.primaryPlayer.division}</span>}
            </div>
          </div>

          {/* Duplicate Matches */}
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
              🔗 Potential Duplicates ({group.duplicates.length}):
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {group.duplicates.map((duplicate, i) => (
                <div key={i} style={{
                  background: 'rgba(240, 165, 0, 0.05)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                      {duplicate.player.firstName} {duplicate.player.lastName}
                    </span>
                    <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '8px' }}>
                      ({Math.round(duplicate.matchScore * 100)}% match)
                    </span>
                  </div>
                  <div style={{
                    background: duplicate.matchType === 'exact' ? '#dc2626' : duplicate.matchType === 'usbc' ? '#059669' : '#d97706',
                    color: '#ffffff',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontSize: '10px',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}>
                    {duplicate.matchType}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '100px' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            style={{
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {isSelected ? '✓ Selected' : 'Review'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            style={{
              background: '#6b7280',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6b7280'}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

// Merge Preview Panel Component
function MergePreviewPanel({ 
  preview, 
  onConfirm, 
  onCancel 
}: {
  preview: MergePreview;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const validation = validateMergeOperation(preview);
  const confidence = calculateMergeConfidence(preview.primaryPlayer, preview.playersToMerge);

  return (
    <div style={{
      marginTop: '24px',
      background: 'linear-gradient(145deg, #fefefe 0%, #f9fafb 100%)',
      border: '2px solid #f0a500',
      borderRadius: '12px',
      padding: '20px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: 0, color: '#374151', fontSize: '18px', fontWeight: '700' }}>
          🔗 Merge Preview
        </h3>
        <div style={{
          background: confidence.confidence > 0.85 ? '#059669' : confidence.confidence > 0.7 ? '#d97706' : '#dc2626',
          color: '#ffffff',
          borderRadius: '6px',
          padding: '4px 12px',
          fontSize: '12px',
          fontWeight: '600'
        }}>
          {Math.round(confidence.confidence * 100)}% Confidence
        </div>
      </div>

      {/* Merge Impact */}
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#374151', fontSize: '14px', fontWeight: '600' }}>
          📊 Merge Impact:
        </h4>
        <p style={{ margin: '0 0 12px 0', color: '#6b7280', fontSize: '14px' }}>
          {preview.estimatedImpact}
        </p>
        
        {/* Affected Records */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
          <div style={{
            background: 'rgba(240, 165, 0, 0.1)',
            borderRadius: '8px',
            padding: '12px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#d97706' }}>
              {preview.affectedRecords.brackets.length}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Bracket Records</div>
          </div>
          <div style={{
            background: 'rgba(240, 165, 0, 0.1)',
            borderRadius: '8px',
            padding: '12px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#d97706' }}>
              {preview.affectedRecords.scores.length}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Score Records</div>
          </div>
          <div style={{
            background: 'rgba(240, 165, 0, 0.1)',
            borderRadius: '8px',
            padding: '12px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#d97706' }}>
              {preview.affectedRecords.payments.length}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Payment Records</div>
          </div>
        </div>
      </div>

      {/* Validation Results */}
      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div style={{ marginBottom: '20px' }}>
          {validation.errors.length > 0 && (
            <div style={{
              background: 'rgba(220, 38, 38, 0.1)',
              borderLeft: '4px solid #dc2626',
              borderRadius: '4px',
              padding: '12px',
              marginBottom: '8px'
            }}>
              <h5 style={{ margin: '0 0 8px 0', color: '#dc2626', fontSize: '14px', fontWeight: '600' }}>
                ❌ Errors:
              </h5>
              {validation.errors.map((error, i) => (
                <div key={i} style={{ fontSize: '13px', color: '#7f1d1d', marginBottom: '4px' }}>
                  • {error}
                </div>
              ))}
            </div>
          )}
          
          {validation.warnings.length > 0 && (
            <div style={{
              background: 'rgba(217, 119, 6, 0.1)',
              borderLeft: '4px solid #d97706',
              borderRadius: '4px',
              padding: '12px'
            }}>
              <h5 style={{ margin: '0 0 8px 0', color: '#d97706', fontSize: '14px', fontWeight: '600' }}>
                ⚠️ Warnings:
              </h5>
              {validation.warnings.map((warning, i) => (
                <div key={i} style={{ fontSize: '13px', color: '#92400e', marginBottom: '4px' }}>
                  • {warning}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{
            background: '#6b7280',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4b5563'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6b7280'}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={!validation.isValid}
          style={{
            background: validation.isValid 
              ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' 
              : '#d1d5db',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: validation.isValid ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            opacity: validation.isValid ? 1 : 0.6
          }}
          onMouseEnter={(e) => {
            if (validation.isValid) {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(5, 150, 105, 0.25)';
            }
          }}
          onMouseLeave={(e) => {
            if (validation.isValid) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }
          }}
        >
          {validation.isValid ? '🔗 Proceed with Merge' : '❌ Cannot Merge'}
        </button>
      </div>
    </div>
  );
}

// Merge Confirmation Dialog Component
function MergeConfirmationDialog({ 
  preview, 
  onConfirm, 
  onCancel 
}: {
  preview: MergePreview;
  onConfirm: (mergedId: number, removedIds: number[]) => void;
  onCancel: () => void;
}) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mergedId = preview.primaryPlayer.id;
      const removedIds = preview.playersToMerge.map(p => p.id);
      
      onConfirm(mergedId, removedIds);
    } catch (error) {
      logger.error('Merge failed:', error);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ margin: '0 0 8px 0', color: '#374151', fontSize: '24px', fontWeight: '700' }}>
            Confirm Player Merge
          </h2>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '16px' }}>
            This action cannot be undone. Are you sure you want to proceed?
          </p>
        </div>

        <div style={{
          background: '#f9fafb',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px'
        }}>
          <h3 style={{ margin: '0 0 12px 0', color: '#374151', fontSize: '16px', fontWeight: '600' }}>
            Merge Summary:
          </h3>
          <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>
            <div style={{ marginBottom: '8px' }}>
              <strong>Primary Player:</strong> {preview.primaryPlayer.firstName} {preview.primaryPlayer.lastName}
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>Players to Merge:</strong> {preview.playersToMerge.map(p => `${p.firstName} ${p.lastName}`).join(', ')}
            </div>
            <div>
              <strong>Total Records Affected:</strong> {
                preview.affectedRecords.brackets.length + 
                preview.affectedRecords.scores.length + 
                preview.affectedRecords.payments.length
              }
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={onCancel}
            disabled={isConfirming}
            style={{
              background: '#6b7280',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isConfirming ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: isConfirming ? 0.5 : 1
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirming}
            style={{
              background: isConfirming 
                ? 'linear-gradient(135deg, #d1d5db 0%, #9ca3af 100%)'
                : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isConfirming ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isConfirming && (
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid #ffffff',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            )}
            {isConfirming ? 'Merging...' : '🔗 Confirm Merge'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Add CSS animation for spinner
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);