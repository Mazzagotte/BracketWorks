'use client'

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../lib/auth-context'
import { usePageHeader } from '../lib/header-context'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { API } from '../lib/api'

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
          <div style={{ marginBottom: '1rem', fontSize: '2rem' }}>🎳</div>
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
  const [tournament, setTournament] = useState<any>(null);
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
  
  const auth = useAuth();
  const isAuthenticated = auth && auth.isAuthenticated;
  const { token, user } = auth || {};

  // Function to fetch players
  const fetchPlayers = useCallback(async () => {
    const lastTournamentId = getItem('lastTournamentId');
    const authToken = getItem('token');
    
    if (!lastTournamentId || !authToken) return;
    
    setIsLoading(true);
    
    try {
      const bowlersUrl = selectedSquad 
        ? `/api/v1/bowlers/?tournament_id=${lastTournamentId}&squad_id=${selectedSquad.id}`
        : `/api/v1/bowlers/?tournament_id=${lastTournamentId}`;
      
      const response = await fetch(API(bowlersUrl), {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      const data = response.ok ? await response.json() : [];
      
      // Transform bowlers data to match our player structure
      const transformedData = (data || []).map((bowler: any) => {
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
      console.error('Error fetching bowlers:', err);
      setPlayers([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSquad, squads, getItem]);

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
      console.error('Error adding player:', err);
      alert('Failed to add player. Please try again.');
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
        🔄 Refresh
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
              const foundSquad = squadsData.find((s: any) => s.id === data.squad_id);
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

  if (!isAuthenticated) {
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
              <option value="Scratch">Scratch</option>
              <option value="Handicap">Handicap</option>
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
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Name</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Average</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Handicap</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Scratch</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Division</th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>USBC</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, index) => (
                  <tr key={player.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 8px', color: '#374151' }}>
                      {player.firstName} {player.lastName}
                    </td>
                    <td style={{ padding: '12px 8px', color: '#374151' }}>{player.average}</td>
                    <td style={{ padding: '12px 8px', color: '#374151' }}>{player.handicap}</td>
                    <td style={{ padding: '12px 8px', color: '#374151' }}>{player.scratch}</td>
                    <td style={{ padding: '12px 8px', color: '#374151' }}>{player.division}</td>
                    <td style={{ padding: '12px 8px', color: '#374151' }}>{player.usbc || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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