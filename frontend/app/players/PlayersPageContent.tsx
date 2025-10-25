'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'

import Link from 'next/link'

import { API } from '../lib/api'
import { usePageHeader } from '../lib/header-context'
import { MobileTable } from '../components/LazyComponents'
import { useAuth } from '../lib/auth-context'
import { logger, devLog } from '../lib/logger'
import { ErrorBoundary } from '../components/ErrorBoundary'
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

type Player = { id: number, usbc?: string, firstName: string, lastName: string, average: number, handicap: number, scratch: number, lane: string, division: string, totalCost: number, amountPaid: number, squad?: { id: number, date: string, time: string } }

export default function PlayersPageContent() {
  // Early return for SSR - must be before any hooks
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Early return for SSR - only render on client
  if (!isMounted) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading players...</div>;
  }

  return <PlayersPageInner />;
}

function PlayersPageInner() {
  // ALL HOOKS MUST BE CALLED FIRST - BEFORE ANY CONDITIONAL LOGIC
  
  // Track which cell is being edited
  const [editing, setEditing] = useState<{row: number, col: string} | null>(null);
  const [editValue, setEditValue] = useState<string | number>('');
  
  // Prevent duplicate saves with a Set of currently saving operations
  const [currentlySaving, setCurrentlySaving] = useState<Set<string>>(new Set());
  
  // Prevent immediate blur after starting edit
  const [justStartedEditing, setJustStartedEditing] = useState(false);

  // Rest of the component logic would go here...
  // For now, let's just return a simple placeholder
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Player Management</h2>
      <p>Players page is now client-side only</p>
    </div>
  );
}
