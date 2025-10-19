
'use client'

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic'

import dynamicImport from 'next/dynamic'
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

function EntriesPageContent() {
  // Early return for SSR - must be before any hooks
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
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
        startEdit(nextRow, nextCol, (nextPlayer as any)[nextCol] || '');
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
          updatedBowler.name = `${col === 'firstName' ? editValue : player.firstName} ${col === 'lastName' ? editValue : player.lastName}`;
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
          console.error('Failed to save bowler:', response.status, response.statusText);
          setValidationErrors(prev => ({...prev, [saveKey]: 'Failed to save to server'}));
          
          // Show error toast
          addToast({
            message: `Server error: Failed to save ${player.firstName} ${player.lastName}`,
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
          
          return; // Don't update local state if server update failed
        }

        // Get the updated bowler from the server response
        const serverBowler = await response.json();
        logger.info('Successfully saved bowler', { playerId: player.id, serverResponse: serverBowler });

        // Update local state with server data to ensure consistency
        setPlayers(prev => {
          logger.debug('Updating local state', { playerId: player.id, playerName: player.firstName });
          logger.debug('Server response data', { serverBowler });
          
          const updated = prev.map((p) => {
            if (p.id !== player.id) return p;
            
            // Parse the name from server response
            const nameParts = serverBowler.name.split(' ');
            const firstName = nameParts[0] || '';
            const lastName = nameParts.slice(1).join(' ') || '';
            
            // Calculate total cost based on server values
            const totalCost = ((serverBowler.handicap || 0) + (serverBowler.scratch || 0)) * costPerBracket;
            
            const updatedPlayer = {
              ...p,
              firstName,
              lastName,
              average: serverBowler.average || 0,
              handicap: serverBowler.handicap || 0,
              scratch: serverBowler.scratch || 0,
              usbc: serverBowler.usbc || '',
              lane: serverBowler.lane || '',
              division: serverBowler.division || 'Open',
              totalCost,
              amountPaid: serverBowler.amount_paid || 0
            };
            
            logger.debug('Updated player', { playerId: updatedPlayer.id, updatedFields: col });
            logger.debug('Field comparison', {
              field: col,
              oldValue: (player as any)[col],
              newValue: (updatedPlayer as any)[col],
              changed: (player as any)[col] !== (updatedPlayer as any)[col]
            });
            return updatedPlayer;
          });
          
          logger.debug('New players array after update', { count: updated.length });
          return updated;
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
          updated.totalCost = ((Number(updated.handicap) + Number(updated.scratch)) * costPerBracket);
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
    const lastTournamentId = localStorage.getItem('lastTournamentId');
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
  }, [token]);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window !== 'undefined') {
        const width = window.innerWidth;
        setIsMobile(width <= 768);
      }
    };
    
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

  // Real-time validation as user types
  const validateInputRealTime = (field: string, value: any, playerId?: number): { isValid: boolean; warning?: string; error?: string } => {
    const result: { isValid: boolean; warning?: string; error?: string } = { isValid: true };

    switch (field) {
      case 'usbc':
        const usbcError = checkUSBCFormat(value);
        if (usbcError) {
          result.isValid = false;
          result.error = usbcError;
        }
        break;
      
      case 'firstName':
      case 'lastName':
        if (value && value.length < 2) {
          result.warning = 'Name should be at least 2 characters';
        }
        break;
        
      case 'average':
        const avg = Number(value);
        if (avg < 0 || avg > 300) {
          result.isValid = false;
          result.error = 'Average must be between 0-300';
        } else if (avg > 0 && avg < 75) {
          result.warning = 'Very low average - please verify';
        } else if (avg > 250) {
          result.warning = 'Very high average - please verify';
        }
        break;
        
      case 'handicap':
        const hdcp = Number(value);
        if (hdcp < 0 || hdcp > 120) {
          result.isValid = false;
          result.error = 'Handicap must be between 0-120';
        }
        break;
    }

    return result;
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

  // Auto-complete functions
  const getSuggestions = (value: string, field: 'firstName' | 'lastName') => {
    if (value.length < 2) return [];
    
    const existingNames = players.map(p => field === 'firstName' ? p.firstName : p.lastName);
    
    // Only access localStorage on client side
    let storedNames = { firstNames: [], lastNames: [] };
    if (typeof window !== 'undefined') {
      storedNames = JSON.parse(localStorage.getItem('playerNames') || '{"firstNames": [], "lastNames": []}');
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
  
  // Auto-save functionality
  const { saving: autoSaving, saveNow } = useAutoSave({
    data: { searchTerm, filterDivision, filterPayment, avgMin, avgMax },
    saveFunction: async (data) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('players-filters', JSON.stringify(data))
      }
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

  // Enhanced search with recent searches
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setSearchHighlight(value); // Set highlight for live search
    if (value && !recentSearches.includes(value)) {
      const newRecentSearches = [value, ...recentSearches.slice(0, 4)];
      setRecentSearches(newRecentSearches);
      
      // Only save to localStorage on client side
      if (typeof window !== 'undefined') {
        localStorage.setItem('recentSearches', JSON.stringify(newRecentSearches));
      }
    }
  };

  // Load recent searches on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('recentSearches');
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    }
  }, []);

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
  
  useEffect(() => {
    // Only run on client side with additional safety check
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    
    try {
      const style = document.createElement('style');
      style.textContent = `
        .hover-row {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .hover-row:hover {
          background: #f8fafd !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(35, 43, 54, 0.08);
        }
      `;
      document.head.appendChild(style);
      
      return () => {
        if (typeof document !== 'undefined' && document.head.contains(style)) {
          document.head.removeChild(style);
        }
      };
    } catch (error) {
      // Silently fail during SSR
      console.warn('Style injection failed during SSR:', error);
    }
  }, []);
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
    const lastTournamentId = localStorage.getItem('lastTournamentId');
    const token = localStorage.getItem('token');
    
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
  }, [selectedSquad, squads]);

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
    const lastTournamentId = localStorage.getItem('lastTournamentId');
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
                  const squad = squadsData.find((s: any) => s.id === data.squad_id);
                  setSelectedSquad(squad || null);
                });
            } else {
              setSelectedSquad(null);
            }
          });
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    
    const lastTournamentId = localStorage.getItem('lastTournamentId');
    const token = localStorage.getItem('token');
    
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
        if (typeof window !== 'undefined') {
          const storedNames = JSON.parse(localStorage.getItem('playerNames') || '{"firstNames": [], "lastNames": []}');
          if (firstName.trim() && !storedNames.firstNames.includes(firstName.trim())) {
            storedNames.firstNames.push(firstName.trim());
          }
          if (lastName.trim() && !storedNames.lastNames.includes(lastName.trim())) {
            storedNames.lastNames.push(lastName.trim());
          }
          localStorage.setItem('playerNames', JSON.stringify(storedNames));
        }

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

  // Early return for SSR - only render on client
  if (!isMounted) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading players...</div>;
  }

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
              <h3 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '700',
                color: '#1f2937',
                background: 'linear-gradient(135deg, #1f2937 0%, #f0a500 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                Add New Player
              </h3>
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>USBC Number</label>
                <input 
                  style={{
                    background: '#ffffff',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#f0a500';
                    e.target.style.boxShadow = '0 0 0 3px rgba(240, 165, 0, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="USBC #" 
                  value={usbc} 
                  onChange={e => setUsbc(e.target.value)} 
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>First Name</label>
                <input 
                  style={{
                    background: '#ffffff',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#f0a500';
                    e.target.style.boxShadow = '0 0 0 3px rgba(240, 165, 0, 0.1)';
                    if (firstName.length >= 2) {
                      const newSuggestions = getSuggestions(firstName, 'firstName');
                      setSuggestions(newSuggestions);
                      setShowSuggestions(newSuggestions.length > 0);
                      setCurrentField('firstName');
                    }
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="First name" 
                  value={firstName} 
                  onChange={e => handleInputChange(e.target.value, 'firstName')}
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Last Name</label>
                <input 
                  style={{
                    background: '#ffffff',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#f0a500';
                    e.target.style.boxShadow = '0 0 0 3px rgba(240, 165, 0, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Last name" 
                  value={lastName} 
                  onChange={e => handleInputChange(e.target.value, 'lastName')}
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Average</label>
                <input 
                  type="number"
                  style={{
                    background: '#ffffff',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#f0a500';
                    e.target.style.boxShadow = '0 0 0 3px rgba(240, 165, 0, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Average" 
                  value={avg} 
                  onChange={e => setAvg(Number(e.target.value))} 
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>HDCP</label>
                <input 
                  type="number"
                  style={{
                    background: '#ffffff',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#f0a500';
                    e.target.style.boxShadow = '0 0 0 3px rgba(240, 165, 0, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Handicap" 
                  value={handicap} 
                  onChange={e => setHandicap(Number(e.target.value))} 
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Scratch</label>
                <input 
                  type="number"
                  style={{
                    background: '#ffffff',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#f0a500';
                    e.target.style.boxShadow = '0 0 0 3px rgba(240, 165, 0, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Scratch" 
                  value={scratch} 
                  onChange={e => setScratch(Number(e.target.value))} 
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Lane</label>
                <input 
                  style={{
                    background: '#ffffff',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#f0a500';
                    e.target.style.boxShadow = '0 0 0 3px rgba(240, 165, 0, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Lane" 
                  value={lane} 
                  onChange={e => setLane(e.target.value)} 
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Division</label>
                <select 
                  style={{
                    background: '#ffffff',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#f0a500';
                    e.target.style.boxShadow = '0 0 0 3px rgba(240, 165, 0, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                  value={division} 
                  onChange={e => setDivision(e.target.value)}
                >
                  <option value="Open">Open</option>
                  <option value="Senior">Senior</option>
                  <option value="Youth">Youth</option>
                  <option value="Women">Women</option>
                </select>
              </div>
            </div>
            
            {/* Smart Suggestions for Duplicate Detection */}
            <SmartSuggestions
              firstName={firstName}
              lastName={lastName}
              usbc={usbc}
              players={players}
              onWarningAcknowledge={() => {
                // User acknowledged the warning - could add logic here if needed
              }}
              onMergeComplete={(mergedPlayer) => {
                // Handle successful merge - refresh players and clear form
                fetchPlayers();
                setFirstName('');
                setLastName('');
                setUsbc('');
                setAvg(0);
                setHandicap(0);
                setScratch(0);
                setLane('');
                setDivision('Open');
              }}
            />
            
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              marginTop: '20px'
            }}>
              <button
                onClick={add}
                style={{
                  background: '#f0a500',
                  color: '#ffffff',
                  border: '2px solid #f0a500',
                  borderRadius: '20px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  outline: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e09400';
                  e.currentTarget.style.borderColor = '#e09400';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0a500';
                  e.currentTarget.style.borderColor = '#f0a500';
                }}
              >
                Add Player
              </button>
            </div>
          </div>

        {/* Modern Search and Filter Card */}
        <div style={{
          background: 'linear-gradient(145deg, #ffffff 0%, #f8fafb 100%)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(240, 165, 0, 0.12)'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              position: 'relative'
            }}>
              <label style={{
                fontSize: '13px',
                fontWeight: '600',
                color: '#374151'
              }}>Search Players</label>
              <input 
                style={{
                  background: '#ffffff',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  fontSize: '14px',
                  transition: 'all 0.2s ease',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#f0a500';
                  e.target.style.boxShadow = '0 0 0 3px rgba(240, 165, 0, 0.1)';
                  setShowRecentSearches(recentSearches.length > 0);
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = 'none';
                  setTimeout(() => setShowRecentSearches(false), 200);
                }}
                placeholder="Search by name or USBC #" 
                value={searchTerm} 
                onChange={e => handleSearchChange(e.target.value)} 
              />
              {showRecentSearches && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#ffffff',
                  border: '2px solid #f0a500',
                  borderRadius: '10px',
                  marginTop: '4px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                  zIndex: 1000
                }}>
                  <div style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#6b7280'
                  }}>Recent Searches:</div>
                  {recentSearches.map((search, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#374151',
                        borderBottom: index < recentSearches.length - 1 ? '1px solid #f3f4f6' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      onClick={() => {
                        setSearchTerm(search);
                        setShowRecentSearches(false);
                      }}
                    >
                      🔍 {search}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <label style={{
                fontSize: '13px',
                fontWeight: '600',
                color: '#374151'
              }}>Division Filter</label>
              <select 
                style={{
                  background: '#ffffff',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  fontSize: '14px',
                  transition: 'all 0.2s ease',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#f0a500';
                  e.target.style.boxShadow = '0 0 0 3px rgba(240, 165, 0, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = 'none';
                }}
                value={filterDivision} 
                onChange={e => setFilterDivision(e.target.value)}
              >
                <option value="">All Divisions</option>
                <option value="Open">Open</option>
                <option value="Women">Women</option>
                <option value="Youth">Youth</option>
                <option value="Senior">Senior</option>
              </select>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <label style={{
                fontSize: '13px',
                fontWeight: '600',
                color: '#374151'
              }}>Payment Status</label>
              <select 
                style={{
                  background: '#ffffff',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  fontSize: '14px',
                  transition: 'all 0.2s ease',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#f0a500';
                  e.target.style.boxShadow = '0 0 0 3px rgba(240, 165, 0, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = 'none';
                }}
                value={filterPayment} 
                onChange={e => setFilterPayment(e.target.value)}
              >
                <option value="">All Players</option>
                <option value="paid">Paid</option>
                <option value="partial">Partially Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
          </div>
          
          {/* Advanced Filters Toggle */}
          <div style={{
            marginTop: '16px',
            textAlign: 'center'
          }}>
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              style={{
                background: showAdvancedFilters ? '#f0a500' : 'transparent',
                color: showAdvancedFilters ? '#ffffff' : '#f0a500',
                border: '2px solid #f0a500',
                borderRadius: '20px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                outline: 'none'
              }}
              onMouseEnter={(e) => {
                if (!showAdvancedFilters) {
                  e.currentTarget.style.backgroundColor = 'rgba(240, 165, 0, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                if (!showAdvancedFilters) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {showAdvancedFilters ? '− Hide Advanced Filters' : '+ Show Advanced Filters'}
            </button>
          </div>
        </div>

        {/* Advanced Filters Section */}
        {showAdvancedFilters && (
          <div style={{
            background: 'linear-gradient(145deg, #ffffff 0%, #f8fafb 100%)',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid rgba(240, 165, 0, 0.12)'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px'
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <label style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#374151'
                }}>USBC Number</label>
                <input 
                  style={{
                    background: '#ffffff',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#f0a500';
                    e.target.style.boxShadow = '0 0 0 3px rgba(240, 165, 0, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Search USBC number..." 
                  value={searchUSBC} 
                  onChange={e => setSearchUSBC(e.target.value)} 
                />
              </div>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <label style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#374151'
                }}>Min Average</label>
                <input 
                  type="number"
                  style={{
                    background: '#ffffff',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#f0a500';
                    e.target.style.boxShadow = '0 0 0 3px rgba(240, 165, 0, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Min" 
                  value={avgMin} 
                  onChange={e => setAvgMin(e.target.value ? Number(e.target.value) : '')} 
                />
              </div>
              
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <label style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#374151'
                }}>Max Average</label>
                <input 
                  type="number"
                  style={{
                    background: '#ffffff',
                    border: '2px solid #e5e7eb',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#f0a500';
                    e.target.style.boxShadow = '0 0 0 3px rgba(240, 165, 0, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Max" 
                  value={avgMax} 
                  onChange={e => setAvgMax(e.target.value ? Number(e.target.value) : '')} 
                />
              </div>
            </div>
          </div>
        )}

        {/* Filter Pills Section */}
        {activeFilters.length > 0 && (
          <div style={{
            background: 'linear-gradient(145deg, #ffffff 0%, #f8fafb 100%)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
            border: '1px solid rgba(240, 165, 0, 0.12)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}>
              <h3 style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                margin: 0
              }}>Active Filters ({activeFilters.length})</h3>
              <button
                onClick={clearAllFilters}
                style={{
                  background: 'transparent',
                  color: '#6b7280',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  padding: '4px 8px',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  outline: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#fee2e2';
                  e.currentTarget.style.borderColor = '#fca5a5';
                  e.currentTarget.style.color = '#dc2626';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = '#d1d5db';
                  e.currentTarget.style.color = '#6b7280';
                }}
              >
                Clear All
              </button>
            </div>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              {activeFilters.map((filter, index) => (
                <div
                  key={`${filter.key}-${index}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: 'linear-gradient(135deg, #f0a500 0%, #e89700 100%)',
                    color: '#ffffff',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '500',
                    boxShadow: '0 2px 8px rgba(240, 165, 0, 0.25)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>{filter.label}</span>
                  <button
                    onClick={() => removeFilter(filter.key)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '18px',
                      height: '18px',
                      marginLeft: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: '#ffffff',
                      transition: 'all 0.2s ease',
                      outline: 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
                      e.currentTarget.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                    title={`Remove ${filter.label}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            {/* Filter Statistics */}
            <div style={{
              marginTop: '12px',
              padding: '12px',
              background: 'rgba(240, 165, 0, 0.05)',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#6b7280'
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '8px'
              }}>
                <div>
                  <strong>Total:</strong> {filterStats.total} players
                </div>
                <div>
                  <strong>Filtered:</strong> {filterStats.filtered} players
                </div>
                <div style={{ color: '#059669' }}>
                  <strong>Paid:</strong> {filterStats.fullyPaid}
                </div>
                <div style={{ color: '#d97706' }}>
                  <strong>Partial:</strong> {filterStats.partiallyPaid}
                </div>
                <div style={{ color: '#dc2626' }}>
                  <strong>Unpaid:</strong> {filterStats.unpaid}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile/Desktop Conditional Rendering */}
        {isMobile ? (
          <MobileTable
            data={filteredAndSortedPlayers}
            isLoading={isLoading}
            columns={[
              { key: 'usbc', label: 'USBC #', sortable: true },
              { key: 'firstName', label: 'First Name', sortable: true },
              { key: 'lastName', label: 'Last Name', sortable: true },
              { key: 'average', label: 'Avg', sortable: true },
              { key: 'handicap', label: 'HDCP', sortable: true },
              { key: 'scratch', label: 'Scratch', sortable: true },
              { key: 'lane', label: 'Lane', sortable: true },
              { key: 'division', label: 'Division', sortable: true },
              { key: 'totalCost', label: 'Total Cost', sortable: true, render: (value) => `$${value || 0}` },
              { key: 'amountPaid', label: 'Paid', sortable: true, render: (value) => `$${value || 0}` }
            ]}
            onRowClick={(row) => {
              // Handle row click if needed
              logger.info('Player row clicked', { playerId: row.id });
            }}
            emptyMessage="No players found matching your criteria"
          />
        ) : (
          // Desktop Table
          <div style={{
            background: 'linear-gradient(145deg, #ffffff 0%, #f8fafb 100%)',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid rgba(240, 165, 0, 0.12)',
            overflow: 'hidden'
          }}>
        <div style={{
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          borderRadius: '12px',
          border: '1px solid #e5e7eb'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '14px',
            backgroundColor: '#ffffff'
          }} aria-label="Players">
            <thead>
              {selectedSquad && (
                <tr>
                  <td colSpan={10} style={{ 
                    backgroundColor: 'rgba(79, 140, 255, 0.1)', 
                    color: '#4f8cff',
                    textAlign: 'center',
                    fontSize: '14px',
                    fontWeight: '600',
                    padding: '12px'
                  }}>
                    📅 Showing players for: {selectedSquad.date} — {selectedSquad.time}
                  </td>
                </tr>
              )}
              <tr style={{
                backgroundColor: '#f8fafc',
                borderBottom: '2px solid #e5e7eb'
              }}>
                <th onClick={() => handleSort('usbc')} style={{ 
                  cursor: 'pointer',
                  padding: '18px 12px',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  fontWeight: '700',
                  color: '#374151',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '2px solid #e5e7eb',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: sortBy === 'usbc' ? 'rgba(240, 165, 0, 0.1)' : 'transparent',
                  position: 'relative'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(240, 165, 0, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = sortBy === 'usbc' ? 'rgba(240, 165, 0, 0.1)' : 'transparent'}>
                  USBC # 
                  {sortBy === 'usbc' && (
                    <span style={{
                      marginLeft: '4px',
                      fontSize: '16px',
                      color: '#f0a500',
                      transition: 'transform 0.3s ease',
                      transform: sortDirection === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)',
                      display: 'inline-block'
                    }}>
                      ↑
                    </span>
                  )}
                </th>
                <th onClick={() => handleSort('firstName')} style={{ 
                  cursor: 'pointer',
                  padding: '18px 12px',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  fontWeight: '700',
                  color: '#374151',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '2px solid #e5e7eb',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: sortBy === 'firstName' ? 'rgba(240, 165, 0, 0.1)' : 'transparent'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(240, 165, 0, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = sortBy === 'firstName' ? 'rgba(240, 165, 0, 0.1)' : 'transparent'}>
                  First Name 
                  {sortBy === 'firstName' && (
                    <span style={{
                      marginLeft: '4px',
                      fontSize: '16px',
                      color: '#f0a500',
                      transition: 'transform 0.3s ease',
                      transform: sortDirection === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)',
                      display: 'inline-block'
                    }}>
                      ↑
                    </span>
                  )}
                </th>
                <th onClick={() => handleSort('lastName')} style={{ 
                  cursor: 'pointer',
                  padding: '18px 12px',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  fontWeight: '700',
                  color: '#374151',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '2px solid #e5e7eb',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: sortBy === 'lastName' ? 'rgba(240, 165, 0, 0.1)' : 'transparent'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(240, 165, 0, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = sortBy === 'lastName' ? 'rgba(240, 165, 0, 0.1)' : 'transparent'}>
                  Last Name 
                  {sortBy === 'lastName' && (
                    <span style={{
                      marginLeft: '4px',
                      fontSize: '16px',
                      color: '#f0a500',
                      transition: 'transform 0.3s ease',
                      transform: sortDirection === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)',
                      display: 'inline-block'
                    }}>
                      ↑
                    </span>
                  )}
                </th>
                <th onClick={() => handleSort('average')} style={{ 
                  cursor: 'pointer',
                  padding: '18px 12px',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  fontWeight: '700',
                  color: '#374151',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '2px solid #e5e7eb',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: sortBy === 'average' ? 'rgba(240, 165, 0, 0.1)' : 'transparent'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(240, 165, 0, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = sortBy === 'average' ? 'rgba(240, 165, 0, 0.1)' : 'transparent'}>
                  Avg 
                  {sortBy === 'average' && (
                    <span style={{
                      marginLeft: '4px',
                      fontSize: '16px',
                      color: '#f0a500',
                      transition: 'transform 0.3s ease',
                      transform: sortDirection === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)',
                      display: 'inline-block'
                    }}>
                      ↑
                    </span>
                  )}
                </th>
                <th onClick={() => handleSort('handicap')} style={{ 
                  cursor: 'pointer',
                  padding: '18px 12px',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  fontWeight: '700',
                  color: '#374151',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '2px solid #e5e7eb',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: sortBy === 'handicap' ? 'rgba(240, 165, 0, 0.1)' : 'transparent'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(240, 165, 0, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = sortBy === 'handicap' ? 'rgba(240, 165, 0, 0.1)' : 'transparent'}>
                  HDCP 
                  {sortBy === 'handicap' && (
                    <span style={{
                      marginLeft: '4px',
                      fontSize: '16px',
                      color: '#f0a500',
                      transition: 'transform 0.3s ease',
                      transform: sortDirection === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)',
                      display: 'inline-block'
                    }}>
                      ↑
                    </span>
                  )}
                </th>
                <th onClick={() => handleSort('scratch')} style={{ 
                  cursor: 'pointer',
                  padding: '18px 12px',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  fontWeight: '700',
                  color: '#374151',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '2px solid #e5e7eb',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: sortBy === 'scratch' ? 'rgba(240, 165, 0, 0.1)' : 'transparent'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(240, 165, 0, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = sortBy === 'scratch' ? 'rgba(240, 165, 0, 0.1)' : 'transparent'}>
                  Scratch 
                  {sortBy === 'scratch' && (
                    <span style={{
                      marginLeft: '4px',
                      fontSize: '16px',
                      color: '#f0a500',
                      transition: 'transform 0.3s ease',
                      transform: sortDirection === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)',
                      display: 'inline-block'
                    }}>
                      ↑
                    </span>
                  )}
                </th>
                <th onClick={() => handleSort('lane')} style={{ 
                  cursor: 'pointer',
                  padding: '18px 12px',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  fontWeight: '700',
                  color: '#374151',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '2px solid #e5e7eb',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: sortBy === 'lane' ? 'rgba(240, 165, 0, 0.1)' : 'transparent'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(240, 165, 0, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = sortBy === 'lane' ? 'rgba(240, 165, 0, 0.1)' : 'transparent'}>
                  Lane 
                  {sortBy === 'lane' && (
                    <span style={{
                      marginLeft: '4px',
                      fontSize: '16px',
                      color: '#f0a500',
                      transition: 'transform 0.3s ease',
                      transform: sortDirection === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)',
                      display: 'inline-block'
                    }}>
                      ↑
                    </span>
                  )}
                </th>
                <th onClick={() => handleSort('division')} style={{ 
                  cursor: 'pointer',
                  padding: '18px 12px',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  fontWeight: '700',
                  color: '#374151',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '2px solid #e5e7eb',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: sortBy === 'division' ? 'rgba(240, 165, 0, 0.1)' : 'transparent'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(240, 165, 0, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = sortBy === 'division' ? 'rgba(240, 165, 0, 0.1)' : 'transparent'}>
                  Division 
                  {sortBy === 'division' && (
                    <span style={{
                      marginLeft: '4px',
                      fontSize: '16px',
                      color: '#f0a500',
                      transition: 'transform 0.3s ease',
                      transform: sortDirection === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)',
                      display: 'inline-block'
                    }}>
                      ↑
                    </span>
                  )}
                </th>
                <th onClick={() => handleSort('totalCost')} style={{ 
                  cursor: 'pointer',
                  padding: '18px 12px',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  fontWeight: '700',
                  color: '#374151',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '2px solid #e5e7eb',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: sortBy === 'totalCost' ? 'rgba(240, 165, 0, 0.1)' : 'transparent'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(240, 165, 0, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = sortBy === 'totalCost' ? 'rgba(240, 165, 0, 0.1)' : 'transparent'}>
                  Total Cost 
                  {sortBy === 'totalCost' && (
                    <span style={{
                      marginLeft: '4px',
                      fontSize: '16px',
                      color: '#f0a500',
                      transition: 'transform 0.3s ease',
                      transform: sortDirection === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)',
                      display: 'inline-block'
                    }}>
                      ↑
                    </span>
                  )}
                </th>
                <th onClick={() => handleSort('amountPaid')} style={{ 
                  cursor: 'pointer',
                  padding: '18px 12px',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  fontWeight: '700',
                  color: '#374151',
                  fontSize: '13px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '2px solid #e5e7eb',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: sortBy === 'amountPaid' ? 'rgba(240, 165, 0, 0.1)' : 'transparent'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(240, 165, 0, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = sortBy === 'amountPaid' ? 'rgba(240, 165, 0, 0.1)' : 'transparent'}>
                  Paid 
                  {sortBy === 'amountPaid' && (
                    <span style={{
                      marginLeft: '4px',
                      fontSize: '16px',
                      color: '#f0a500',
                      transition: 'transform 0.3s ease',
                      transform: sortDirection === 'desc' ? 'rotate(180deg)' : 'rotate(0deg)',
                      display: 'inline-block'
                    }}>
                      ↑
                    </span>
                  )}
                </th>

              </tr>
            </thead>
            <tbody>
              {isLoading && (
                Array.from({length: 3}).map((_, i) => (
                  <tr key={`skeleton-${i}`} style={{
                    borderBottom: '1px solid #f3f4f6'
                  }}>
                    <td style={{ padding: '12px' }}><div style={{height: '20px', width: '80%', backgroundColor: '#e5e7eb', borderRadius: '4px'}}></div></td>
                    <td style={{ padding: '12px' }}><div style={{height: '20px', width: '90%', backgroundColor: '#e5e7eb', borderRadius: '4px'}}></div></td>
                    <td style={{ padding: '12px' }}><div style={{height: '20px', width: '85%', backgroundColor: '#e5e7eb', borderRadius: '4px'}}></div></td>
                    <td style={{ padding: '12px' }}><div style={{height: '20px', width: '60%', backgroundColor: '#e5e7eb', borderRadius: '4px'}}></div></td>
                    <td style={{ padding: '12px' }}><div style={{height: '20px', width: '60%', backgroundColor: '#e5e7eb', borderRadius: '4px'}}></div></td>
                    <td style={{ padding: '12px' }}><div style={{height: '20px', width: '60%', backgroundColor: '#e5e7eb', borderRadius: '4px'}}></div></td>
                    <td style={{ padding: '12px' }}><div style={{height: '20px', width: '70%', backgroundColor: '#e5e7eb', borderRadius: '4px'}}></div></td>
                    <td style={{ padding: '12px' }}><div style={{height: '20px', width: '80%', backgroundColor: '#e5e7eb', borderRadius: '4px'}}></div></td>
                    <td style={{ padding: '12px' }}><div style={{height: '20px', width: '90%', backgroundColor: '#e5e7eb', borderRadius: '4px'}}></div></td>
                    <td style={{ padding: '12px' }}><div style={{height: '20px', width: '85%', backgroundColor: '#e5e7eb', borderRadius: '4px'}}></div></td>
                  </tr>
                ))
              )}
              {!isLoading && filteredAndSortedPlayers.map((p: Player, index: number) => {
                return (
                <tr key={p.id} style={{
                  borderBottom: '1px solid #f3f4f6',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                  borderRadius: '8px',
                  margin: '2px 0'
                }} 
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f9ff';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}>
                  {/* USBC # */}
                  <td 
                    onClick={(e) => handleCellClick(index, 'usbc', p.usbc ?? '', e)}
                    onDoubleClick={() => startEdit(index, 'usbc', p.usbc ?? '')}
                    style={{ 
                      cursor: 'pointer', 
                      position: 'relative',
                      padding: '16px 12px',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      background: selectedCell?.row === index && selectedCell?.col === 'usbc' ? 'rgba(59, 130, 246, 0.2)' : 'inherit',
                      border: validationErrors[`${p.id}-usbc`] ? '2px solid #dc2626' : 'none',
                      borderRadius: validationErrors[`${p.id}-usbc`] ? '6px' : '0',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      color: '#374151',
                      fontSize: '14px',
                      fontWeight: '500',
                      boxShadow: selectedCell?.row === index && selectedCell?.col === 'usbc' ? '0 0 0 2px rgba(59, 130, 246, 0.3)' : 'none'
                    }}
                    title="Double-click to edit"
                  >
                    {editing?.row === index && editing.col === 'usbc' ? (
                      <>
                        <input
                          type="text"
                          value={editValue as string}
                          autoFocus
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => saveEdit(index, 'usbc')}
                          onKeyDown={e => { 
                            if (e.key === 'Enter') {
                              saveEdit(index, 'usbc');
                              handleTabNavigation(index, 'usbc', 'next');
                            }
                            if (e.key === 'Escape') cancelEdit();
                            if (e.key === 'Tab') {
                              e.preventDefault();
                              saveEdit(index, 'usbc');
                              handleTabNavigation(index, 'usbc', e.shiftKey ? 'prev' : 'next');
                            }
                          }}
                          style={{ width: '80px' }}
                          className={validationErrors[`${p.id}-usbc`] ? styles.errorInput : styles.smartInput}
                        />
                        {validationErrors[`${p.id}-usbc`] && (
                          <div className={styles.errorTooltip}>{validationErrors[`${p.id}-usbc`]}</div>
                        )}
                      </>
                    ) : (
                      <>
                        {savingStates[`${p.id}-usbc`] && <span className={styles.savingIndicator}>💾</span>}
                        {p.usbc ?? <span className={styles.placeholderText}>Click to add</span>}
                        {!p.usbc && <span className={styles.incompleteIndicator}>⚠️</span>}
                      </>
                    )}
                  </td>
                  {/* First Name */}
                  <td 
                    onClick={(e) => handleCellClick(index, 'firstName', p.firstName, e)}
                    onDoubleClick={() => startEdit(index, 'firstName', p.firstName)}
                    style={{ 
                      cursor: 'pointer', 
                      position: 'relative',
                      padding: '16px 12px',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      background: selectedCell?.row === index && selectedCell?.col === 'firstName' ? 'rgba(59, 130, 246, 0.2)' : 'inherit',
                      border: validationErrors[`${p.id}-firstName`] ? '2px solid #dc2626' : 'none',
                      borderRadius: validationErrors[`${p.id}-firstName`] ? '6px' : '0',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      color: '#374151',
                      fontSize: '14px',
                      fontWeight: '500',
                      boxShadow: selectedCell?.row === index && selectedCell?.col === 'firstName' ? '0 0 0 2px rgba(59, 130, 246, 0.3)' : 'none'
                    }}
                    title="Double-click to edit"
                  >
                    {editing?.row === index && editing.col === 'firstName' ? (
                      <>
                        <input
                          type="text"
                          value={editValue as string}
                          autoFocus
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => saveEdit(index, 'firstName')}
                          onKeyDown={e => { 
                            if (e.key === 'Enter') {
                              saveEdit(index, 'firstName');
                              handleTabNavigation(index, 'firstName', 'next');
                            }
                            if (e.key === 'Escape') cancelEdit();
                            if (e.key === 'Tab') {
                              e.preventDefault();
                              saveEdit(index, 'firstName');
                              handleTabNavigation(index, 'firstName', e.shiftKey ? 'prev' : 'next');
                            }
                          }}
                          style={{ width: '100px' }}
                          className={validationErrors[`${p.id}-firstName`] ? styles.errorInput : styles.smartInput}
                        />
                        {validationErrors[`${p.id}-firstName`] && (
                          <div className={styles.errorTooltip}>{validationErrors[`${p.id}-firstName`]}</div>
                        )}
                      </>
                    ) : (
                      <>
                        {savingStates[`${p.id}-firstName`] && <span className={styles.savingIndicator}>💾</span>}
                        {searchTerm ? highlightSearchResults(p.firstName, searchTerm) : p.firstName}
                      </>
                    )}
                  </td>
                  {/* Last Name */}
                  <td onClick={() => startEdit(index, 'lastName', p.lastName)} style={{ 
                    cursor: 'pointer',
                    padding: '16px 12px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    color: '#374151',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    {editing?.row === index && editing.col === 'lastName' ? (
                      <input
                        type="text"
                        value={editValue as string}
                        autoFocus
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => saveEdit(index, 'lastName')}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(index, 'lastName'); if (e.key === 'Escape') cancelEdit(); }}
                        style={{ width: '100px' }}
                      />
                    ) : (
                      searchTerm ? highlightSearchResults(p.lastName, searchTerm) : p.lastName
                    )}
                  </td>
                  {/* Average */}
                  <td onClick={() => startEdit(index, 'average', p.average)} style={{ 
                    cursor: 'pointer',
                    padding: '16px 12px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    color: '#374151',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    {editing?.row === index && editing.col === 'average' ? (
                      <input
                        type="number"
                        value={editValue as number}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => saveEdit(index, 'average')}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(index, 'average'); if (e.key === 'Escape') cancelEdit(); }}
                        style={{ width: '60px' }}
                      />
                    ) : p.average}
                  </td>
                  {/* Handicap */}
                  <td onClick={() => startEdit(index, 'handicap', p.handicap)} style={{ 
                    cursor: 'pointer',
                    padding: '16px 12px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    color: '#374151',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    {editing?.row === index && editing.col === 'handicap' ? (
                      <input
                        type="number"
                        value={editValue as number}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => saveEdit(index, 'handicap')}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(index, 'handicap'); if (e.key === 'Escape') cancelEdit(); }}
                        style={{ width: '60px' }}
                      />
                    ) : p.handicap}
                  </td>
                  {/* Scratch */}
                  <td onClick={() => startEdit(index, 'scratch', p.scratch)} style={{ 
                    cursor: 'pointer',
                    padding: '16px 12px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    color: '#374151',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    {editing?.row === index && editing.col === 'scratch' ? (
                      <input
                        type="number"
                        value={editValue as number}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                        onChange={e => {
                          devLog('Input onChange - scratch field:', e.target.value);
                          setEditValue(e.target.value);
                        }}
                        onBlur={() => saveEdit(index, 'scratch')}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(index, 'scratch'); if (e.key === 'Escape') cancelEdit(); }}
                        style={{ width: '60px' }}
                      />
                    ) : p.scratch}
                  </td>
                  {/* Lane */}
                  <td onClick={() => startEdit(index, 'lane', p.lane)} style={{ 
                    cursor: 'pointer',
                    padding: '16px 12px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    color: '#374151',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    {editing?.row === index && editing.col === 'lane' ? (
                      <input
                        type="text"
                        value={editValue as string}
                        autoFocus
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => saveEdit(index, 'lane')}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(index, 'lane'); if (e.key === 'Escape') cancelEdit(); }}
                        style={{ width: '60px' }}
                      />
                    ) : p.lane}
                  </td>
                  {/* Division */}
                  <td onClick={() => startEdit(index, 'division', p.division)} style={{ 
                    cursor: 'pointer',
                    padding: '16px 12px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    color: '#374151',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    {editing?.row === index && editing.col === 'division' ? (
                      <select
                        value={editValue as string}
                        autoFocus
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => saveEdit(index, 'division')}
                        style={{ width: '90px' }}
                      >
                        <option value="Open">Open</option>
                        <option value="Women">Women</option>
                        <option value="Youth">Youth</option>
                        <option value="Senior">Senior</option>
                      </select>
                    ) : p.division}
                  </td>
                  {/* Total Cost (calculated) */}
                  <td style={{ 
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    padding: '16px 12px',
                    fontWeight: '600',
                    color: '#374151',
                    fontSize: '14px'
                  }}>
                    {formatCurrency(p.totalCost)}
                  </td>
                  {/* Amount Paid (clickable to toggle paid status) */}
                  <td 
                    style={{ 
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      cursor: 'pointer',
                      padding: '16px 12px',
                      userSelect: 'none',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      borderRadius: '8px',
                      fontWeight: '600',
                      fontSize: '14px',
                      backgroundColor: p.amountPaid >= p.totalCost 
                        ? 'rgba(34, 197, 94, 0.1)' 
                        : p.amountPaid > 0 
                          ? 'rgba(251, 146, 60, 0.1)'
                          : 'rgba(239, 68, 68, 0.1)',
                      color: p.amountPaid >= p.totalCost 
                        ? '#16a34a' 
                        : p.amountPaid > 0 
                          ? '#ea580c'
                          : '#dc2626',
                      border: `2px solid ${p.amountPaid >= p.totalCost 
                        ? '#22c55e' 
                        : p.amountPaid > 0 
                          ? '#fb923c'
                          : '#ef4444'}20`
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    onClick={async () => {
                      const newAmountPaid = p.amountPaid >= p.totalCost ? 0 : p.totalCost;
                      
                      // Update frontend state
                      setPlayers(prev => prev.map((player, idx) => {
                        if (idx !== index) return player;
                        return { ...player, amountPaid: newAmountPaid };
                      }));

                      // Save to backend
                      const token = localStorage.getItem('token');
                      if (token) {
                        try {
                          const response = await fetch(API(`/api/v1/bowlers/${p.id}`), {
                            method: 'PATCH',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${token}`
                            },
                            body: JSON.stringify({ amount_paid: newAmountPaid })
                          });
                          if (!response.ok) {
                            console.error('Failed to save payment status:', response.status, response.statusText);
                          } else {
                            logger.info('Successfully saved payment status');
                          }
                        } catch (error) {
                          console.error('Error saving payment status:', error);
                        }
                      }
                    }}
                    title={p.amountPaid >= p.totalCost ? "Click to mark as unpaid" : "Click to mark as paid"}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      {p.amountPaid >= p.totalCost ? (
                        <span style={{ color: '#16a34a', fontSize: '16px' }}>✅</span>
                      ) : p.amountPaid > 0 ? (
                        <span style={{ color: '#ea580c', fontSize: '16px' }}>⚠️</span>
                      ) : (
                        <span style={{ color: '#dc2626', fontSize: '16px' }}>❌</span>
                      )}
                      <span>{formatCurrency(p.amountPaid)}</span>
                    </div>
                  </td>

                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
        </div>
        )}

        {/* Pagination Controls */}
        <div style={{ 
          marginTop: '2rem', 
          display: 'flex', 
          justifyContent: 'center',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            fontSize: '0.875rem',
            color: '#6b7280'
          }}>
            <span>
              Showing {((paginationHook.currentPage - 1) * 25) + 1} to{' '}
              {Math.min(paginationHook.currentPage * 25, filteredPlayers.length)} of{' '}
              {filteredPlayers.length} players
            </span>
          </div>
          
          <Pagination
            currentPage={paginationHook.currentPage}
            totalPages={paginationHook.totalPages}
            onPageChange={paginationHook.goToPage}
            itemsPerPage={25}
            totalItems={filteredPlayers.length}
            showItemCount={false}
            showPageSize={false}
          />
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
  // Ensure this only renders on the client side
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  if (!isClient) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div>Loading...</div>
      </div>
    );
  }
  
  return (
    <ErrorBoundary>
      <EntriesPageContent />
    </ErrorBoundary>
  );
}

// Force disable SSR completely for this page
const PlayersPageWithoutSSR = dynamicImport(() => Promise.resolve(EntriesPage), {
  ssr: false,
  loading: () => (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <div>Loading players...</div>
    </div>
  )
});

export default PlayersPageWithoutSSR;
