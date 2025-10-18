'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getSmartSuggestions, validateUSBC, DuplicateMatch } from '../utils/duplicateDetection';
import { generateMergePreview, validateMergeOperation, MergePreview } from '../utils/playerMerging';

interface SmartSuggestionsProps {
  firstName: string;
  lastName: string;
  usbc?: string;
  players: any[];
  onSuggestionSelect?: (suggestion: DuplicateMatch) => void;
  onWarningAcknowledge?: () => void;
  onMergeComplete?: (mergedPlayer: any) => void;
  className?: string;
}

export default function SmartSuggestions({
  firstName,
  lastName,
  usbc,
  players,
  onSuggestionSelect,
  onWarningAcknowledge,
  onMergeComplete,
  className = ''
}: SmartSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<{
    warnings: string[];
    suggestions: string[];
    potentialDuplicates: DuplicateMatch[];
  }>({ warnings: [], suggestions: [], potentialDuplicates: [] });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [acknowledgedWarnings, setAcknowledgedWarnings] = useState<Set<string>>(new Set());
  const [selectedDuplicate, setSelectedDuplicate] = useState<DuplicateMatch | null>(null);
  const [showMergePreview, setShowMergePreview] = useState(false);
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null);

  // Debounced suggestion generation
  const generateSuggestions = useCallback(() => {
    if (firstName.trim() && lastName.trim()) {
      const result = getSmartSuggestions(firstName, lastName, usbc, players);
      setSuggestions(result);
      setShowSuggestions(result.warnings.length > 0 || result.potentialDuplicates.length > 0);
    } else {
      setSuggestions({ warnings: [], suggestions: [], potentialDuplicates: [] });
      setShowSuggestions(false);
    }
  }, [firstName, lastName, usbc, players]);

  // Debounced version
  const debouncedGenerateSuggestions = useMemo(
    () => debounce(generateSuggestions, 300),
    [generateSuggestions]
  );

  useEffect(() => {
    debouncedGenerateSuggestions();
  }, [debouncedGenerateSuggestions]);

  const handleMergeClick = async (duplicate: DuplicateMatch) => {
    setSelectedDuplicate(duplicate);
    
    // Create a temporary new player object for merge preview
    const newPlayer = {
      id: -1, // Temporary ID
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      usbc: usbc?.trim() || '',
      average: 0,
      handicap: 0,
      scratch: 0,
      lane: '',
      division: 'Open',
      totalCost: 0,
      amountPaid: 0
    };

    try {
      const preview = generateMergePreview(duplicate.player, [newPlayer]);
      setMergePreview(preview);
      setShowMergePreview(true);
    } catch (error) {
      console.error('Error generating merge preview:', error);
    }
  };

  const handleConfirmMerge = async () => {
    if (!mergePreview || !selectedDuplicate) return;

    try {
      // In a real implementation, this would call an API
      const mergedPlayer = {
        ...selectedDuplicate.player,
        ...mergePreview.consolidatedData.finalPlayer
      };

      onMergeComplete?.(mergedPlayer);
      setShowMergePreview(false);
      setSelectedDuplicate(null);
      setMergePreview(null);
      setShowSuggestions(false);
    } catch (error) {
      console.error('Error merging players:', error);
    }
  };

  const handleCancelMerge = () => {
    setShowMergePreview(false);
    setSelectedDuplicate(null);
    setMergePreview(null);
  };

  const handleWarningAcknowledge = (warning: string) => {
    setAcknowledgedWarnings(prev => new Set(prev).add(warning));
    if (onWarningAcknowledge) {
      onWarningAcknowledge();
    }
  };

  const handleSuggestionSelect = (duplicate: DuplicateMatch) => {
    if (onSuggestionSelect) {
      onSuggestionSelect(duplicate);
    }
    setShowSuggestions(false);
  };

  const unacknowledgedWarnings = suggestions.warnings.filter(w => !acknowledgedWarnings.has(w));
  const hasContent = unacknowledgedWarnings.length > 0 || suggestions.potentialDuplicates.length > 0;

  if (!showSuggestions || !hasContent) {
    return null;
  }

  return (
    <>
    <div className={className} style={{
      background: 'linear-gradient(145deg, #ffffff 0%, #fef7ed 100%)',
      border: '2px solid #f0a500',
      borderRadius: '12px',
      padding: '16px',
      marginTop: '8px',
      boxShadow: '0 4px 20px rgba(240, 165, 0, 0.15)',
      animation: 'slideDown 0.3s ease-out'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <h4 style={{
          margin: 0,
          color: '#d97706',
          fontSize: '16px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          🤖 Smart Suggestions
        </h4>
        <button
          onClick={() => setShowSuggestions(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: '18px',
            padding: '4px',
            borderRadius: '4px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(107, 114, 128, 0.1)';
            e.currentTarget.style.color = '#374151';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#6b7280';
          }}
          title="Dismiss suggestions"
        >
          ×
        </button>
      </div>

      {/* Warnings Section */}
      {unacknowledgedWarnings.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h5 style={{
            margin: '0 0 8px 0',
            color: '#dc2626',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            ⚠️ Warnings
          </h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {unacknowledgedWarnings.map((warning, index) => (
              <div
                key={index}
                style={{
                  background: 'rgba(220, 38, 38, 0.05)',
                  border: '1px solid rgba(220, 38, 38, 0.2)',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{
                    color: '#dc2626',
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '4px'
                  }}>
                    {warning}
                  </div>
                  {suggestions.suggestions.length > 0 && (
                    <div style={{ color: '#6b7280', fontSize: '12px' }}>
                      💡 {suggestions.suggestions[0]}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleWarningAcknowledge(warning)}
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                >
                  Got it
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Potential Duplicates Section */}
      {suggestions.potentialDuplicates.length > 0 && (
        <div>
          <h5 style={{
            margin: '0 0 12px 0',
            color: '#d97706',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            🔍 Similar Players Found ({suggestions.potentialDuplicates.length})
          </h5>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {suggestions.potentialDuplicates.slice(0, 3).map((duplicate, index) => (
              <PotentialDuplicateCard
                key={index}
                duplicate={duplicate}
                onSelect={() => handleSuggestionSelect(duplicate)}
                onMerge={() => handleMergeClick(duplicate)}
              />
            ))}
            
            {suggestions.potentialDuplicates.length > 3 && (
              <div style={{
                textAlign: 'center',
                padding: '8px',
                color: '#6b7280',
                fontSize: '12px',
                fontStyle: 'italic'
              }}>
                + {suggestions.potentialDuplicates.length - 3} more similar player{suggestions.potentialDuplicates.length - 3 !== 1 ? 's' : ''} found
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{
            marginTop: '12px',
            padding: '12px',
            background: 'rgba(240, 165, 0, 0.05)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ fontSize: '13px', color: '#6b7280' }}>
              💡 Review existing players before adding a new one
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowSuggestions(false)}
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
                Add Anyway
              </button>
              <button
                onClick={() => {
                  // Could open a detailed view or player search
                  // View all similar players action
                }}
                style={{
                  background: 'linear-gradient(135deg, #f0a500 0%, #e89700 100%)',
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
                View All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    
    {/* Merge Preview Dialog */}
    {showMergePreview && mergePreview && (
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
          padding: '24px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)'
        }}>
          <h3 style={{
            margin: '0 0 16px 0',
            color: '#374151',
            fontSize: '18px',
            fontWeight: '700'
          }}>
            🔗 Merge Player Records
          </h3>
          
          <p style={{
            margin: '0 0 20px 0',
            color: '#6b7280',
            fontSize: '14px'
          }}>
            Combining &quot;{firstName} {lastName}&quot; with existing player &quot;{selectedDuplicate?.player.firstName} {selectedDuplicate?.player.lastName}&quot;
          </p>
          
          {/* Confidence Score */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(240, 165, 0, 0.1) 0%, rgba(240, 165, 0, 0.05) 100%)',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '20px',
            border: '1px solid rgba(240, 165, 0, 0.2)'
          }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
              Merge Impact: {mergePreview?.estimatedImpact || 'Analyzing...'}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              🔗 Merging player records and consolidating data
            </div>
          </div>
          
          {/* Conflicts */}
          {mergePreview?.consolidatedData?.dataConflicts?.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{
                margin: '0 0 12px 0',
                color: '#dc2626',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                ⚠️ Data Conflicts ({mergePreview.consolidatedData.dataConflicts.length})
              </h4>
              {mergePreview.consolidatedData.dataConflicts.map((conflict: any, index: number) => (
                <div key={index} style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '8px'
                }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#dc2626', marginBottom: '4px' }}>
                    {conflict.field.toUpperCase()}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {conflict.reasoning}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={handleCancelMerge}
              style={{
                background: '#6b7280',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmMerge}
              style={{
                background: 'linear-gradient(135deg, #f0a500 0%, #e09400 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Confirm Merge
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// Potential Duplicate Card Component
function PotentialDuplicateCard({ 
  duplicate, 
  onSelect,
  onMerge 
}: {
  duplicate: DuplicateMatch;
  onSelect: () => void;
  onMerge?: () => void;
}) {
  const getMatchTypeColor = (type: string) => {
    switch (type) {
      case 'exact': return '#dc2626';
      case 'usbc': return '#059669';
      case 'similar': return '#d97706';
      case 'fuzzy': return '#6366f1';
      default: return '#6b7280';
    }
  };

  const getMatchTypeIcon = (type: string) => {
    switch (type) {
      case 'exact': return '🎯';
      case 'usbc': return '🔢';
      case 'similar': return '👥';
      case 'fuzzy': return '🔍';
      default: return '❓';
    }
  };

  const isHighConfidence = duplicate.matchScore >= 0.9;

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}
      onClick={onSelect}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#f0a500';
        e.currentTarget.style.boxShadow = '0 2px 12px rgba(240, 165, 0, 0.15)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#e5e7eb';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '4px'
        }}>
          <span style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#374151'
          }}>
            {duplicate.player.firstName} {duplicate.player.lastName}
          </span>
          <div style={{
            background: getMatchTypeColor(duplicate.matchType),
            color: '#ffffff',
            borderRadius: '4px',
            padding: '2px 6px',
            fontSize: '10px',
            fontWeight: '600',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '2px'
          }}>
            {getMatchTypeIcon(duplicate.matchType)}
            {duplicate.matchType}
          </div>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '12px',
          color: '#6b7280'
        }}>
          <span>{Math.round(duplicate.matchScore * 100)}% match</span>
          {duplicate.player.usbc && <span>USBC: {duplicate.player.usbc}</span>}
          {duplicate.player.average && <span>Avg: {duplicate.player.average}</span>}
        </div>
        
        {duplicate.matchReasons.length > 0 && (
          <div style={{
            marginTop: '6px',
            fontSize: '11px',
            color: '#9ca3af',
            fontStyle: 'italic'
          }}>
            {duplicate.matchReasons[0]}
          </div>
        )}
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <div style={{
          background: `linear-gradient(90deg, #e5e7eb 0%, ${getMatchTypeColor(duplicate.matchType)} ${duplicate.matchScore * 100}%)`,
          borderRadius: '4px',
          height: '4px',
          width: '40px'
        }} />
        
        {isHighConfidence && onMerge && (
          <button
            style={{
              background: 'linear-gradient(135deg, #f0a500 0%, #e09400 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            onClick={(e) => {
              e.stopPropagation();
              onMerge();
            }}
          >
            Merge
          </button>
        )}
        
        <button
          style={{
            background: isHighConfidence ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '11px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          {isHighConfidence ? 'Use Existing' : 'View'}
        </button>
      </div>
    </div>
  );
}

// USBC Validation Component
export function USBCValidationIndicator({ 
  usbc, 
  players, 
  excludeId 
}: {
  usbc: string;
  players: any[];
  excludeId?: number;
}) {
  if (!usbc) return null;

  const validation = validateUSBC(usbc, players, excludeId);

  if (validation.isValid) {
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        background: 'rgba(5, 150, 105, 0.1)',
        color: '#059669',
        borderRadius: '4px',
        padding: '2px 6px',
        fontSize: '11px',
        fontWeight: '600'
      }}>
        ✅ Valid USBC
      </div>
    );
  }

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      background: 'rgba(220, 38, 38, 0.1)',
      color: '#dc2626',
      borderRadius: '4px',
      padding: '2px 6px',
      fontSize: '11px',
      fontWeight: '600'
    }}>
      ❌ {validation.error}
    </div>
  );
}

// Utility function for debouncing
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideDown {
    0% {
      opacity: 0;
      transform: translateY(-10px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
document.head.appendChild(style);