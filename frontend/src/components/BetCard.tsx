import React, { useState } from 'react';
import { SorobanBet, placeBet, resolveBet, claimWinnings, formatTokenAmount } from '../utils/soroban';

interface BetCardProps {
  bet: SorobanBet;
  publicKey: string;
  onUpdate: () => void;
}

const BetCard: React.FC<BetCardProps> = ({ bet, publicKey, onUpdate }) => {
  const [amount, setAmount] = useState<string>('10');
  const [isLoading, setIsLoading] = useState(false);

  const handlePlaceBet = async (optionIndex: number) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid amount greater than 0');
      return;
    }

    setIsLoading(true);
    try {
      await placeBet(publicKey, bet.id, optionIndex, numAmount);
      alert(`Bet of ${numAmount} tokens placed successfully on "${bet.options[optionIndex]}"!`);
      onUpdate();
    } catch (error) {
      console.error('Error placing bet:', error);
      alert(`Failed to place bet: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolve = async (winningOptionIndex: number) => {
    if (!window.confirm(`Are you sure you want to resolve this bet with "${bet.options[winningOptionIndex]}" as the winner?`)) {
      return;
    }

    setIsLoading(true);
    try {
      await resolveBet(publicKey, bet.id, winningOptionIndex);
      alert('Bet resolved successfully!');
      onUpdate();
    } catch (error) {
      console.error('Error resolving bet:', error);
      alert(`Failed to resolve bet: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaim = async () => {
    setIsLoading(true);
    try {
      await claimWinnings(publicKey, bet.id);
      alert('Winnings claimed successfully!');
      onUpdate();
    } catch (error) {
      console.error('Error claiming winnings:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      if (errorMsg.includes('Claimer did not place a bet')) {
        alert('You did not place a bet on this prediction.');
      } else if (errorMsg.includes('not yet resolved')) {
        alert('This bet has not been resolved yet.');
      } else {
        alert(`Failed to claim winnings: ${errorMsg}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isOracle = publicKey === bet.oracle;
  const winningOption = bet.winning_option !== undefined ? Number(bet.winning_option) : null;
  const userStake = bet.stakes.get(publicKey);

  return (
    <div className="card" style={{ 
      border: bet.is_resolved ? '2px solid #28a745' : '2px solid #ffc107',
      padding: '20px',
      borderRadius: '8px',
      backgroundColor: '#fff'
    }}>
      <h3 style={{ marginTop: 0 }}>{bet.question}</h3>
      <p style={{ color: '#666', fontSize: '14px' }}>Bet ID: {bet.id}</p>
      
      <div style={{ marginBottom: '15px' }}>
        <p><strong>Total Pot:</strong> {formatTokenAmount(bet.total_pot)} BET tokens</p>
        <p><strong>Status:</strong> {bet.is_resolved ? `✅ Resolved - Winner: "${bet.options[winningOption!]}"` : '⏳ Open for betting'}</p>
        {isOracle && <p style={{ color: '#17a2b8', fontWeight: 'bold' }}>🔮 You are the oracle for this bet</p>}
        {userStake && (
          <p style={{ color: '#28a745', fontWeight: 'bold' }}>
            💰 Your bet: {formatTokenAmount(userStake[1])} BET on "{bet.options[userStake[0]]}"
          </p>
        )}
      </div>
      
      <div style={{ marginTop: '1rem' }}>
        <h4>Options:</h4>
        {bet.options.map((option, index) => {
          const isWinner = bet.is_resolved && index === winningOption;
          const isUserChoice = userStake && userStake[0] === index;
          
          return (
            <div 
              key={index} 
              style={{ 
                padding: '15px', 
                marginBottom: '10px', 
                borderRadius: '5px',
                backgroundColor: isWinner ? '#d4edda' : isUserChoice ? '#fff3cd' : '#f8f9fa',
                border: isWinner ? '2px solid #28a745' : '1px solid #ddd',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span style={{ fontWeight: isWinner ? 'bold' : 'normal' }}>
                {isWinner && '🏆 '}{option}
              </span>
              
              {!bet.is_resolved && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input 
                    type="number" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)}
                    style={{ 
                      width: '100px', 
                      padding: '5px',
                      borderRadius: '4px',
                      border: '1px solid #ccc'
                    }}
                    placeholder="Amount"
                    disabled={isLoading || userStake !== undefined}
                    min="0"
                    step="0.01"
                  />
                  <button 
                    onClick={() => handlePlaceBet(index)} 
                    disabled={isLoading || userStake !== undefined}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: userStake !== undefined ? '#ccc' : '#007bff',
                      color: 'white',
                      cursor: userStake !== undefined ? 'not-allowed' : 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    {userStake !== undefined ? 'Bet Placed' : 'Place Bet'}
                  </button>
                  
                  {isOracle && (
                    <button 
                      onClick={() => handleResolve(index)} 
                      disabled={isLoading}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '4px',
                        border: 'none',
                        backgroundColor: '#17a2b8',
                        color: 'white',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      Set as Winner
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {bet.is_resolved && userStake && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e7f3ff', borderRadius: '5px' }}>
          <button 
            onClick={handleClaim} 
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: '#28a745',
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            {isLoading ? 'Processing...' : '💰 Claim Winnings'}
          </button>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '8px', marginBottom: 0 }}>
            Click to claim your share of the pot if you won
          </p>
        </div>
      )}
    </div>
  );
};

export default BetCard;