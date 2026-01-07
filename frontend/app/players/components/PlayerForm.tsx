import React, { memo, useState } from 'react';

import { PlayerFormProps } from '../types';

const PlayerForm = memo(({ onAddPlayer, isLoading, squads, entryFee }: PlayerFormProps) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    usbc: '',
    average: 150,
    handicap: 0,
    scratch: 0,
    lane: 'A1',
    division: 'Open',
    amountPaid: 0
  });

  const handleSubmit = (e: React.FormEvent) => { 
    e.preventDefault();
    
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      alert('Please enter both first and last name');
      return;
    }

    const totalCost = (formData.scratch + formData.handicap) * entryFee;
    
    onAddPlayer({
      ...formData,
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      totalCost
    });

    // Reset form
    setFormData({
      firstName: '',
      lastName: '',
      usbc: '',
      average: 150,
      handicap: 0,
      scratch: 0,
      lane: 'A1',
      division: 'Open',
      amountPaid: 0
    });
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    boxSizing: 'border-box',
    height: '36px',
    lineHeight: '1.2'
  };

  const selectStyle: React.CSSProperties = {
    ...fieldStyle,
    height: '36px',
    minHeight: '36px',
    maxHeight: '36px',
    paddingTop: '0.35rem',
    paddingBottom: '0.35rem',
    lineHeight: '1',
    appearance: 'none',
    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%235E6B75\' d=\'M7 10l5 5 5-5z\'/%3E%3C/svg%3E")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.5rem center',
    backgroundSize: '12px',
    paddingRight: '2rem'
  };

  return (
    <div style={{ 
      padding: '1.5rem',
      backgroundColor: 'white', 
      borderRadius: '0.5rem',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
      marginBottom: '2rem' 
    }}>
      <h3 style={{ 
        fontSize: '1.125rem', 
        fontWeight: '600', 
        marginBottom: '1rem',
        color: '#111827'
      }}>
        Add New Player
      </h3>
      
      <form onSubmit={handleSubmit}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1rem',
          marginBottom: '1rem'
        }}>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '0.875rem', 
              fontWeight: '500',
              marginBottom: '0.25rem',
              color: '#374151'
            }}>
              First Name *
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(changeEvent) => handleInputChange('firstName', changeEvent.target.value)}
              style={fieldStyle}
              required
            />
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '0.875rem', 
              fontWeight: '500',
              marginBottom: '0.25rem',
              color: '#374151'
            }}>
              Last Name *
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(changeEvent) => handleInputChange('lastName', changeEvent.target.value)}
              style={fieldStyle}
              required
            />
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '0.875rem', 
              fontWeight: '500',
              marginBottom: '0.25rem',
              color: '#374151'
            }}>
              USBC Number
            </label>
            <input
              type="text"
              value={formData.usbc}
              onChange={(changeEvent) => handleInputChange('usbc', changeEvent.target.value)}
              style={fieldStyle}
              maxLength={8}
              placeholder="8 digits"
            />
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '0.875rem', 
              fontWeight: '500',
              marginBottom: '0.25rem',
              color: '#374151'
            }}>
              Average
            </label>
            <input
              type="number"
              value={formData.average}
              onChange={(changeEvent) => handleInputChange('average', parseInt(changeEvent.target.value) || 0)}
              style={fieldStyle}
              min="0"
              max="300"
            />
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '0.875rem', 
              fontWeight: '500',
              marginBottom: '0.25rem',
              color: '#374151'
            }}>
              Lane
            </label>
            <input
              type="text"
              value={formData.lane}
              onChange={(changeEvent) => handleInputChange('lane', changeEvent.target.value)}
              style={fieldStyle}
              placeholder="A1"
            />
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '0.875rem', 
              fontWeight: '500',
              marginBottom: '0.25rem',
              color: '#374151'
            }}>
              Division
            </label>
            <select
              value={formData.division}
              onChange={(changeEvent) => handleInputChange('division', changeEvent.target.value)}
              style={selectStyle}
            >
              <option value="Open">Open</option>
              <option value="Womens">Womens</option>
              <option value="Senior">Senior</option>
              <option value="Junior">Junior</option>
            </select>
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '0.875rem', 
              fontWeight: '500',
              marginBottom: '0.25rem',
              color: '#374151'
            }}>
              Handicap Brackets
            </label>
            <input
              type="number"
              value={formData.handicap}
              onChange={(changeEvent) => handleInputChange('handicap', parseInt(changeEvent.target.value) || 0)}
              style={fieldStyle}
              min="0"
            />
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '0.875rem', 
              fontWeight: '500',
              marginBottom: '0.25rem',
              color: '#374151'
            }}>
              Scratch Brackets
            </label>
            <input
              type="number"
              value={formData.scratch}
              onChange={(changeEvent) => handleInputChange('scratch', parseInt(changeEvent.target.value) || 0)}
              style={fieldStyle}
              min="0"
            />
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '0.875rem', 
              fontWeight: '500',
              marginBottom: '0.25rem',
              color: '#374151'
            }}>
              Amount Paid
            </label>
            <input
              type="number"
              value={formData.amountPaid}
              onChange={(changeEvent) => handleInputChange('amountPaid', parseFloat(changeEvent.target.value) || 0)}
              style={fieldStyle}
              min="0"
              step="0.01"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            padding: '0.75rem 1.5rem',
            border: 'none',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.5 : 1
          }}
        >
          {isLoading ? 'Adding...' : 'Add Player'}
        </button>
      </form>
    </div>
  );
});

PlayerForm.displayName = 'PlayerForm';

export default PlayerForm;

