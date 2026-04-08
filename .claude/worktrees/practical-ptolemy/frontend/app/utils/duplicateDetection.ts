// Comprehensive duplicate detection and fuzzy matching utilities

import { Player } from '../lib/types';

export interface DuplicateMatch {
  player: Player;
  matchScore: number;
  matchType: 'exact' | 'fuzzy' | 'usbc' | 'similar';
  matchReasons: string[];
}

export interface DuplicateGroup {
  id: string;
  primaryPlayer: Player;
  duplicates: DuplicateMatch[];
  confidence: 'high' | 'medium' | 'low';
  suggestedAction: 'merge' | 'review' | 'ignore';
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy name matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let firstStringIndex = 0; firstStringIndex <= str1.length; firstStringIndex++) matrix[0][firstStringIndex] = firstStringIndex;
  for (let secondStringIndex = 0; secondStringIndex <= str2.length; secondStringIndex++) matrix[secondStringIndex][0] = secondStringIndex;
  
  for (let secondStringIndex = 1; secondStringIndex <= str2.length; secondStringIndex++) {
    for (let firstStringIndex = 1; firstStringIndex <= str1.length; firstStringIndex++) {
      const substitutionCost = str1[firstStringIndex - 1] === str2[secondStringIndex - 1] ? 0 : 1;
      matrix[secondStringIndex][firstStringIndex] = Math.min(
        matrix[secondStringIndex][firstStringIndex - 1] + 1,     // deletion
        matrix[secondStringIndex - 1][firstStringIndex] + 1,     // insertion
        matrix[secondStringIndex - 1][firstStringIndex - 1] + substitutionCost   // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Calculate similarity score between two strings (0-1, where 1 is identical)
 */
function stringSimilarity(str1: string, str2: string): number {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;
  
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return (maxLength - distance) / maxLength;
}

/**
 * Normalize name for comparison (remove extra spaces, normalize case, handle common variations)
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, '') // Remove suffixes
    .trim();
}

/**
 * Extract name variations and nicknames
 */
function getNameVariations(firstName: string): string[] {
  const variations = [firstName.toLowerCase()];
  
  // Common nickname mappings
  const nicknames: Record<string, string[]> = {
    'alexander': ['alex', 'al', 'xander'],
    'anthony': ['tony', 'ant'],
    'benjamin': ['ben', 'benny'],
    'christopher': ['chris', 'topher'],
    'daniel': ['dan', 'danny'],
    'david': ['dave', 'davey'],
    'edward': ['ed', 'eddie', 'ted'],
    'elizabeth': ['liz', 'beth', 'betty', 'eliza'],
    'james': ['jim', 'jimmy', 'jamie'],
    'jennifer': ['jen', 'jenny', 'jenn'],
    'jonathan': ['jon', 'johnny'],
    'joseph': ['joe', 'joey'],
    'katherine': ['kate', 'katie', 'kathy', 'kat'],
    'margaret': ['maggie', 'meg', 'peggy'],
    'matthew': ['matt', 'matty'],
    'michael': ['mike', 'mick', 'mickey'],
    'nicholas': ['nick', 'nicky'],
    'patricia': ['pat', 'patty', 'tricia'],
    'richard': ['rick', 'ricky', 'dick'],
    'robert': ['rob', 'bob', 'bobby'],
    'samuel': ['sam', 'sammy'],
    'stephanie': ['steph', 'steffi'],
    'thomas': ['tom', 'tommy'],
    'timothy': ['tim', 'timmy'],
    'william': ['will', 'bill', 'billy', 'liam']
  };
  
  const normalizedName = normalizeName(firstName);
  
  // Add direct nicknames
  if (nicknames[normalizedName]) {
    variations.push(...nicknames[normalizedName]);
  }
  
  // Check if current name is a nickname
  for (const [fullName, nicks] of Object.entries(nicknames)) {
    if (nicks.includes(normalizedName)) {
      variations.push(fullName, ...nicks);
    }
  }
  
  return [...new Set(variations)];
}

/**
 * Check if two players are exact duplicates
 */
export function isExactDuplicate(player1: Player, player2: Player): boolean {
  if (player1.id === player2.id) return false;
  
  const name1 = normalizeName(`${player1.firstName} ${player1.lastName}`);
  const name2 = normalizeName(`${player2.firstName} ${player2.lastName}`);
  
  return name1 === name2;
}

/**
 * Check if two players are fuzzy matches
 */
export function isFuzzyMatch(player1: Player, player2: Player, threshold: number = 0.85): DuplicateMatch | null {
  if (player1.id === player2.id) return null;
  
  const matchReasons: string[] = [];
  let totalScore = 0;
  let scoringFactors = 0;
  
  // Name similarity
  const name1 = normalizeName(`${player1.firstName} ${player1.lastName}`);
  const name2 = normalizeName(`${player2.firstName} ${player2.lastName}`);
  const nameSimilarity = stringSimilarity(name1, name2);
  
  if (nameSimilarity > 0.7) {
    totalScore += nameSimilarity * 0.6; // 60% weight for name
    scoringFactors += 0.6;
    matchReasons.push(`Name similarity: ${(nameSimilarity * 100).toFixed(1)}%`);
  }
  
  // First name variations
  const firstName1Variations = getNameVariations(player1.firstName);
  const firstName2Variations = getNameVariations(player2.firstName);
  const hasNameVariation = firstName1Variations.some(v1 => 
    firstName2Variations.some(v2 => v1 === v2)
  );
  
  if (hasNameVariation && normalizeName(player1.lastName) === normalizeName(player2.lastName)) {
    totalScore += 0.9 * 0.3; // 30% weight for name variation
    scoringFactors += 0.3;
    matchReasons.push('Same last name with name variation');
  }
  
  // USBC number check
  if (player1.usbc && player2.usbc) {
    if (player1.usbc === player2.usbc) {
      totalScore += 1.0 * 0.4; // 40% weight for USBC match
      scoringFactors += 0.4;
      matchReasons.push('Identical USBC number');
    }
  }
  
  // Average similarity (within reasonable range)
  if (player1.average && player2.average) {
    const avgDiff = Math.abs(player1.average - player2.average);
    if (avgDiff <= 10) { // Within 10 pins
      const avgSimilarity = Math.max(0, (10 - avgDiff) / 10);
      totalScore += avgSimilarity * 0.1; // 10% weight for average
      scoringFactors += 0.1;
      matchReasons.push(`Similar average (${avgDiff} pins difference)`);
    }
  }
  
  // Normalize score
  const finalScore = scoringFactors > 0 ? totalScore / scoringFactors : 0;
  
  if (finalScore >= threshold) {
    let matchType: 'exact' | 'fuzzy' | 'usbc' | 'similar' = 'fuzzy';
    
    if (nameSimilarity === 1.0) matchType = 'exact';
    else if (player1.usbc && player2.usbc && player1.usbc === player2.usbc) matchType = 'usbc';
    else if (hasNameVariation) matchType = 'similar';
    
    return {
      player: player2,
      matchScore: finalScore,
      matchType,
      matchReasons
    };
  }
  
  return null;
}

/**
 * Find all potential duplicates for a single player
 */
export function findDuplicatesForPlayer(
  targetPlayer: Player, 
  allPlayers: Player[], 
  threshold: number = 0.85
): DuplicateMatch[] {
  const duplicates: DuplicateMatch[] = [];
  
  for (const player of allPlayers) {
    if (player.id === targetPlayer.id) continue;
    
    // Check for exact duplicate
    if (isExactDuplicate(targetPlayer, player)) {
      duplicates.push({
        player,
        matchScore: 1.0,
        matchType: 'exact',
        matchReasons: ['Identical name']
      });
      continue;
    }
    
    // Check for fuzzy match
    const fuzzyMatch = isFuzzyMatch(targetPlayer, player, threshold);
    if (fuzzyMatch) {
      duplicates.push(fuzzyMatch);
    }
  }
  
  return duplicates.sort((firstItem, secondItem) => secondItem.matchScore - firstItem.matchScore);
}

/**
 * Scan entire player database for duplicate groups
 */
export function scanForDuplicateGroups(
  players: Player[], 
  threshold: number = 0.85
): DuplicateGroup[] {
  const processedIds = new Set<number>();
  const duplicateGroups: DuplicateGroup[] = [];
  
  for (const player of players) {
    if (processedIds.has(player.id)) continue;
    
    const duplicates = findDuplicatesForPlayer(player, players, threshold);
    
    if (duplicates.length > 0) {
      // Mark all players in this group as processed
      processedIds.add(player.id);
      duplicates.forEach(dup => processedIds.add(dup.player.id));
      
      // Determine confidence level
      const highConfidenceCount = duplicates.filter(duplicate => duplicate.matchScore >= 0.95).length;
      const mediumConfidenceCount = duplicates.filter(duplicate => duplicate.matchScore >= 0.85 && duplicate.matchScore < 0.95).length;
      
      let confidence: 'high' | 'medium' | 'low' = 'low';
      let suggestedAction: 'merge' | 'review' | 'ignore' = 'ignore';
      
      if (highConfidenceCount > 0) {
        confidence = 'high';
        suggestedAction = 'merge';
      } else if (mediumConfidenceCount > 0) {
        confidence = 'medium';
        suggestedAction = 'review';
      }
      
      duplicateGroups.push({
        id: `group-${player.id}`,
        primaryPlayer: player,
        duplicates,
        confidence,
        suggestedAction
      });
    }
  }
  
  return duplicateGroups.sort((firstItem, secondItem) => {
    // Sort by confidence and then by match score
    const confidenceOrder = { high: 3, medium: 2, low: 1 };
    const confDiff = confidenceOrder[secondItem.confidence] - confidenceOrder[firstItem.confidence];
    if (confDiff !== 0) return confDiff;
    
    const maxScoreA = Math.max(...firstItem.duplicates.map(duplicate => duplicate.matchScore));
    const maxScoreB = Math.max(...secondItem.duplicates.map(duplicate => duplicate.matchScore));
    return maxScoreB - maxScoreA;
  });
}

/**
 * Validate USBC number format and check for duplicates
 */
export function validateUSBC(usbc: string, players: Player[], excludeId?: number): {
  isValid: boolean;
  error?: string;
  suggestions?: string[];
} {
  if (!usbc) return { isValid: true };
  
  // Format validation
  if (!/^\d+$/.test(usbc)) {
    return { isValid: false, error: 'USBC must contain only numbers' };
  }
  
  if (usbc.length !== 8) {
    return { isValid: false, error: 'USBC must be exactly 8 digits' };
  }
  
  // Duplicate check
  const duplicate = players.find(p => p.id !== excludeId && p.usbc === usbc);
  if (duplicate) {
    return {
      isValid: false,
      error: 'USBC number already in use',
      suggestions: [`Already used by: ${duplicate.firstName} ${duplicate.lastName}`]
    };
  }
  
  return { isValid: true };
}

/**
 * Get smart suggestions when adding a new player
 */
export function getSmartSuggestions(
  firstName: string,
  lastName: string,
  usbc: string | undefined,
  players: Player[]
): {
  warnings: string[];
  suggestions: string[];
  potentialDuplicates: DuplicateMatch[];
} {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  
  // Create temporary player object for comparison
  const tempPlayer: Player = {
    id: -1, // Temporary ID
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    usbc,
    average: 0, // Required field
    handicap: 0 // Required field
  };
  
  // Find potential duplicates
  const potentialDuplicates = findDuplicatesForPlayer(tempPlayer, players, 0.7); // Lower threshold for suggestions
  
  if (potentialDuplicates.length > 0) {
    const exactMatches = potentialDuplicates.filter(duplicate => duplicate.matchType === 'exact');
    const highMatches = potentialDuplicates.filter(duplicate => duplicate.matchScore >= 0.85);
    const mediumMatches = potentialDuplicates.filter(duplicate => duplicate.matchScore >= 0.7 && duplicate.matchScore < 0.85);
    
    if (exactMatches.length > 0) {
      warnings.push('Exact name match found - this player may already exist');
      suggestions.push('Review existing players before adding');
    } else if (highMatches.length > 0) {
      warnings.push('Very similar player found - check for duplicates');
      suggestions.push('Consider if this is the same person with a slight name variation');
    } else if (mediumMatches.length > 0) {
      suggestions.push('Similar players found - you may want to verify this is a new player');
    }
  }
  
  // USBC validation
  if (usbc) {
    const usbcValidation = validateUSBC(usbc, players);
    if (!usbcValidation.isValid) {
      warnings.push(`USBC Issue: ${usbcValidation.error}`);
      if (usbcValidation.suggestions) {
        suggestions.push(...usbcValidation.suggestions);
      }
    }
  }
  
  return {
    warnings,
    suggestions,
    potentialDuplicates
  };
}

