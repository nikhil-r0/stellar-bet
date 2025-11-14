import React, { useState } from 'react';
import './App.css';
import ConnectWallet from './components/ConnectWallet';
import CreateBetForm from './components/CreateBetForm';
import BetList from './components/BetList';

function App() {
  const [publicKey, setPublicKey] = useState<string>('');

  return (
    <div className="App">
      <header className="App-header">
        <h1>Stellar Soroban Betting DApp</h1>
      </header>
      <div className="container">
        <div className="card">
          <ConnectWallet setPublicKey={setPublicKey} />
          {publicKey && <p>Your Public Key: <code>{publicKey}</code></p>}
        </div>
        {publicKey && (
          <>
            <div className="card">
              <CreateBetForm publicKey={publicKey} />
            </div>
            <div className="card">
              <h2>Active Bets</h2>
              <BetList publicKey={publicKey} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
