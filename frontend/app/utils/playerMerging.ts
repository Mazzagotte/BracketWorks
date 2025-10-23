import { Player } from '../lib/types';

// Player merging utilities and data consolidation logic


export interface MergeableData {
  scores?: {
    game1_scratch?: number;
    game1_total?: number;
    game2_scratch?: number;
    game2_total?: number;
    game3_scratch?: number;
    game3_total?: number;
  };
  brackets?: {
    scratch?: number;
    handicap?: number;
  };
  payments?: {
    totalCost?: number;
    amountPaid?: number;
  };
  metadata?: {
    createdAt?: string;
    lastModified?: string;
    squad?: {
      id: number;
      date: string;
      time: string;
    };
  };
}

export interface ExtendedPlayer extends Player {
  data?: MergeableData;
}

export interface MergePreview {
  primaryPlayer: ExtendedPlayer;
  playersToMerge: ExtendedPlayer[];
  consolidatedData: {
    finalPlayer: ExtendedPlayer;
    dataConflicts: DataConflict[];
    consolidationRules: ConsolidationRule[];
  };
  affectedRecords: {
    brackets: string[];
    scores: string[];
    payments: string[];
  };
  estimatedImpact: string;
}

type PlayerFieldValue = string | number | boolean | null | undefined;

// Helper function to safely get player field values
function getPlayerFieldValue(player: Player | ExtendedPlayer, field: string): PlayerFieldValue {
  const playerRecord = player as unknown as Record<string, unknown>;
  const value = playerRecord[field];
  return value as PlayerFieldValue;
}

export interface DataConflict {
  field: string;
  values: { playerId: number; playerName: string; value: PlayerFieldValue }[];
  suggestedResolution: 'keep_primary' | 'keep_latest' | 'keep_highest' | 'manual_review';
  reasoning: string;
}

export interface ConsolidationRule {
  field: string;
  action: 'sum' | 'max' | 'min' | 'keep_primary' | 'keep_latest' | 'manual';
  description: string;
}

export interface MergeOperation {
  id: string;
  timestamp: string;
  primaryPlayerId: number;
  mergedPlayerIds: number[];
  consolidatedData: ExtendedPlayer;
  conflicts: DataConflict[];
  resolutions: { field: string; chosenValue: PlayerFieldValue; reason: string }[];
  affectedTables: string[];
  canUndo: boolean;
  performedBy: string;
}

/**
 * Default consolidation rules for different data types
 */
const DEFAULT_CONSOLIDATION_RULES: ConsolidationRule[] = [
  {
    field: 'firstName',
    action: 'keep_primary',
    description: 'Keep primary player\'s first name'
  },
  {
    field: 'lastName', 
    action: 'keep_primary',
    description: 'Keep primary player\'s last name'
  },
  {
    field: 'usbc',
    action: 'keep_latest',
    description: 'Use most recently entered USBC number'
  },
  {
    field: 'average',
    action: 'max',
    description: 'Use highest average score'
  },
  {
    field: 'handicap',
    action: 'manual',
    description: 'Handicap should be recalculated based on final average'
  },
  {
    field: 'scratch',
    action: 'sum',
    description: 'Combine all scratch bracket entries'
  },
  {
    field: 'amountPaid',
    action: 'sum',
    description: 'Combine all payments made'
  },
  {
    field: 'totalCost',
    action: 'sum',
    description: 'Combine all tournament costs'
  }
];

/**
 * Detect conflicts between player data that need manual resolution
 */
function detectDataConflicts(players: ExtendedPlayer[]): DataConflict[] {
  const conflicts: DataConflict[] = [];
  
  // Check for conflicting basic information
  const fields = ['firstName', 'lastName', 'usbc', 'average', 'division', 'lane'];
  
  for (const field of fields) {
    const values = players
      .map(p => ({ playerId: p.id, playerName: `${p.firstName} ${p.lastName}`, value: getPlayerFieldValue(p, field) }))
      .filter(v => v.value !== undefined && v.value !== null && v.value !== '');
    
    const uniqueValues = [...new Set(values.map(v => v.value))];
    
    if (uniqueValues.length > 1) {
      let suggestedResolution: DataConflict['suggestedResolution'] = 'manual_review';
      let reasoning = 'Multiple different values found, requires manual review';
      
      // Smart suggestions based on field type
      switch (field) {
        case 'average':
          suggestedResolution = 'keep_highest';
          reasoning = 'Higher average typically indicates more recent/accurate data';
          break;
        case 'usbc':
          suggestedResolution = 'keep_latest';
          reasoning = 'Most recently entered USBC is likely most accurate';
          break;
        case 'firstName':
        case 'lastName':
          // Check if one is a variation of another
          if (uniqueValues.length === 2) {
            const [val1, val2] = uniqueValues;
            if (typeof val1 === 'string' && typeof val2 === 'string') {
              if (val1.toLowerCase().includes(val2.toLowerCase()) || val2.toLowerCase().includes(val1.toLowerCase())) {
                suggestedResolution = 'keep_primary';
                reasoning = 'Keeping primary player\'s name format';
              }
            }
          }
          break;
      }
      
      conflicts.push({
        field,
        values,
        suggestedResolution,
        reasoning
      });
    }
  }
  
  return conflicts;
}

/**
 * Apply consolidation rules to merge player data
 */
function consolidatePlayerData(
  primaryPlayer: ExtendedPlayer,
  playersToMerge: ExtendedPlayer[],
  customRules?: Partial<Record<string, ConsolidationRule>>
): { consolidatedPlayer: ExtendedPlayer; appliedRules: ConsolidationRule[] } {
  const allPlayers = [primaryPlayer, ...playersToMerge];
  const consolidatedPlayer: ExtendedPlayer = { ...primaryPlayer };
  const appliedRules: ConsolidationRule[] = [];
  
  // Merge basic player data
  for (const rule of DEFAULT_CONSOLIDATION_RULES) {
    const customRule = customRules?.[rule.field];
    const activeRule = customRule || rule;
    
    const field = rule.field as keyof Player;
    const values = allPlayers
      .map(p => getPlayerFieldValue(p, field))
      .filter(v => v !== undefined && v !== null && v !== '');
    
    if (values.length === 0) continue;
    
    let finalValue: PlayerFieldValue;
    
    switch (activeRule.action) {
      case 'keep_primary':
        finalValue = (primaryPlayer as unknown as Record<string, PlayerFieldValue>)[field];
        break;
      case 'keep_latest':
        // For now, assume primary is latest. In real implementation, use timestamps
        finalValue = values[values.length - 1];
        break;
      case 'max':
        finalValue = Math.max(...values.filter(v => typeof v === 'number'));
        break;
      case 'min':
        finalValue = Math.min(...values.filter(v => typeof v === 'number'));
        break;
      case 'sum':
        finalValue = values.filter(v => typeof v === 'number').reduce((sum, val) => sum + val, 0);
        break;
      case 'manual':
        // Keep original value for manual review
        finalValue = getPlayerFieldValue(primaryPlayer, field);
        break;
    }
    
    if (finalValue !== undefined) {
      (consolidatedPlayer as unknown as Record<string, PlayerFieldValue>)[field] = finalValue;
      appliedRules.push(activeRule);
    }
  }
  
  // Consolidate extended data
  if (allPlayers.some(p => p.data)) {
    consolidatedPlayer.data = consolidateExtendedData(allPlayers);
  }
  
  return { consolidatedPlayer, appliedRules };
}

/**
 * Consolidate extended data (scores, brackets, payments)
 */
function consolidateExtendedData(players: ExtendedPlayer[]): MergeableData {
  const consolidated: MergeableData = {};
  
  // Consolidate scores - keep highest scores for each game
  const allScores = players.filter(p => p.data?.scores).map(p => p.data!.scores!);
  if (allScores.length > 0) {
    consolidated.scores = {
      game1_scratch: Math.max(...allScores.map(s => s.game1_scratch || 0)),
      game1_total: Math.max(...allScores.map(s => s.game1_total || 0)),
      game2_scratch: Math.max(...allScores.map(s => s.game2_scratch || 0)),
      game2_total: Math.max(...allScores.map(s => s.game2_total || 0)),
      game3_scratch: Math.max(...allScores.map(s => s.game3_scratch || 0)),
      game3_total: Math.max(...allScores.map(s => s.game3_total || 0))
    };
  }
  
  // Consolidate bracket entries - sum all entries
  const allBrackets = players.filter(p => p.data?.brackets).map(p => p.data!.brackets!);
  if (allBrackets.length > 0) {
    consolidated.brackets = {
      scratch: allBrackets.reduce((sum, b) => sum + (b.scratch || 0), 0),
      handicap: allBrackets.reduce((sum, b) => sum + (b.handicap || 0), 0)
    };
  }
  
  // Consolidate payments - sum all amounts
  const allPayments = players.filter(p => p.data?.payments).map(p => p.data!.payments!);
  if (allPayments.length > 0) {
    consolidated.payments = {
      totalCost: allPayments.reduce((sum, p) => sum + (p.totalCost || 0), 0),
      amountPaid: allPayments.reduce((sum, p) => sum + (p.amountPaid || 0), 0)
    };
  }
  
  return consolidated;
}

/**
 * Generate a preview of what the merge operation will do
 */
export function generateMergePreview(
  primaryPlayer: ExtendedPlayer,
  playersToMerge: ExtendedPlayer[],
  customRules?: Partial<Record<string, ConsolidationRule>>
): MergePreview {
  const allPlayers = [primaryPlayer, ...playersToMerge];
  const dataConflicts = detectDataConflicts(allPlayers);
  const { consolidatedPlayer, appliedRules } = consolidatePlayerData(primaryPlayer, playersToMerge, customRules);
  
  // Estimate affected records
  const affectedRecords = {
    brackets: playersToMerge.map(p => `${p.firstName} ${p.lastName} brackets`),
    scores: playersToMerge.map(p => `${p.firstName} ${p.lastName} scores`),
    payments: playersToMerge.map(p => `${p.firstName} ${p.lastName} payments`)
  };
  
  const totalMergedPlayers = playersToMerge.length;
  const estimatedImpact = `${totalMergedPlayers} player record${totalMergedPlayers > 1 ? 's' : ''} will be merged into ${primaryPlayer.firstName} ${primaryPlayer.lastName}`;
  
  return {
    primaryPlayer,
    playersToMerge,
    consolidatedData: {
      finalPlayer: consolidatedPlayer,
      dataConflicts,
      consolidationRules: appliedRules
    },
    affectedRecords,
    estimatedImpact
  };
}

/**
 * Validate a merge operation before execution
 */
export function validateMergeOperation(preview: MergePreview): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check for critical data conflicts
  const criticalConflicts = preview.consolidatedData.dataConflicts.filter(
    c => ['firstName', 'lastName', 'usbc'].includes(c.field) && c.suggestedResolution === 'manual_review'
  );
  
  if (criticalConflicts.length > 0) {
    errors.push('Critical data conflicts found that require manual resolution');
  }
  
  // Check for players with no data
  const playersWithoutData = preview.playersToMerge.filter(p => !p.data || Object.keys(p.data).length === 0);
  if (playersWithoutData.length > 0) {
    warnings.push(`${playersWithoutData.length} player(s) have no additional data to merge`);
  }
  
  // Check for high-value transactions
  const totalPayments = preview.playersToMerge.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
  if (totalPayments > 500) {
    warnings.push(`High payment amount involved ($${totalPayments}) - extra verification recommended`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Calculate similarity score for merge confidence
 */
export function calculateMergeConfidence(primaryPlayer: Player, playersToMerge: Player[]): {
  confidence: number;
  factors: string[];
} {
  const factors: string[] = [];
  let totalScore = 0;
  let maxPossibleScore = 0;
  
  for (const player of playersToMerge) {
    // Name similarity (40 points max)
    const name1 = `${primaryPlayer.firstName} ${primaryPlayer.lastName}`.toLowerCase();
    const name2 = `${player.firstName} ${player.lastName}`.toLowerCase();
    const nameSimilarity = name1 === name2 ? 40 : (name1.includes(name2) || name2.includes(name1) ? 25 : 0);
    totalScore += nameSimilarity;
    maxPossibleScore += 40;
    
    if (nameSimilarity > 0) {
      factors.push(`Name match: ${nameSimilarity}/40 points`);
    }
    
    // USBC match (30 points max)
    if (primaryPlayer.usbc && player.usbc) {
      if (primaryPlayer.usbc === player.usbc) {
        totalScore += 30;
        factors.push('USBC match: 30/30 points');
      }
      maxPossibleScore += 30;
    }
    
    // Average similarity (20 points max)
    if (primaryPlayer.average && player.average) {
      const avgDiff = Math.abs(primaryPlayer.average - player.average);
      const avgScore = Math.max(0, 20 - avgDiff);
      totalScore += avgScore;
      maxPossibleScore += 20;
      
      if (avgScore > 0) {
        factors.push(`Average similarity: ${avgScore}/20 points`);
      }
    }
    
    // Division match (10 points max)
    if (primaryPlayer.division && player.division && primaryPlayer.division === player.division) {
      totalScore += 10;
      factors.push('Division match: 10/10 points');
    }
    if (primaryPlayer.division && player.division) {
      maxPossibleScore += 10;
    }
  }
  
  const confidence = maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;
  
  return { confidence, factors };
}

/**
 * Generate audit trail for merge operation
 */
export function generateMergeAuditTrail(
  operation: MergeOperation,
  beforeState: ExtendedPlayer[],
  afterState: ExtendedPlayer
): {
  auditId: string;
  timestamp: string;
  operation: 'merge';
  details: {
    primaryPlayer: ExtendedPlayer;
    mergedPlayers: ExtendedPlayer[];
    resultPlayer: ExtendedPlayer;
    dataChanges: { field: string; before: PlayerFieldValue; after: PlayerFieldValue }[];
  };
  canUndo: boolean;
  undoInstructions?: string[];
} {
  const auditId = `merge-${operation.id}-${Date.now()}`;
  
  // Calculate data changes
  const dataChanges: { field: string; before: PlayerFieldValue; after: PlayerFieldValue }[] = [];
  const primaryBefore = beforeState[0];
  
  const fields = ['firstName', 'lastName', 'usbc', 'average', 'handicap', 'scratch', 'amountPaid', 'totalCost'];
  for (const field of fields) {
    const beforeValue = getPlayerFieldValue(primaryBefore, field);
    const afterValue = getPlayerFieldValue(afterState, field);
    
    if (beforeValue !== afterValue) {
      dataChanges.push({ field, before: beforeValue, after: afterValue });
    }
  }
  
  const undoInstructions = operation.canUndo ? [
    '1. Restore original player records from backup',
    '2. Restore bracket assignments and scores',
    '3. Restore payment records',
    '4. Update any affected tournament data'
  ] : undefined;
  
  return {
    auditId,
    timestamp: new Date().toISOString(),
    operation: 'merge',
    details: {
      primaryPlayer: primaryBefore,
      mergedPlayers: beforeState.slice(1),
      resultPlayer: afterState,
      dataChanges
    },
    canUndo: operation.canUndo,
    undoInstructions
  };
}

/**
 * Prepare merge operation for backend execution
 */
export function prepareMergeRequest(preview: MergePreview, resolutions: { field: string; value: PlayerFieldValue }[]): {
  primaryPlayerId: number;
  mergePlayerIds: number[];
  consolidatedData: ExtendedPlayer;
  conflictResolutions: { field: string; value: PlayerFieldValue; reason: string }[];
  affectedTables: string[];
} {
  return {
    primaryPlayerId: preview.primaryPlayer.id,
    mergePlayerIds: preview.playersToMerge.map(p => p.id),
    consolidatedData: preview.consolidatedData.finalPlayer,
    conflictResolutions: resolutions.map(r => ({
      ...r,
      reason: 'Manual resolution by user'
    })),
    affectedTables: ['bowler', 'score', 'tournament_payout', 'generated_bracket', 'bracket_match']
  };
}