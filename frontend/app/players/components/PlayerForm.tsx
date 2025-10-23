import React, { memo, useState } from 'react';

import { PlayerFormProps } from '../types';

const PlayerForm = memo(({ onAddPlayer, isLoading, squads }: PlayerFormProps) => {
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

    const totalCost = (formData.scratch + formData.handicap) * 25;
    
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
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
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
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
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
              onChange={(e) => handleInputChange('usbc', e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
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
              onChange={(e) => handleInputChange('average', parseInt(e.target.value) || 0)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
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
              onChange={(e) => handleInputChange('lane', e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
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
              onChange={(e) => handleInputChange('division', e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
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
              onChange={(e) => handleInputChange('handicap', parseInt(e.target.value) || 0)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
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
              onChange={(e) => handleInputChange('scratch', parseInt(e.target.value) || 0)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
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
              onChange={(e) => handleInputChange('amountPaid', parseFloat(e.target.value) || 0)}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem'
              }}
              min="0"
              step="0.01"
            />
          </div>
        </div>

        <div style={{ 
          padding: '1rem',
          backgroundColor: '#f9fafb',
          borderRadius: '0.375rem',
          marginBottom: '1rem'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            <strong>Total Cost:</strong> ${((formData.scratch + formData.handicap) * 25).toFixed(2)} 
            ({formData.scratch} scratch + {formData.handicap} handicap × $25)
          </div>
          <div style={{ fontSize: '0.875rem', color: formData.amountPaid >= (formData.scratch + formData.handicap) * 25 ? '#10b981' : '#ef4444', marginTop: '0.25rem' }}>
            <strong>Balance:</strong> ${(((formData.scratch + formData.handicap) * 25) - formData.amountPaid).toFixed(2)}
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