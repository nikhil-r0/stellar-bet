import React, { useState, useEffect } from 'react';
import { isConnected, getAddress, requestAccess } from '@stellar/freighter-api';

interface ConnectWalletProps {
  setPublicKey: (publicKey: string) => void;
}

const ConnectWallet: React.FC<ConnectWalletProps> = ({ setPublicKey }) => {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const connected = await isConnected();
      if (connected) {
        const result = await getAddress();
        if (result && result.address) {
          setAddress(result.address);
          setPublicKey(result.address);
          setConnected(true);
        }
      }
    } catch (e) {
      console.error('Error checking connection:', e);
    }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // First check if Freighter is installed
      const freighterInstalled = await isConnected();
      
      if (!freighterInstalled) {
        setError('Freighter wallet is not installed. Please install it from the Chrome Web Store or Firefox Add-ons.');
        setIsLoading(false);
        return;
      }

      // Request access to the wallet
      const accessResult = await requestAccess();
      
      if (accessResult.error) {
        setError(`Failed to connect: ${accessResult.error}`);
        setIsLoading(false);
        return;
      }

      // Get the address
      const addressResult = await getAddress();
      
      if (addressResult && addressResult.address) {
        setAddress(addressResult.address);
        setPublicKey(addressResult.address);
        setConnected(true);
        console.log('Connected with address:', addressResult.address);
      } else {
        setError('Failed to get wallet address');
      }
    } catch (e) {
      console.error('Connection error:', e);
      setError(`Error connecting to wallet: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    setConnected(false);
    setAddress('');
    setPublicKey('');
  };

  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#f8f9fa', 
      borderRadius: '8px',
      marginBottom: '20px'
    }}>
      <h2 style={{ marginTop: 0 }}>Connect Wallet</h2>
      
      {error && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#ffebee', 
          color: '#c62828',
          borderRadius: '4px',
          marginBottom: '15px'
        }}>
          <strong>Error:</strong> {error}
          {error.includes('not installed') && (
            <div style={{ marginTop: '10px' }}>
              <a 
                href="https://www.freighter.app/" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: '#1976d2', textDecoration: 'underline' }}
              >
                Download Freighter Wallet
              </a>
            </div>
          )}
        </div>
      )}

      {connected ? (
        <div>
          <div style={{ 
            padding: '15px', 
            backgroundColor: '#d4edda', 
            borderRadius: '4px',
            marginBottom: '15px'
          }}>
            <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#155724' }}>
              ✅ Wallet Connected
            </p>
            <p style={{ 
              margin: 0, 
              fontFamily: 'monospace', 
              fontSize: '14px',
              wordBreak: 'break-all',
              color: '#155724'
            }}>
              {address}
            </p>
          </div>
          <button 
            onClick={handleDisconnect}
            style={{
              padding: '10px 20px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: '#dc3545',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div>
          <p style={{ color: '#666', marginBottom: '15px' }}>
            Connect your Freighter wallet to interact with the betting contract.
          </p>
          <button 
            onClick={handleConnect}
            disabled={isLoading}
            style={{
              padding: '12px 24px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: isLoading ? '#ccc' : '#007bff',
              color: 'white',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '16px'
            }}
          >
            {isLoading ? 'Connecting...' : '🔗 Connect with Freighter'}
          </button>
          
          <div style={{ marginTop: '15px', fontSize: '14px', color: '#666' }}>
            <p>Don't have Freighter?</p>
            <a 
              href="https://www.freighter.app/" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#007bff', textDecoration: 'underline' }}
            >
              Install Freighter Wallet Extension
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectWallet;