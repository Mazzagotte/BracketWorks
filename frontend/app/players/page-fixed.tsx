'use client'

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { API } from '../lib/api'
import { usePageHeader } from '../lib/header-context'
import { MobileTable } from '../../components/MobileTable'
import { useAuth } from '../lib/auth-context'
import { logger, devLog } from '../lib/logger'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { 
  PageContainer, 
  ContentWrapper, 
  Card, 
  Grid, 
  StatCard,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  FormField,
  Input,
  Select
} from '../components/UI'
import { typography, colors, spacing, stylePresets } from '../lib/design-system'
import styles from './entries.module.css'
import { Spinner, LoadingButton, LoadingState } from '../components/LoadingComponents'
import { useToast } from '../components/Toast'
import { ErrorMessage } from '../components/ErrorHandling'
import { usePagination, VirtualizedList, Pagination } from '../components/Performance'
import { AccessibleInput } from '../components/Accessibility'
import { useAutoSave } from '../components/DataManagement'
import EnhancedButton from '../components/EnhancedButton'
import SmartSuggestions, { USBCValidationIndicator } from '../components/SmartSuggestions'

type Player = { id: number, usbc?: string, firstName: string, lastName: string, average: number, handicap: number, scratch: number, lane: string, division: string, totalCost: number, amountPaid: number, squad?: { id: number, date: string, time: string } }

// Custom hook for client-side storage
function useClientStorage() {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const getItem = useCallback((key: string) => {
    if (!isClient) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [isClient]);
  
  const setItem = useCallback((key: string, value: string) => {
    if (!isClient) return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // Silent fail
    }
  }, [isClient]);
  
  return { getItem, setItem, isClient };
}

function EntriesPageContent() {
  const { getItem, setItem, isClient } = useClientStorage();
  
  // Early return for SSR - only render on client
  if (!isClient) {
    return (
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center',
        minHeight: '50vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>
          <div style={{ marginBottom: '1rem', fontSize: '2rem' }}>🎳</div>
          <div>Loading player management...</div>
        </div>
      </div>
    );
  }

  return <EntriesPageInner getItem={getItem} setItem={setItem} />;
}

function EntriesPageInner({ getItem, setItem }: { getItem: (key: string) => string | null, setItem: (key: string, value: string) => void }) {
  // ALL HOOKS MUST BE CALLED FIRST - BEFORE ANY CONDITIONAL LOGIC
  
  // Track which cell is being edited
  const [editing, setEditing] = useState<{row: number, col: string} | null>(null);
  const [editValue, setEditValue] = useState<string | number>('');
  
  // Prevent duplicate saves with a Set of currently saving operations
  const [currentlySaving, setCurrentlySaving] = useState<Set<string>>(new Set());
  
  // Prevent immediate blur after starting edit
  const [justStartedEditing, setJustStartedEditing] = useState(false);

  // Sorting state
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDivision, setFilterDivision] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [searchUSBC, setSearchUSBC] = useState('');
  const [avgMin, setAvgMin] = useState<number | ''>('');
  const [avgMax, setAvgMax] = useState<number | ''>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Enhanced filtering state
  const [savedFilters, setSavedFilters] = useState<{[key: string]: any}>({});
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecentSearches, setShowRecentSearches] = useState(false);

  // New enhanced filter states
  const [activeFilters, setActiveFilters] = useState<Array<{key: string, label: string, value: string}>>([]);
  const [searchHighlight, setSearchHighlight] = useState('');
  const [liveSearchResults, setLiveSearchResults] = useState<Player[]>([]);
  const [filterStats, setFilterStats] = useState({
    total: 0,
    filtered: 0,
    unpaid: 0,
    partiallyPaid: 0,
    fullyPaid: 0
  });

  // Auto-complete state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [currentField, setCurrentField] = useState<'firstName' | 'lastName' | null>(null);

  // Validation and feedback state
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [savingStates, setSavingStates] = useState<{[key: string]: boolean}>({});
  const [isLoading, setIsLoading] = useState(false);

  // Smart editing state
  const [selectedCell, setSelectedCell] = useState<{row: number, col: string} | null>(null);
  const [lastClickTime, setLastClickTime] = useState<number>(0);
  
  // Mobile detection state
  const [isMobile, setIsMobile] = useState(false);
  
  // Safe auth handling with proper error catching
  const auth = useAuth();
  let authError: string | null = null;
  
  // Check authentication status
  const isAuthenticated = auth && auth.isAuthenticated;
  const { token, user } = auth || {};

  // Helper to handle cell clicks (single vs double-click)
  function handleCellClick(rowIdx: number, col: string, value: string | number, event: React.MouseEvent) {
    const now = Date.now();
    const timeSinceLastClick = now - lastClickTime;
    
    setSelectedCell({row: rowIdx, col});
    setLastClickTime(now);
    
    // Double-click detection (within 300ms)
    if (timeSinceLastClick < 300 && editing?.row === rowIdx && editing?.col === col) {
      return; // Already editing, ignore
    } else if (timeSinceLastClick < 300) {
      startEdit(rowIdx, col, value);
    }
  }

  // Helper to start editing a cell
  function startEdit(rowIdx: number, col: string, value: string | number) {
    // Don't restart editing if we're already editing this exact cell
    if (editing?.row === rowIdx && editing?.col === col) {
      devLog('Already editing this cell, ignoring startEdit');
      return;
    }
    
    devLog('startEdit called', { rowIdx, col, value });
    setEditing({row: rowIdx, col});
    setEditValue(value);
    setJustStartedEditing(true);
    devLog('editValue set to:', value);
    
    // Clear the flag after a short delay to allow input to focus properly
    setTimeout(() => {
      setJustStartedEditing(false);
    }, 100);
  }

  // Tab navigation helper
  const handleTabNavigation = (currentRow: number, currentCol: string, direction: 'next' | 'prev') => {
    const editableFields = ['usbc', 'firstName', 'lastName', 'average', 'handicap', 'scratch', 'lane', 'division'];
    const currentIndex = editableFields.indexOf(currentCol);
    
    let nextRow = currentRow;
    let nextCol = currentCol;
    
    if (direction === 'next') {
      if (currentIndex < editableFields.length - 1) {
        nextCol = editableFields[currentIndex + 1];
      } else if (currentRow < filteredAndSortedPlayers.length - 1) {
        nextRow = currentRow + 1;
        nextCol = editableFields[0];
      }
    } else {
      if (currentIndex > 0) {
        nextCol = editableFields[currentIndex - 1];
      } else if (currentRow > 0) {
        nextRow = currentRow - 1;
        nextCol = editableFields[editableFields.length - 1];
      }
    }
    
    if (nextRow !== currentRow || nextCol !== currentCol) {
      const nextPlayer = filteredAndSortedPlayers[nextRow];
      if (nextPlayer) {
        startEdit(nextRow, nextCol, (nextPlayer as any)[nextCol]);
      }
    }
  };

  // Helper to save cell edit
  async function saveEdit(rowIdx: number, col: string) {
    // Prevent save if we just started editing (focus/blur timing issue)
    if (justStartedEditing) {
      devLog('Ignoring save - just started editing');
      return;
    }
    
    const player = filteredAndSortedPlayers[rowIdx];
    const saveKey = `${player.id}-${col}`;
    
    logger.debug('saveEdit called', {
      rowIdx,
      col,
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      editValue,
      currentValue: (player as any)[col]
    });
    
    // Prevent duplicate saves with more robust checking
    if (savingStates[saveKey] || currentlySaving.has(saveKey)) {
      logger.warn('Save already in progress', { saveKey, savingState: savingStates[saveKey], currentlySaving: currentlySaving.has(saveKey) });
      return;
    }
    
    // Check if value actually changed
    const currentValue = (player as any)[col];
    const newValue = col === 'average' || col === 'handicap' || col === 'scratch' ? Number(editValue) : editValue;
    
    logger.debug('Value comparison', {
      field: col,
      currentValue,
      newValue,
      editValue,
      areEqual: currentValue === newValue
    });
    
    if (currentValue === newValue) {
      devLog('No change detected', { saveKey, currentValue, newValue });
      setEditing(null);
      setEditValue('');
      return;
    }
    
    // Add to currently saving set
    setCurrentlySaving(prev => new Set([...prev, saveKey]));
    
    // Validate the input
    const validationError = validateField(col, editValue);
    if (validationError) {
      setValidationErrors(prev => ({...prev, [saveKey]: validationError}));
      
      // Clean up saving state on validation error
      setCurrentlySaving(prev => {
        const newSet = new Set(prev);
        newSet.delete(saveKey);
        return newSet;
      });
      
      return;
    }

    // Check for duplicates on name fields
    if (col === 'firstName' || col === 'lastName') {
      const firstName = col === 'firstName' ? editValue as string : player.firstName;
      const lastName = col === 'lastName' ? editValue as string : player.lastName;
      const duplicateError = checkForDuplicates(firstName, lastName, player.id);
      if (duplicateError) {
        setValidationErrors(prev => ({...prev, [saveKey]: duplicateError}));
        
        // Clean up saving state on duplicate error
        setCurrentlySaving(prev => {
          const newSet = new Set(prev);
          newSet.delete(saveKey);
          return newSet;
        });
        
        return;
      }
    }

    // Clear validation errors for this field
    setValidationErrors(prev => {
      const newErrors = {...prev};
      delete newErrors[saveKey];
      return newErrors;
    });

    // Set saving state
    setSavingStates(prev => ({...prev, [saveKey]: true}));

    // Save to backend first - then update local state with server response
    if (token) {
      try {
        // Build updated bowler object with all fields
        const updatedBowler: any = {};
        
        // Handle name fields
        if (col === 'firstName' || col === 'lastName') {
          updatedBowler.name = col === 'firstName' ? `${editValue} ${player.lastName}` : `${player.firstName} ${editValue}`;
        }
        
        // Handle numeric fields
        if (col === 'average') updatedBowler.average = Number(editValue);
        if (col === 'handicap') updatedBowler.handicap = Number(editValue);
        if (col === 'scratch') updatedBowler.scratch = Number(editValue);
        
        // Handle string fields
        if (col === 'usbc') updatedBowler.usbc = editValue as string;
        if (col === 'lane') updatedBowler.lane = editValue as string;
        if (col === 'division') updatedBowler.division = editValue as string;
        
        logger.debug('Sending PATCH request for bowler', { playerId: player.id, updatedData: updatedBowler });
        const response = await fetch(API(`/api/v1/bowlers/${player.id}`), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(updatedBowler)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = 'Failed to save changes';
          
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.detail || errorData.message || errorMessage;
          } catch {
            // If parsing fails, use the raw error text if it's short enough
            if (errorText.length < 100) {
              errorMessage = errorText;
            }
          }
          
          logger.error('Failed to save bowler', { 
            playerId: player.id, 
            status: response.status, 
            error: errorText 
          });
          
          setValidationErrors(prev => ({...prev, [saveKey]: errorMessage}));
          throw new Error(errorMessage);
        }

        // Get the updated bowler from the server response
        const serverBowler = await response.json();
        logger.info('Successfully saved bowler', { playerId: player.id, serverResponse: serverBowler });

        // Update local state with server data to ensure consistency
        setPlayers(prev => {
          return prev.map(p => {
            if (p.id !== player.id) return p;
            
            // Parse the name from server response
            const nameParts = serverBowler.name ? serverBowler.name.split(' ') : [p.firstName, p.lastName];
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';
            
            const updated = {
              ...p,
              firstName,
              lastName,
              average: serverBowler.average ?? p.average,
              handicap: serverBowler.handicap ?? p.handicap,
              scratch: serverBowler.scratch ?? p.scratch,
              usbc: serverBowler.usbc ?? p.usbc,
              lane: serverBowler.lane ?? p.lane,
              division: serverBowler.division ?? p.division,
              totalCost: serverBowler.total_cost ?? p.totalCost,
              amountPaid: serverBowler.amount_paid ?? p.amountPaid
            };
            
            // Recalculate totalCost if needed based on bracket settings
            if (col === 'handicap' || col === 'scratch') {
              // You might want to recalculate cost here based on your business logic
              updated.totalCost = (updated.handicap + updated.scratch) * costPerBracket;
            }
            
            return updated;
          });
        });

        // Show success toast
        addToast({
          message: `${player.firstName} ${player.lastName} updated successfully`,
          type: 'success',
          duration: 3000
        });
        
      } catch (error) {
        console.error('Error saving bowler:', error);
        setValidationErrors(prev => ({...prev, [saveKey]: 'Network error occurred'}));
        
        // Show error toast
        addToast({
          message: `Failed to save changes for ${player.firstName} ${player.lastName}`,
          type: 'error',
          duration: 5000
        });
        
        // Clean up saving state on error
        setCurrentlySaving(prev => {
          const newSet = new Set(prev);
          newSet.delete(saveKey);
          return newSet;
        });
        setSavingStates(prev => {
          const newStates = {...prev};
          delete newStates[saveKey];
          return newStates;
        });
        
        return; // Don't update local state if there was an error
      }
    } else {
      // If no token, just update local state (fallback)
      setPlayers(prev => prev.map((p) => {
        if (p.id !== player.id) return p;
        let updated = { ...p, [col]: col === 'average' || col === 'handicap' || col === 'scratch' ? Number(editValue) : editValue };
        // Recalculate totalCost if HDCP or Scratch changed
        if (col === 'handicap' || col === 'scratch') {
          updated.totalCost = (updated.handicap + updated.scratch) * costPerBracket;
        }
        return updated;
      }));
    }

    // Clear saving state
    setSavingStates(prev => {
      const newStates = {...prev};
      delete newStates[saveKey];
      return newStates;
    });
    
    // Remove from currently saving set
    setCurrentlySaving(prev => {
      const newSet = new Set(prev);
      newSet.delete(saveKey);
      return newSet;
    });

    setEditing(null);
    setEditValue('');
    
    logger.debug('Save completed', { saveKey });
  }

  // Get cost per bracket from bracket settings
  const [costPerBracket, setCostPerBracket] = useState(0);
  
  // Fetch cost per bracket from backend
  useEffect(() => {
    const lastTournamentId = getItem('lastTournamentId');
    if (lastTournamentId && token) {
      fetch(API(`/api/v1/bracket-settings/${lastTournamentId}`), {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.cost_per_bracket) {
          setCostPerBracket(data.cost_per_bracket);
        }
      })
      .catch(err => logger.error('Error fetching bracket settings', { error: err?.message }));
    }
  }, [token, getItem]);

  // Mobile detection - CLIENT SIDE ONLY
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window !== 'undefined') {
        const width = window.innerWidth;
        setIsMobile(width <= 768);
      }
    };
    
    // Only run on client side
    if (typeof window !== 'undefined') {
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }
  }, []);

  // Helper to cancel edit
  function cancelEdit() {
    setEditing(null);
    setEditValue('');
  }

  // Enhanced filter helper functions
  const updateActiveFilters = useCallback(() => {
    const filters = [];
    if (searchTerm) filters.push({ key: 'search', value: searchTerm, label: `Search: "${searchTerm}"` });
    if (filterDivision) filters.push({ key: 'division', value: filterDivision, label: `Division: ${filterDivision}` });
    if (filterPayment) filters.push({ key: 'payment', value: filterPayment, label: `Payment: ${filterPayment}` });
    if (avgMin !== '') filters.push({ key: 'avgMin', value: String(avgMin), label: `Avg ≥ ${avgMin}` });
    if (avgMax !== '') filters.push({ key: 'avgMax', value: String(avgMax), label: `Avg ≤ ${avgMax}` });
    setActiveFilters(filters);
  }, [searchTerm, filterDivision, filterPayment, avgMin, avgMax]);

  const highlightSearchResults = (text: string, highlight: string): JSX.Element => {
    if (!highlight || !text) return <>{text}</>;
    const regex = new RegExp(`(${highlight})`, 'gi');
    const parts = text.split(regex);
    
    return (
      <>
        {parts.map((part, index) => 
          regex.test(part) ? (
            <mark key={index} style={{
              backgroundColor: '#fef3c7',
              color: '#d97706',
              padding: '1px 2px',
              borderRadius: '3px',
              fontWeight: '600'
            }}>
              {part}
            </mark>
          ) : (
            <span key={index}>{part}</span>
          )
        )}
      </>
    );
  };

  const removeFilter = (filterKey: string) => {
    switch (filterKey) {
      case 'search':
        setSearchTerm('');
        setSearchHighlight('');
        break;
      case 'division':
        setFilterDivision('');
        break;
      case 'payment':
        setFilterPayment('');
        break;
      case 'avgMin':
        setAvgMin('');
        break;
      case 'avgMax':
        setAvgMax('');
        break;
    }
  };

  // Validation functions
  const validateUSBC = (usbc: string): string | null => {
    if (!usbc) return null;
    if (!/^\d{8}$/.test(usbc)) return 'USBC number must be 8 digits';
    return null;
  };

  const validateAverage = (average: number): string | null => {
    if (average < 0 || average > 300) return 'Average must be between 0-300';
    return null;
  };

  const validateHandicap = (handicap: number): string | null => {
    if (handicap < 0 || handicap > 120) return 'Handicap must be between 0-120';
    return null;
  };

  const validateScratch = (scratch: number): string | null => {
    if (scratch < 0 || scratch > 20) return 'Scratch must be between 0-20';
    return null;
  };

  const validateName = (name: string): string | null => {
    if (!name.trim()) return 'Name is required';
    if (name.trim().length < 2) return 'Name must be at least 2 characters';
    return null;
  };

  const checkForDuplicates = (firstName: string, lastName: string, excludeId?: number): string | null => {
    const fullName = `${firstName.trim()} ${lastName.trim()}`.toLowerCase();
    const duplicate = players.find(p => 
      p.id !== excludeId && 
      `${p.firstName} ${p.lastName}`.toLowerCase() === fullName
    );
    return duplicate ? 'Player with this name already exists' : null;
  };

  const checkUSBCFormat = (usbc: string): string | null => {
    if (!usbc) return null;
    if (!/^\d+$/.test(usbc)) return 'USBC must contain only numbers';
    if (usbc.length !== 8) return 'USBC must be exactly 8 digits';
    
    // Check for duplicate USBC numbers
    const duplicate = players.find(p => p.usbc === usbc);
    if (duplicate) return 'USBC number already in use';
    
    return null;
  };

  const validateField = (field: string, value: any, playerId?: number): string | null => {
    switch (field) {
      case 'usbc': return validateUSBC(value);
      case 'firstName': return validateName(value);
      case 'lastName': return validateName(value);
      case 'average': return validateAverage(Number(value));
      case 'handicap': return validateHandicap(Number(value));
      case 'scratch': return validateScratch(Number(value));
      default: return null;
    }
  };

  // Auto-complete functions - CLIENT SIDE ONLY
  const getSuggestions = (value: string, field: 'firstName' | 'lastName') => {
    if (value.length < 2) return [];
    
    const existingNames = players.map(p => field === 'firstName' ? p.firstName : p.lastName);
    
    // Only access stored names on client side
    let storedNames = { firstNames: [], lastNames: [] };
    const storedNamesStr = getItem('playerNames');
    if (storedNamesStr) {
      try {
        storedNames = JSON.parse(storedNamesStr);
      } catch {
        // Silent fail
      }
    }
    
    const allNames = [...new Set([...existingNames, ...(field === 'firstName' ? storedNames.firstNames : storedNames.lastNames)])];
    
    return allNames.filter(name => 
      name.toLowerCase().startsWith(value.toLowerCase())
    ).slice(0, 5);
  };

  const handleInputChange = (value: string, field: 'firstName' | 'lastName') => {
    if (field === 'firstName') {
      setFirstName(value);
    } else {
      setLastName(value);
    }
    
    const newSuggestions = getSuggestions(value, field);
    setSuggestions(newSuggestions);
    setShowSuggestions(newSuggestions.length > 0);
    setCurrentField(field);
    setActiveSuggestion(-1);
  };

  const selectSuggestion = (suggestion: string) => {
    if (currentField === 'firstName') {
      setFirstName(suggestion);
    } else if (currentField === 'lastName') {
      setLastName(suggestion);
    }
    setShowSuggestions(false);
    setSuggestions([]);
    setActiveSuggestion(-1);
  };

  // Sorting function
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('asc');
    }
  };

  const [players, setPlayers] = useState<Player[]>([])

  // Filter stats calculation function
  const calculateFilterStats = useCallback((filteredPlayers: any[]) => {
    const stats = {
      total: players.length,
      filtered: filteredPlayers.length,
      unpaid: filteredPlayers.filter(p => p.payment_status === 'Unpaid').length,
      partiallyPaid: filteredPlayers.filter(p => p.payment_status === 'Partial').length,
      fullyPaid: filteredPlayers.filter(p => p.payment_status === 'Paid').length
    };
    setFilterStats(stats);
    return stats;
  }, [players.length]);

  // Enhanced UX hooks
  const { addToast } = useToast()
  const { currentPage, totalPages, paginatedItems, goToPage, changePageSize } = usePagination({ 
    items: players,
    itemsPerPage: 25
  })
  
  // Auto-save functionality - CLIENT SIDE ONLY
  const { saving: autoSaving, saveNow } = useAutoSave({
    data: { searchTerm, filterDivision, filterPayment, avgMin, avgMax },
    saveFunction: async (data) => {
      setItem('players-filters', JSON.stringify(data));
    },
    delay: 1000
  })

  const clearAllFilters = () => {
    setSearchTerm('');
    setFilterDivision('');
    setFilterPayment('');
    setSearchUSBC('');
    setAvgMin('');
    setAvgMax('');
    setActiveFilters([]);
    setSearchHighlight('');
    setLiveSearchResults([]);
  };

  // Enhanced search with recent searches - CLIENT SIDE ONLY
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setSearchHighlight(value); // Set highlight for live search
    if (value && !recentSearches.includes(value)) {
      const newRecentSearches = [value, ...recentSearches.slice(0, 4)];
      setRecentSearches(newRecentSearches);
      
      // Save to storage on client side
      setItem('recentSearches', JSON.stringify(newRecentSearches));
    }
  };

  // Load recent searches on mount - CLIENT SIDE ONLY
  useEffect(() => {
    const stored = getItem('recentSearches');
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored));
      } catch {
        // Silent fail
      }
    }
  }, [getItem]);

  // Update active filters when any filter changes
  useEffect(() => {
    updateActiveFilters();
  }, [updateActiveFilters]);

  // Filter and sort players array
  const filteredPlayers = useMemo(() => {
    const filtered = [...players]
      .filter(player => {
        // Search filter
        const nameMatch = searchTerm === '' || 
          `${player.firstName} ${player.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Division filter
        const divisionMatch = filterDivision === '' || player.division === filterDivision;
        
        // Payment filter
        const paymentMatch = filterPayment === '' || 
          (filterPayment === 'paid' && player.amountPaid >= player.totalCost) ||
          (filterPayment === 'unpaid' && player.amountPaid < player.totalCost);

        // USBC filter
        const usbcMatch = searchUSBC === '' || 
          (player.usbc && player.usbc.includes(searchUSBC));

        // Average range filter
        const avgMinMatch = avgMin === '' || player.average >= avgMin;
        const avgMaxMatch = avgMax === '' || player.average <= avgMax;
        
        return nameMatch && divisionMatch && paymentMatch && usbcMatch && avgMinMatch && avgMaxMatch;
      })
      .sort((a, b) => {
        if (!sortBy) return 0;
        
        let aVal = a[sortBy as keyof Player];
        let bVal = b[sortBy as keyof Player];
        
        // Handle different data types and null/undefined values
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sortDirection === 'asc' ? -1 : 1;
        if (bVal == null) return sortDirection === 'asc' ? 1 : -1;
        
        // Define numeric columns that should be sorted numerically
        const numericColumns = ['average', 'handicap', 'scratch', 'lane', 'totalCost', 'amountPaid', 'id'];
        
        if (numericColumns.includes(sortBy)) {
          // Numeric sorting
          const aNum = Number(aVal);
          const bNum = Number(bVal);
          
          // Handle NaN values (treat as 0 for sorting)
          const aNumSafe = isNaN(aNum) ? 0 : aNum;
          const bNumSafe = isNaN(bNum) ? 0 : bNum;
          
          return sortDirection === 'asc' ? aNumSafe - bNumSafe : bNumSafe - aNumSafe;
        } else {
          // String sorting (for names, division, lane, etc.)
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
          }
          
          if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
          return 0;
        }
      });
    
    // Calculate filter stats whenever filtered data changes
    calculateFilterStats(filtered);
    
    return filtered;
  }, [players, searchTerm, filterDivision, filterPayment, searchUSBC, avgMin, avgMax, sortBy, sortDirection, calculateFilterStats]);

  // Apply pagination
  const paginationHook = usePagination({
    items: filteredPlayers,
    itemsPerPage: 25
  });

  // For backward compatibility, keep the same variable name
  const filteredAndSortedPlayers = paginationHook.paginatedItems;
  
  // Currency formatting function
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };
  
  // REMOVED: Dynamic style injection that was causing SSR issues
  // The hover styles should be moved to CSS files or styled-components
  
  const [usbc, setUsbc] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [avg, setAvg] = useState<number | ''>('')
  const [handicap, setHandicap] = useState<number | ''>('')
  const [scratch, setScratch] = useState<number | ''>('')
  const [lane, setLane] = useState('')
  const [division, setDivision] = useState('Open')

  // Tournament and squad info
  const [tournament, setTournament] = useState<any>(null);
  const [squads, setSquads] = useState<any[]>([]);
  const [selectedSquad, setSelectedSquad] = useState<any | null>(null);

  // Function to fetch players based on current tournament and squad
  const fetchPlayers = useCallback(async () => {
    const lastTournamentId = getItem('lastTournamentId');
    const token = getItem('token');
    
    if (!lastTournamentId || !token) return;
    
    setIsLoading(true);
    
    try {
      const bowlersUrl = selectedSquad 
        ? `/api/v1/bowlers/?tournament_id=${lastTournamentId}&squad_id=${selectedSquad.id}`
        : `/api/v1/bowlers/?tournament_id=${lastTournamentId}`;
      
      const response = await fetch(API(bowlersUrl), {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = response.ok ? await response.json() : [];
      
      // Transform bowlers data to match our player structure
      const transformedData = (data || []).map((bowler: any) => {
        const nameParts = bowler.name.split(' ');
        // Find squad information if squad_id exists
        const squad = bowler.squad_id ? squads.find(s => s.id === bowler.squad_id) : null;
        return {
          id: bowler.id,
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          average: bowler.average || 0,
          handicap: bowler.handicap || 0,
          scratch: bowler.scratch || 0,
          usbc: bowler.usbc || '',
          lane: bowler.lane || '',
          division: bowler.division || 'Open',
          totalCost: bowler.total_cost || 0,
          amountPaid: bowler.amount_paid || 0,
          squad: squad ? { id: squad.id, date: squad.date, time: squad.time } : undefined
        };
      });
      
      setPlayers(transformedData);
    } catch (err) {
      console.error('Error fetching bowlers:', err);
      setPlayers([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSquad, squads, getItem]);

  // Set up page header with player management actions
  const playerHeaderActions = useMemo(() => (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
      <EnhancedButton
        onClick={() => fetchPlayers()}
        variant="secondary"
        size="sm"
      >
        🔄 Refresh
      </EnhancedButton>
      
      <EnhancedButton
        onClick={() => {
          setSearchTerm('');
          setFilterDivision('');
          setFilterPayment('');
          setSearchUSBC('');
          setAvgMin('');
          setAvgMax('');
        }}
        variant="secondary"
        size="sm"
      >
        Clear Filters
      </EnhancedButton>
    </div>
  ), [fetchPlayers]);

  // Fetch players when selectedSquad or squads change
  useEffect(() => {
    if (squads.length > 0) {
      fetchPlayers();
    }
  }, [selectedSquad, squads, fetchPlayers]);

  useEffect(() => {
    const lastTournamentId = getItem('lastTournamentId');
    if (lastTournamentId && token && user) {
      setIsLoading(true);
      fetch(API(`/api/v1/tournaments/${lastTournamentId}`),
        { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) setTournament(data);
        });
      // Fetch squads for this tournament
      fetch(API(`/api/v1/squads/?tournament_id=${lastTournamentId}`),
        { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          setSquads(data);
        });
      // Fetch selected squad from backend
      if (user?.id) {
        fetch(API(`/api/v1/squads/selected/?user_id=${user.id}`),
          { headers: { Authorization: `Bearer ${token}` } })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data && data.squad_id) {
              // Find squad details from squads list
              fetch(API(`/api/v1/squads/?tournament_id=${lastTournamentId}`),
                { headers: { Authorization: `Bearer ${token}` } })
                .then(res => res.ok ? res.json() : [])
                .then(squadsData => {
                  const foundSquad = squadsData.find((s: any) => s.id === data.squad_id);
                  if (foundSquad) setSelectedSquad(foundSquad);
                });
            } else {
              setSelectedSquad(null);
            }
          });
      }
    }
  }, [getItem, token, user]); // Added dependencies

  // Add entry handler
  async function add() {
    if (!firstName.trim() || !lastName.trim() || avg === '' || handicap === '' || scratch === '' || !lane.trim()) {
      alert('Please fill in all required fields.');
      return;
    }

    // If squads exist but none is selected, prompt user to select one
    if (squads.length > 0 && !selectedSquad) {
      const shouldContinue = confirm('No squad is selected. Do you want to add this player without assigning them to a specific squad?\n\nTip: You can select a squad on the Dashboard first, then come back here to add players to that specific squad.');
      if (!shouldContinue) {
        return;
      }
    }
    
    const lastTournamentId = getItem('lastTournamentId');
    const token = getItem('token');
    
    if (!lastTournamentId || !token) {
      alert('No tournament selected or authentication token found.');
      return;
    }

    const newBowler = {
      tournament_id: parseInt(lastTournamentId),
      squad_id: selectedSquad ? selectedSquad.id : null,
      user_id: parseInt(user?.id || '0'),
      name: `${firstName.trim()} ${lastName.trim()}`,
      average: typeof avg === 'number' ? avg : Number(avg),
      handicap: typeof handicap === 'number' ? handicap : Number(handicap),
      scratch: typeof scratch === 'number' ? scratch : Number(scratch),
      usbc: usbc.trim() || null,
      lane: lane.trim() || null,
      division: division,
      amount_paid: 0.0
    };

    try {
      const response = await fetch(API('/api/v1/bowlers/'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newBowler)
      });

      if (response.ok) {
        const createdBowler = await response.json();
        
        // Store names for auto-complete (client-side only)
        const storedNamesStr = getItem('playerNames') || '{"firstNames": [], "lastNames": []}';
        let storedNames;
        try {
          storedNames = JSON.parse(storedNamesStr);
        } catch {
          storedNames = { firstNames: [], lastNames: [] };
        }
        
        if (firstName.trim() && !storedNames.firstNames.includes(firstName.trim())) {
          storedNames.firstNames.push(firstName.trim());
        }
        if (lastName.trim() && !storedNames.lastNames.includes(lastName.trim())) {
          storedNames.lastNames.push(lastName.trim());
        }
        setItem('playerNames', JSON.stringify(storedNames));

        // Clear form
        setUsbc('');
        setFirstName('');
        setLastName('');
        setAvg('');
        setHandicap('');
        setScratch('');
        setLane('');
        setDivision('Open');
        
        // Refresh the players list to show the new player
        fetchPlayers();
      } else {
        const error = await response.text();
        alert(`Failed to add player: ${error}`);
      }
    } catch (err) {
      console.error('Error adding player:', err);
      alert('Failed to add player. Please try again.');
    }
  }

  // Set up page header with tournament and squad information
  usePageHeader({
    title: "Player Management",
    subtitle: tournament 
      ? `${tournament.name}${tournament.location ? ` • ${tournament.location}` : ''}${selectedSquad ? ` • Squad: ${selectedSquad.date} ${selectedSquad.time}` : squads.length > 0 ? ' • No squad selected' : ''}`
      : "Manage players for your bowling tournament",
    centerContent: false,
    actions: playerHeaderActions
  });

  return (
    <>
      {/* Handle authentication errors */}
      {authError && (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-500 mb-4">⚠️ Authentication Error</div>
            <p className="text-gray-600">{authError}</p>
            <button 
              onClick={() => typeof window !== 'undefined' && window.location.reload()}
              className="mt-4 mr-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Refresh Page
            </button>
            <button 
              onClick={() => typeof window !== 'undefined' && (window.location.href = '/login')}
              className="mt-4 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
            >
              Go to Login
            </button>
          </div>
        </div>
      )}

      {/* Handle loading state */}
      {!authError && !isAuthenticated && (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      )}

      {/* Main content - only show when authenticated */}
      {!authError && isAuthenticated && (
        <main className="page-main">
          {/* Main Content Container - Centered */}
          <div style={{
            maxWidth: '1400px',
            margin: '0 auto',
            padding: '0 1rem'
          }}>

        {/* Modern Add Player Form */}
        <div style={{
          background: 'linear-gradient(145deg, #ffffff 0%, #f8fafb 100%)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(240, 165, 0, 0.12)'
        }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              marginBottom: '20px'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #f0a500 0%, #e89700 100%)',
                borderRadius: '12px',
                padding: '12px',
                marginRight: '16px',
                boxShadow: '0 4px 12px rgba(240, 165, 0, 0.3)'
              }}>
                <span style={{ fontSize: '20px' }}>👤</span>
              </div>
              <div>
                <h2 style={{ margin: 0, color: '#374151', fontSize: '20px', fontWeight: '700' }}>Add New Player</h2>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>Enter player information to add them to the tournament</p>
              </div>
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px'
            }}>
              {/* Form fields will be added here - simplified for now */}
              <div style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: '2rem',
                background: 'rgba(240, 165, 0, 0.1)',
                borderRadius: '12px',
                border: '1px solid rgba(240, 165, 0, 0.2)'
              }}>
                <p style={{ color: '#d97706', margin: 0 }}>
                  🚧 Full form functionality being restored - simplified for deployment
                </p>
              </div>
            </div>
          </div>

        {/* Placeholder for other sections */}
        <div style={{
          background: 'linear-gradient(145deg, #ffffff 0%, #f8fafb 100%)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(240, 165, 0, 0.12)',
          textAlign: 'center'
        }}>
          <h3 style={{ color: '#374151', marginBottom: '1rem' }}>Player List & Management</h3>
          <p style={{ color: '#6b7280' }}>
            Advanced player management features are being restored.<br/>
            Full functionality including search, filtering, and editing will be available soon.
          </p>
        </div>
        
      </div>
      {/* End Main Content Container */}
        </main>
      )}
    </>
  )
}

// Export with error boundary wrapper and client-side only rendering
function EntriesPage() {
  return (
    <ErrorBoundary>
      <EntriesPageContent />
    </ErrorBoundary>
  );
}

export default EntriesPage;