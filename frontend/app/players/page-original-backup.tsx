'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo, useCallback } from 'react'

import { useAuth } from '../lib/auth-context'
import { usePageHeader } from '../lib/header-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { API } from '../lib/api'
import { logger } from '../lib/logger'






// Force dynamic rendering for this page


type Player = { 
  id: number, 
  usbc?: string, 
  firstName: string, 
  lastName: string, 
  average: number, 
  handicap: number, 
  scratch: number, 
  lane: string, 
  division: string, 
  totalCost: number, 
  amountPaid: number, 
  squad?: { id: number, date: string, time: string } 
}

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

function PlayersPageContent() {
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
          <div style={{ marginBottom: '1rem', fontSize: '2rem' }}>Loading...</div>
          <div>Loading player management...</div>
        </div>
      </div>
    );
  }

  return <PlayersPageInner getItem={getItem} setItem={setItem} />;
}

function PlayersPageInner({ getItem, setItem }: { getItem: (key: string) => string | null, setItem: (key: string, value: string) => void }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [squads, setSquads] = useState<any[]>([]);
  const [selectedSquad, setSelectedSquad] = useState<any | null>(null);
  
  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [average, setAverage] = useState<number | ''>('');
  const [handicap, setHandicap] = useState<number | ''>('');
  const [scratch, setScratch] = useState<number | ''>('');
  const [lane, setLane] = useState('');
  const [division, setDivision] = useState('Open');
  const [usbc, setUsbc] = useState('');
  
  // Edit mode state - simplified to just track saving status
  const [savingStatus, setSavingStatus] = useState<{[key: string]: 'saving' | 'saved' | 'error'}>({});
  
  // Debounced saves tracker
  const debouncedSaves = new Map<string, NodeJS.Timeout>();
  
  // Track if we're in demo mode (API unavailable)
  const [isDemoMode, setIsDemoMode] = useState(false);
  
  const auth = useAuth();
  const isAuthenticated = auth && auth.isAuthenticated;
  const { token, user } = auth || {};

  // Debug authentication state
  useEffect(() => {
    logger.debug('Players page auth state', {
      isAuthenticated,
      hasToken: !!token,
      hasUser: !!user,
      tokenFromStorage: !!localStorage.getItem('token'),
      userIdFromStorage: !!localStorage.getItem('user_id')
    });
  }, [isAuthenticated, token, user]);

  // Function to fetch players with fallback to demo data
  const fetchPlayers = useCallback(async () => {
    const lastTournamentId = getItem('lastTournamentId');
    const authToken = getItem('token');
    
    if (!lastTournamentId || !authToken) {
      // Load demo data if no auth
      setPlayers(getDemoPlayers());
      return;
    }
    
    setIsLoading(true);
    
    try {
      const bowlersUrl = selectedSquad 
        ? `/api/v1/bowlers/?tournament_id=${lastTournamentId}&squad_id=${selectedSquad.id}`
        : `/api/v1/bowlers/?tournament_id=${lastTournamentId}`;
      
      const response = await fetch(API(bowlersUrl), {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      if (!response.ok) {
        // If API fails, load demo data
        logger.warn('API not available, loading demo data', { status: response.status });
        setIsDemoMode(true);
        setPlayers(getDemoPlayers());
        return;
      } else {
        setIsDemoMode(false);
      }
      
      const data = await response.json();
      
      // Transform bowlers data to match our player structure
      const transformedData = (data || []).map((bowler: Player) => {
        const nameParts = bowler.name.split(' ');
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
      logger.error('Failed to fetch bowlers', { error: err });
      // Load demo data as fallback
      setPlayers(getDemoPlayers());
    } finally {
      setIsLoading(false);
    }
  }, [selectedSquad, squads, getItem]);

  // Demo data function for when API is unavailable
  const getDemoPlayers = (): Player[] => {
    return [
      {
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        average: 185,
        handicap: 15,
        scratch: 3,
        usbc: '12345678',
        lane: '1-2',
        division: 'Open',
        totalCost: 45.00,
        amountPaid: 45.00
      },
      {
        id: 2,
        firstName: 'Jane',
        lastName: 'Smith',
        average: 170,
        handicap: 20,
        scratch: 2,
        usbc: '87654321',
        lane: '3-4',
        division: 'Handicap',
        totalCost: 35.00,
        amountPaid: 35.00
      },
      {
        id: 3,
        firstName: 'Mike',
        lastName: 'Johnson',
        average: 195,
        handicap: 8,
        scratch: 4,
        usbc: '11223344',
        lane: '5-6',
        division: 'Scratch',
        totalCost: 60.00,
        amountPaid: 30.00
      }
    ];
  };

  // Add player function
  const addPlayer = async () => {
    if (!firstName.trim() || !lastName.trim() || average === '' || handicap === '' || scratch === '') {
      alert('Please fill in all required fields.');
      return;
    }

    const lastTournamentId = getItem('lastTournamentId');
    const authToken = getItem('token');
    
    if (!lastTournamentId || !authToken) {
      alert('No tournament selected or authentication token found.');
      return;
    }

    const newBowler = {
      tournament_id: parseInt(lastTournamentId),
      squad_id: selectedSquad ? selectedSquad.id : null,
      user_id: parseInt(user?.id || '0'),
      name: `${firstName.trim()} ${lastName.trim()}`,
      average: typeof average === 'number' ? average : Number(average),
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
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(newBowler)
      });

      if (response.ok) {
        // Clear form
        setFirstName('');
        setLastName('');
        setAverage('');
        setHandicap('');
        setScratch('');
        setLane('');
        setDivision('Open');
        setUsbc('');
        
        // Refresh players list
        fetchPlayers();
        alert('Player added successfully!');
      } else {
        const error = await response.text();
        alert(`Failed to add player: ${error}`);
      }
    } catch (err) {
      logger.error('Failed to add player', { error: err });
      alert('Failed to add player. Please try again.');
    }
  };

  // Functions for editing players - using debounced save like scores table
  const updatePlayerField = async (playerId: number, field: keyof Player, value: any) => {
    const saveKey = `${playerId}-${field}`;
    
    // Update local state first for immediate UI feedback
    setPlayers(prev => prev.map(player => {
      if (player.id === playerId) {
        return {
          ...player,
          [field]: value
        };
      }
      return player;
    }));

    // Clear existing timeout for this field
    const existingTimeout = debouncedSaves.get(saveKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Set saving status
    setSavingStatus(prev => ({ ...prev, [saveKey]: 'saving' }));
    
    // Debounced save to backend (500ms delay)
    const timeoutId = setTimeout(async () => {
      try {
        const authToken = getItem('token');
        if (!authToken) {
          setSavingStatus(prev => ({ ...prev, [saveKey]: 'error' }));
          return;
        }

        // Get the updated player data
        const updatedPlayer = players.find(p => p.id === playerId);
        if (!updatedPlayer) {
          setSavingStatus(prev => ({ ...prev, [saveKey]: 'error' }));
          return;
        }

        const response = await fetch(API(`/api/v1/bowlers/${playerId}`), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({
            name: `${updatedPlayer.firstName} ${updatedPlayer.lastName}`,
            average: updatedPlayer.average,
            handicap: updatedPlayer.handicap,
            lane: updatedPlayer.lane || null,
            division: updatedPlayer.division,
            usbc: updatedPlayer.usbc || null
          })
        });

        if (response.ok) {
          // Set saved status
          setSavingStatus(prev => ({ ...prev, [saveKey]: 'saved' }));
          
          // Clear saved status after 2 seconds
          setTimeout(() => {
            setSavingStatus(prev => {
              const newStatus = { ...prev };
              delete newStatus[saveKey];
              return newStatus;
            });
          }, 2000);
        } else {
          setSavingStatus(prev => ({ ...prev, [saveKey]: 'error' }));
          
          // Clear error status after 3 seconds
          setTimeout(() => {
            setSavingStatus(prev => {
              const newStatus = { ...prev };
              delete newStatus[saveKey];
              return newStatus;
            });
          }, 3000);
        }
      } catch (err) {
        logger.error('Failed to update player', { error: err, playerId, field });
        setSavingStatus(prev => ({ ...prev, [saveKey]: 'error' }));
        
        // Clear error status after 3 seconds
        setTimeout(() => {
          setSavingStatus(prev => {
            const newStatus = { ...prev };
            delete newStatus[saveKey];
            return newStatus;
          });
        }, 3000);
      }
    }, 500); // 500ms debounce delay
    
    debouncedSaves.set(saveKey, timeoutId);
  };

  const handleKeyDown = (e: React.KeyboardEvent, playerId: number, field: keyof Player) => {
    if (e.key === 'Enter') {
      (e.currentTarget as HTMLInputElement).blur();
    }
  };

  // Legacy editing state for compatibility with existing table
  const [editingPlayer, setEditingPlayer] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Partial<Player>>({});

  // Legacy functions for compatibility
  const startEditingField = (player: Player, field: keyof Player) => {
    if (editingPlayer !== player.id) {
      setEditingPlayer(player.id);
      setEditValues({
        firstName: player.firstName,
        lastName: player.lastName,
        average: player.average,
        handicap: player.handicap,
        lane: player.lane,
        division: player.division,
        usbc: player.usbc
      });
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent, playerId: number) => {
    if (event.key === 'Enter') {
      saveEdit(playerId);
    } else if (event.key === 'Escape') {
      setEditingPlayer(null);
      setEditValues({});
    }
  };

  // Remove auto-save on blur - let user control when to save
  const handleBlur = (playerId: number) => {
    // Do nothing - user must press Enter to save
  };

  const saveEdit = async (playerId: number) => {
    const authToken = getItem('token');
    if (!authToken) {
      alert('Authentication required');
      return;
    }

    // Use the debounced updatePlayerField for each changed field
    for (const [field, value] of Object.entries(editValues)) {
      if (field in editValues && value !== undefined) {
        await updatePlayerField(playerId, field as keyof Player, value);
      }
    }

    // Clear edit mode
    setEditingPlayer(null);
    setEditValues({});
  };

  const deletePlayer = async (playerId: number) => {
    if (!confirm('Are you sure you want to delete this player?')) {
      return;
    }

    const authToken = getItem('token');
    if (!authToken) {
      alert('Authentication required');
      return;
    }

    try {
      const response = await fetch(API(`/api/v1/bowlers/${playerId}`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      if (response.ok) {
        setPlayers(prevPlayers => prevPlayers.filter(p => p.id !== playerId));
        alert('Player deleted successfully!');
      } else {
        const error = await response.text();
        alert(`Failed to delete player: ${error}`);
      }
    } catch (err) {
      logger.error('Failed to delete player', { error: err, playerId });
      alert('Failed to delete player. Please try again.');
    }
  };

  // Set up page header
  const playerHeaderActions = useMemo(() => (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
      <button
        onClick={() => fetchPlayers()}
        style={{
          padding: '8px 16px',
          backgroundColor: '#f0a500',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        Refresh
      </button>
    </div>
  ), [fetchPlayers]);

  // Load tournament and squad data on mount
  useEffect(() => {
    const lastTournamentId = getItem('lastTournamentId');
    if (lastTournamentId && token && user) {
      setIsLoading(true);
      
      // Fetch tournament info
      fetch(API(`/api/v1/tournaments/${lastTournamentId}`), {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setTournament(data);
      });
      
      // Fetch squads
      fetch(API(`/api/v1/squads/?tournament_id=${lastTournamentId}`), {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        setSquads(data);
      });
      
      // Fetch selected squad
      if (user?.id) {
        fetch(API(`/api/v1/squads/selected/?user_id=${user.id}`), {
          headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.squad_id) {
            fetch(API(`/api/v1/squads/?tournament_id=${lastTournamentId}`), {
              headers: { Authorization: `Bearer ${token}` }
            })
            .then(res => res.ok ? res.json() : [])
            .then(squadsData => {
              const foundSquad = squadsData.find((s: Squad) => s.id === data.squad_id);
              if (foundSquad) setSelectedSquad(foundSquad);
            });
          }
        });
      }
    }
  }, [getItem, token, user]);

  // Fetch players when squad changes
  useEffect(() => {
    if (squads.length > 0) {
      fetchPlayers();
    }
  }, [selectedSquad, squads, fetchPlayers]);

  // Set up page header
  usePageHeader({
    title: "Player Management",
    subtitle: tournament 
      ? `${tournament.name}${tournament.location ? ` • ${tournament.location}` : ''}${selectedSquad ? ` • Squad: ${selectedSquad.date} ${selectedSquad.time}` : squads.length > 0 ? ' • No squad selected' : ''}`
      : "Manage players for your bowling tournament",
    centerContent: false,
    actions: playerHeaderActions
  });

  // Check if we have tokens in localStorage even if auth context isn't ready
  const hasStoredAuth = typeof window !== 'undefined' && 
    localStorage.getItem('token') && 
    localStorage.getItem('user_id');

  if (!isAuthenticated && !hasStoredAuth) {
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
          <div style={{ marginBottom: '1rem', fontSize: '2rem' }}>🔒</div>
          <div>Please log in to access player management</div>
        </div>
      </div>
    );
  }

  // Show loading if we have stored auth but context isn't ready yet
  if (!isAuthenticated && hasStoredAuth) {
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

  return (
    <main style={{ padding: '1rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Add Player Form */}
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
          marginBottom: '20px'
        }}>
          <div>
            <h2 style={{ margin: 0, color: '#374151', fontSize: '20px', fontWeight: '700' }}>Add New Player</h2>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>Enter player information to add them to the tournament</p>
          </div>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '20px'
        }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#374151' }}>
              First Name *
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
              required
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#374151' }}>
              Last Name *
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
              required
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#374151' }}>
              Average *
            </label>
            <input
              type="number"
              value={average}
              onChange={(e) => setAverage(e.target.value === '' ? '' : Number(e.target.value))}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
              min="0"
              max="300"
              required
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#374151' }}>
              Handicap *
            </label>
            <input
              type="number"
              value={handicap}
              onChange={(e) => setHandicap(e.target.value === '' ? '' : Number(e.target.value))}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
              min="0"
              max="120"
              required
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#374151' }}>
              Scratch *
            </label>
            <input
              type="number"
              value={scratch}
              onChange={(e) => setScratch(e.target.value === '' ? '' : Number(e.target.value))}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
              min="0"
              max="20"
              required
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#374151' }}>
              Lane
            </label>
            <input
              type="text"
              value={lane}
              onChange={(e) => setLane(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#374151' }}>
              Division
            </label>
            <select
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            >
              <option value="Open">Open</option>
              <option value="Womens">Womens</option>
              <option value="Senior">Senior</option>
              <option value="Junior">Junior</option>
            </select>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#374151' }}>
              USBC Number
            </label>
            <input
              type="text"
              value={usbc}
              onChange={(e) => setUsbc(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px'
              }}
              placeholder="8 digits"
              maxLength={8}
            />
          </div>
        </div>
        
        <button
          onClick={addPlayer}
          style={{
            padding: '12px 24px',
            backgroundColor: '#f0a500',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '600'
          }}
        >
          Add Player
        </button>
      </div>

      {/* Players List */}
      <div style={{
        background: 'linear-gradient(145deg, #ffffff 0%, #f8fafb 100%)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        border: '1px solid rgba(240, 165, 0, 0.12)'
      }}>
        <h3 style={{ color: '#374151', marginBottom: '1rem' }}>Players ({players.length})</h3>
        
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div>Loading players...</div>
          </div>
        ) : players.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
            No players found. Add some players to get started!
          </div>
        ) : (
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
              }} aria-label="Player List">

            <thead>
              {selectedSquad && (
                <tr>
                  <td colSpan={8} style={{ 
                    backgroundColor: 'rgba(79, 140, 255, 0.1)', 
                    color: '#4f8cff',
                    textAlign: 'center',
                    fontSize: '14px',
                    fontWeight: '600',
                    padding: '12px'
                  }}>
                    Squad: {selectedSquad.date} — {selectedSquad.time}
                  </td>
                </tr>
              )}
              <tr style={{
                backgroundColor: '#f8fafc'
              }}>
                <th style={{ 
                    cursor: 'pointer',
                    padding: '18px 12px',
                    textAlign: 'left',
                    verticalAlign: 'middle',
                    fontWeight: '700',
                    color: '#374151',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: '2px solid #e5e7eb',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: 'transparent'
                  }}>First Name</th>
                  <th style={{ 
                    cursor: 'pointer',
                    padding: '18px 12px',
                    textAlign: 'left',
                    verticalAlign: 'middle',
                    fontWeight: '700',
                    color: '#374151',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: '2px solid #e5e7eb',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    background: 'transparent'
                  }}>Last Name</th>
                  <th style={{ 
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
                    background: 'transparent'
                  }}>Lane</th>
                  <th style={{ 
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
                    background: 'transparent'
                  }}>Average</th>
                  <th style={{ 
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
                    background: 'transparent'
                  }}>Handicap</th>
                  <th style={{ 
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
                    background: 'transparent'
                  }}>Division</th>
                  <th style={{ 
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
                    background: 'transparent'
                  }}>USBC</th>
                  <th style={{ 
                    padding: '18px 12px',
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    fontWeight: '700',
                    color: '#374151',
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: '2px solid #e5e7eb',
                    background: 'transparent'
                  }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, index) => {
                  const isEditing = editingPlayer === player.id;
                  return (
                    <tr key={player.id} style={{
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
                      {/* First Name */}
                      <td style={{ 
                        padding: '16px 12px',
                        textAlign: 'left',
                        verticalAlign: 'middle',
                        position: 'relative',
                        fontWeight: '600',
                        color: '#111827',
                        fontSize: '14px'
                      }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <input
                            type="text"
                            value={player.firstName || ''}
                            onChange={(e) => updatePlayerField(player.id, 'firstName', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, player.id, 'firstName')}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '600',
                              background: '#ffffff',
                              color: '#111827',
                              transition: 'all 0.2s ease',
                              outline: 'none'
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = '#3b82f6';
                              e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                              e.target.select();
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = '#d1d5db';
                              e.target.style.boxShadow = 'none';
                            }}
                          />
                          
                          {/* Save Status Indicator */}
                          {savingStatus[`${player.id}-firstName`] && (
                            <div style={{
                              position: 'absolute',
                              top: '-8px',
                              right: '-8px',
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              ...(savingStatus[`${player.id}-firstName`] === 'saving' && {
                                backgroundColor: '#f59e0b',
                                color: 'white',
                                animation: 'pulse 1s infinite'
                              }),
                              ...(savingStatus[`${player.id}-firstName`] === 'saved' && {
                                backgroundColor: '#10b981',
                                color: 'white'
                              }),
                              ...(savingStatus[`${player.id}-firstName`] === 'error' && {
                                backgroundColor: '#ef4444',
                                color: 'white'
                              })
                            }}>
                              {savingStatus[`${player.id}-firstName`] === 'saving' && '⋯'}
                              {savingStatus[`${player.id}-firstName`] === 'saved' && '✓'}
                              {savingStatus[`${player.id}-firstName`] === 'error' && '✗'}
                            </div>
                          )}
                        </div>
                      </td>
                      
                      {/* Last Name */}
                      <td style={{ 
                        padding: '16px 12px',
                        textAlign: 'left',
                        verticalAlign: 'middle',
                        position: 'relative',
                        fontWeight: '600',
                        color: '#111827',
                        fontSize: '14px'
                      }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <input
                            type="text"
                            value={player.lastName || ''}
                            onChange={(e) => updatePlayerField(player.id, 'lastName', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, player.id, 'lastName')}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '600',
                              background: '#ffffff',
                              color: '#111827',
                              transition: 'all 0.2s ease',
                              outline: 'none'
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = '#3b82f6';
                              e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                              e.target.select();
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = '#d1d5db';
                              e.target.style.boxShadow = 'none';
                            }}
                          />
                          
                          {/* Save Status Indicator */}
                          {savingStatus[`${player.id}-lastName`] && (
                            <div style={{
                              position: 'absolute',
                              top: '-8px',
                              right: '-8px',
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              ...(savingStatus[`${player.id}-lastName`] === 'saving' && {
                                backgroundColor: '#f59e0b',
                                color: 'white',
                                animation: 'pulse 1s infinite'
                              }),
                              ...(savingStatus[`${player.id}-lastName`] === 'saved' && {
                                backgroundColor: '#10b981',
                                color: 'white'
                              }),
                              ...(savingStatus[`${player.id}-lastName`] === 'error' && {
                                backgroundColor: '#ef4444',
                                color: 'white'
                              })
                            }}>
                              {savingStatus[`${player.id}-lastName`] === 'saving' && '⋯'}
                              {savingStatus[`${player.id}-lastName`] === 'saved' && '✓'}
                              {savingStatus[`${player.id}-lastName`] === 'error' && '✗'}
                            </div>
                          )}
                        </div>
                      </td>
                      
                      {/* Lane */}
                      <td style={{ 
                        padding: '16px 12px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        position: 'relative',
                        fontWeight: '500',
                        color: player.lane ? '#111827' : '#9ca3af',
                        fontSize: '14px'
                      }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <input
                            type="text"
                            value={player.lane || ''}
                            onChange={(e) => updatePlayerField(player.id, 'lane', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, player.id, 'lane')}
                            placeholder="—"
                            style={{
                              width: '80px',
                              padding: '8px 28px 8px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              textAlign: 'center',
                              fontSize: '14px',
                              fontWeight: '500',
                              background: '#ffffff',
                              color: '#111827',
                              transition: 'all 0.2s ease',
                              outline: 'none'
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = '#3b82f6';
                              e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                              e.target.select();
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = '#d1d5db';
                              e.target.style.boxShadow = 'none';
                            }}
                          />
                          
                          {/* Increment/Decrement Arrows - Inside Input */}
                          <div style={{ 
                            position: 'absolute', 
                            right: '4px', 
                            top: '50%', 
                            transform: 'translateY(-50%)',
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '1px' 
                          }}>
                            <button
                              onClick={() => {
                                const currentLane = parseInt(player.lane || '0');
                                const newLane = currentLane + 1;
                                updatePlayerField(player.id, 'lane', newLane.toString());
                              }}
                              style={{
                                width: '14px',
                                height: '10px',
                                border: 'none',
                                borderRadius: '1px',
                                backgroundColor: 'transparent',
                                color: '#6b7280',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '8px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s ease',
                                outline: 'none'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                                e.currentTarget.style.color = '#374151';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = '#6b7280';
                              }}
                            >
                              ▲
                            </button>
                            <button
                              onClick={() => {
                                const currentLane = parseInt(player.lane || '0');
                                const newLane = Math.max(0, currentLane - 1);
                                updatePlayerField(player.id, 'lane', newLane.toString());
                              }}
                              style={{
                                width: '14px',
                                height: '10px',
                                border: 'none',
                                borderRadius: '1px',
                                backgroundColor: 'transparent',
                                color: '#6b7280',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '8px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s ease',
                                outline: 'none'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                                e.currentTarget.style.color = '#374151';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = '#6b7280';
                              }}
                            >
                              ▼
                            </button>
                          </div>
                          
                          {/* Save Status Indicator */}
                          {savingStatus[`${player.id}-lane`] && (
                            <div style={{
                              position: 'absolute',
                              top: '-8px',
                              right: '-8px',
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              ...(savingStatus[`${player.id}-lane`] === 'saving' && {
                                backgroundColor: '#f59e0b',
                                color: 'white',
                                animation: 'pulse 1s infinite'
                              }),
                              ...(savingStatus[`${player.id}-lane`] === 'saved' && {
                                backgroundColor: '#10b981',
                                color: 'white'
                              }),
                              ...(savingStatus[`${player.id}-lane`] === 'error' && {
                                backgroundColor: '#ef4444',
                                color: 'white'
                              })
                            }}>
                              {savingStatus[`${player.id}-lane`] === 'saving' && '⋯'}
                              {savingStatus[`${player.id}-lane`] === 'saved' && '✓'}
                              {savingStatus[`${player.id}-lane`] === 'error' && '✗'}
                            </div>
                          )}
                        </div>
                      </td>
                      
                      {/* Average */}
                      <td style={{ 
                        padding: '16px 12px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        position: 'relative',
                        fontWeight: '500',
                        color: '#111827',
                        fontSize: '14px'
                      }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <input
                            type="number"
                            value={player.average || ''}
                            onChange={(e) => updatePlayerField(player.id, 'average', Number(e.target.value))}
                            onKeyDown={(e) => handleKeyDown(e, player.id, 'average')}
                            min="0"
                            max="300"
                            style={{
                              width: '80px',
                              padding: '8px 28px 8px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              textAlign: 'center',
                              fontSize: '14px',
                              fontWeight: '500',
                              background: '#ffffff',
                              color: '#111827',
                              transition: 'all 0.2s ease',
                              outline: 'none'
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = '#3b82f6';
                              e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                              e.target.select();
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = '#d1d5db';
                              e.target.style.boxShadow = 'none';
                            }}
                          />
                          
                          {/* Increment/Decrement Arrows - Inside Input */}
                          <div style={{ 
                            position: 'absolute', 
                            right: '4px', 
                            top: '50%', 
                            transform: 'translateY(-50%)',
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '1px' 
                          }}>
                            <button
                              onClick={() => {
                                const currentAverage = player.average || 0;
                                const newAverage = Math.min(300, currentAverage + 1);
                                updatePlayerField(player.id, 'average', newAverage);
                              }}
                              style={{
                                width: '14px',
                                height: '10px',
                                border: 'none',
                                borderRadius: '1px',
                                backgroundColor: 'transparent',
                                color: '#6b7280',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '8px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s ease',
                                outline: 'none'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                                e.currentTarget.style.color = '#374151';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = '#6b7280';
                              }}
                            >
                              ▲
                            </button>
                            <button
                              onClick={() => {
                                const currentAverage = player.average || 0;
                                const newAverage = Math.max(0, currentAverage - 1);
                                updatePlayerField(player.id, 'average', newAverage);
                              }}
                              style={{
                                width: '14px',
                                height: '10px',
                                border: 'none',
                                borderRadius: '1px',
                                backgroundColor: 'transparent',
                                color: '#6b7280',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '8px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s ease',
                                outline: 'none'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                                e.currentTarget.style.color = '#374151';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = '#6b7280';
                              }}
                            >
                              ▼
                            </button>
                          </div>
                          
                          {/* Save Status Indicator */}
                          {savingStatus[`${player.id}-average`] && (
                            <div style={{
                              position: 'absolute',
                              top: '-8px',
                              right: '-8px',
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              ...(savingStatus[`${player.id}-average`] === 'saving' && {
                                backgroundColor: '#f59e0b',
                                color: 'white',
                                animation: 'pulse 1s infinite'
                              }),
                              ...(savingStatus[`${player.id}-average`] === 'saved' && {
                                backgroundColor: '#10b981',
                                color: 'white'
                              }),
                              ...(savingStatus[`${player.id}-average`] === 'error' && {
                                backgroundColor: '#ef4444',
                                color: 'white'
                              })
                            }}>
                              {savingStatus[`${player.id}-average`] === 'saving' && '⋯'}
                              {savingStatus[`${player.id}-average`] === 'saved' && '✓'}
                              {savingStatus[`${player.id}-average`] === 'error' && '✗'}
                            </div>
                          )}
                        </div>
                      </td>
                      
                      {/* Handicap */}
                      <td style={{ 
                        padding: '16px 12px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        position: 'relative',
                        fontWeight: '500',
                        color: '#111827',
                        fontSize: '14px'
                      }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <input
                            type="number"
                            value={player.handicap || ''}
                            onChange={(e) => updatePlayerField(player.id, 'handicap', Number(e.target.value))}
                            onKeyDown={(e) => handleKeyDown(e, player.id, 'handicap')}
                            min="0"
                            max="50"
                            style={{
                              width: '80px',
                              padding: '8px 28px 8px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              textAlign: 'center',
                              fontSize: '14px',
                              fontWeight: '500',
                              background: '#ffffff',
                              color: '#111827',
                              transition: 'all 0.2s ease',
                              outline: 'none'
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = '#3b82f6';
                              e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                              e.target.select();
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = '#d1d5db';
                              e.target.style.boxShadow = 'none';
                            }}
                          />
                          
                          {/* Increment/Decrement Arrows - Inside Input */}
                          <div style={{ 
                            position: 'absolute', 
                            right: '4px', 
                            top: '50%', 
                            transform: 'translateY(-50%)',
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '1px' 
                          }}>
                            <button
                              onClick={() => {
                                const currentHandicap = player.handicap || 0;
                                const newHandicap = Math.min(50, currentHandicap + 1);
                                updatePlayerField(player.id, 'handicap', newHandicap);
                              }}
                              style={{
                                width: '14px',
                                height: '10px',
                                border: 'none',
                                borderRadius: '1px',
                                backgroundColor: 'transparent',
                                color: '#6b7280',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '8px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s ease',
                                outline: 'none'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                                e.currentTarget.style.color = '#374151';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = '#6b7280';
                              }}
                            >
                              ▲
                            </button>
                            <button
                              onClick={() => {
                                const currentHandicap = player.handicap || 0;
                                const newHandicap = Math.max(0, currentHandicap - 1);
                                updatePlayerField(player.id, 'handicap', newHandicap);
                              }}
                              style={{
                                width: '14px',
                                height: '10px',
                                border: 'none',
                                borderRadius: '1px',
                                backgroundColor: 'transparent',
                                color: '#6b7280',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '8px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s ease',
                                outline: 'none'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                                e.currentTarget.style.color = '#374151';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = '#6b7280';
                              }}
                            >
                              ▼
                            </button>
                          </div>
                          
                          {/* Save Status Indicator */}
                          {savingStatus[`${player.id}-handicap`] && (
                            <div style={{
                              position: 'absolute',
                              top: '-8px',
                              right: '-8px',
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              ...(savingStatus[`${player.id}-handicap`] === 'saving' && {
                                backgroundColor: '#f59e0b',
                                color: 'white',
                                animation: 'pulse 1s infinite'
                              }),
                              ...(savingStatus[`${player.id}-handicap`] === 'saved' && {
                                backgroundColor: '#10b981',
                                color: 'white'
                              }),
                              ...(savingStatus[`${player.id}-handicap`] === 'error' && {
                                backgroundColor: '#ef4444',
                                color: 'white'
                              })
                            }}>
                              {savingStatus[`${player.id}-handicap`] === 'saving' && '⋯'}
                              {savingStatus[`${player.id}-handicap`] === 'saved' && '✓'}
                              {savingStatus[`${player.id}-handicap`] === 'error' && '✗'}
                            </div>
                          )}
                        </div>
                      </td>
                      
                      {/* Division */}
                      <td style={{ 
                        padding: '16px 12px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        position: 'relative',
                        fontWeight: '500',
                        color: '#111827',
                        fontSize: '14px'
                      }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <select
                            value={player.division || 'Open'}
                            onChange={(e) => updatePlayerField(player.id, 'division', e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontWeight: '500',
                              background: '#ffffff',
                              color: '#111827',
                              transition: 'all 0.2s ease',
                              outline: 'none'
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = '#3b82f6';
                              e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = '#d1d5db';
                              e.target.style.boxShadow = 'none';
                            }}
                          >
                            <option value="Open">Open</option>
                            <option value="Womens">Womens</option>
                            <option value="Senior">Senior</option>
                            <option value="Junior">Junior</option>
                          </select>
                          
                          {/* Save Status Indicator */}
                          {savingStatus[`${player.id}-division`] && (
                            <div style={{
                              position: 'absolute',
                              top: '-8px',
                              right: '-8px',
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              ...(savingStatus[`${player.id}-division`] === 'saving' && {
                                backgroundColor: '#f59e0b',
                                color: 'white',
                                animation: 'pulse 1s infinite'
                              }),
                              ...(savingStatus[`${player.id}-division`] === 'saved' && {
                                backgroundColor: '#10b981',
                                color: 'white'
                              }),
                              ...(savingStatus[`${player.id}-division`] === 'error' && {
                                backgroundColor: '#ef4444',
                                color: 'white'
                              })
                            }}>
                              {savingStatus[`${player.id}-division`] === 'saving' && '⋯'}
                              {savingStatus[`${player.id}-division`] === 'saved' && '✓'}
                              {savingStatus[`${player.id}-division`] === 'error' && '✗'}
                            </div>
                          )}
                        </div>
                      </td>
                      
                      {/* USBC */}
                      <td style={{ 
                        padding: '16px 12px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        position: 'relative',
                        fontWeight: '500',
                        color: player.usbc ? '#111827' : '#9ca3af',
                        fontSize: '14px'
                      }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <input
                            type="text"
                            value={player.usbc || ''}
                            onChange={(e) => updatePlayerField(player.id, 'usbc', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, player.id, 'usbc')}
                            placeholder="USBC #"
                            maxLength={8}
                            style={{
                              width: '120px',
                              padding: '8px 12px',
                              border: '1px solid #d1d5db',
                              borderRadius: '6px',
                              textAlign: 'center',
                              fontSize: '14px',
                              fontWeight: '500',
                              background: '#ffffff',
                              color: '#111827',
                              transition: 'all 0.2s ease',
                              outline: 'none'
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = '#3b82f6';
                              e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                              e.target.select();
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = '#d1d5db';
                              e.target.style.boxShadow = 'none';
                            }}
                          />
                          
                          {/* Save Status Indicator */}
                          {savingStatus[`${player.id}-usbc`] && (
                            <div style={{
                              position: 'absolute',
                              top: '-8px',
                              right: '-8px',
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              ...(savingStatus[`${player.id}-usbc`] === 'saving' && {
                                backgroundColor: '#f59e0b',
                                color: 'white',
                                animation: 'pulse 1s infinite'
                              }),
                              ...(savingStatus[`${player.id}-usbc`] === 'saved' && {
                                backgroundColor: '#10b981',
                                color: 'white'
                              }),
                              ...(savingStatus[`${player.id}-usbc`] === 'error' && {
                                backgroundColor: '#ef4444',
                                color: 'white'
                              })
                            }}>
                              {savingStatus[`${player.id}-usbc`] === 'saving' && '⋯'}
                              {savingStatus[`${player.id}-usbc`] === 'saved' && '✓'}
                              {savingStatus[`${player.id}-usbc`] === 'error' && '✗'}
                            </div>
                          )}
                        </div>
                      </td>
                      
                      {/* Actions */}
                      <td style={{ 
                        padding: '16px 12px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        fontSize: '14px'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={() => deletePlayer(player.id)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '500',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#dc2626';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#ef4444';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)';
                            }}
                          >
                            Delete
                          </button>
                          
                          {/* Save status indicator */}
                          {savingStatus[player.id] && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '4px 8px',
                              fontSize: '10px',
                              borderRadius: '4px',
                              fontWeight: '500',
                              backgroundColor: 
                                savingStatus[player.id] === 'saving' ? '#fef3c7' :
                                savingStatus[player.id] === 'saved' ? '#d1fae5' :
                                '#fee2e2',
                              color: 
                                savingStatus[player.id] === 'saving' ? '#92400e' :
                                savingStatus[player.id] === 'saved' ? '#065f46' :
                                '#991b1b'
                            }}>
                              {savingStatus[player.id] === 'saving' && 'Saving...'}
                              {savingStatus[player.id] === 'saved' && 'Saved'}
                              {savingStatus[player.id] === 'error' && 'Error'}
                            </span>
                          )}
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
      </div>
    </main>
  );
}

// Export with error boundary wrapper
function PlayersPage() {
  return (
    <ErrorBoundary>
      <PlayersPageContent />
    </ErrorBoundary>
  );
}

export default PlayersPage;