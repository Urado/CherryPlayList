import React from 'react';

interface TestZoneProps {
  zoneId: string;
  label: string;
}

/**
 * Тестовый компонент для отображения тестовых зон
 */
export const TestZone: React.FC<TestZoneProps> = ({ zoneId, label }) => {
  return (
    <div
      style={{
        padding: '20px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-tertiary)',
        border: '2px dashed var(--ui-border)',
      }}
    >
      <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-primary)' }}>{label}</h3>
      <p style={{ margin: '0', color: 'var(--text-secondary)', fontSize: '12px' }}>
        Zone ID: {zoneId}
      </p>
    </div>
  );
};
