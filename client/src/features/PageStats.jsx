import React from 'react';

export function PageStatCard({ label, value, highlight }) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid ' + (highlight ? 'var(--color-danger)' : 'var(--color-border)'),
      borderRadius: 'var(--radius)',
      padding: '1rem',
      boxShadow: 'var(--shadow-sm)',
      flex: '1 1 140px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      borderLeft: highlight ? '4px solid var(--color-danger)' : '1px solid var(--color-border)'
    }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: highlight ? 'var(--color-danger)' : 'var(--color-text)', lineHeight: '1' }}>
        {value}
      </div>
    </div>
  );
}

export function PageStatsRow({ children }) {
  return (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
      {children}
    </div>
  );
}
