import React, { useState, useEffect, useCallback } from 'react';
import { getBetsCount, getBet } from '../utils/soroban';
import BetCard from './BetCard';
import { SorobanBet } from '../utils/soroban';

interface BetListProps {
  publicKey: string;
}

const BetList: React.FC<BetListProps> = ({ publicKey }) => {
  const [bets, setBets] = useState<SorobanBet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBets = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const count = await getBetsCount();
      
      if (count === 0) {
        setBets([]);
        setIsLoading(false);
        return;
      }

      const betPromises: Promise<SorobanBet | null>[] = [];
      for (let i = 1; i <= count; i++) {
        betPromises.push(getBet(i));
      }
      
      const fetchedBets = (await Promise.all(betPromises)).filter(
        (bet): bet is SorobanBet => bet !== null
      );
      
      setBets(fetchedBets.reverse());
    } catch (error) {
      console.error('Error fetching bets:', error);
      setError('Failed to load bets. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBets();
    
    const interval = setInterval(fetchBets, 15000);
    return () => clearInterval(interval);
  }, [fetchBets]);

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p style={{ fontSize: '18px', color: '#666' }}>Loading bets...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px',
        backgroundColor: '#ffebee',
        borderRadius: '8px',
        color: '#c62828'
      }}>
        <p style={{ fontSize: '18px', fontWeight: 'bold' }}>⚠️ {error}</p>
        <button 
          onClick={fetchBets}
          style={{
            marginTop: '15px',
            padding: '10px 20px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: '#007bff',
            color: 'white',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (bets.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px'
      }}>
        <p style={{ fontSize: '18px', color: '#666' }}>
          📝 No bets have been created yet. Be the first to create one!
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{ margin: 0 }}>Active Bets ({bets.length})</h2>
        <button 
          onClick={fetchBets}
          disabled={isLoading}
          style={{
            padding: '8px 16px',
            borderRadius: '4px',
            border: '1px solid #007bff',
            backgroundColor: 'white',
            color: '#007bff',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          🔄 Refresh
        </button>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {bets.map((bet) => (
          <BetCard 
            key={bet.id} 
            bet={bet} 
            publicKey={publicKey}
            onUpdate={fetchBets}
          />
        ))}
      </div>
    </div>
  );
};

export default BetList;