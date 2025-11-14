import {
  Transaction,
  rpc,
  scValToNative,
  nativeToScVal,
  xdr,
  TransactionBuilder,
  Address,
  Contract,
} from '@stellar/stellar-sdk';
import { getAddress, signTransaction } from '@stellar/freighter-api';

// --- Environment Variables ---
const CONTRACT_ID = process.env.REACT_APP_CONTRACT_ID!;
const TOKEN_ID = process.env.REACT_APP_TOKEN_ID!;
const RPC_URL = process.env.REACT_APP_RPC_URL!;
const NETWORK_PASSPHRASE = process.env.REACT_APP_NETWORK!;

// Stellar uses 7 decimal places (stroops)
const STROOP_MULTIPLIER = 10_000_000;

// --- Soroban Setup ---
const server = new rpc.Server(RPC_URL, { allowHttp: true });
const contract = new Contract(CONTRACT_ID);

// --- Custom Types ---
export interface SorobanBet {
  id: number;
  question: string;
  options: string[];
  oracle: string;
  is_resolved: boolean;
  winning_option?: number;
  total_pot: bigint;
  stakes: Map<string, [number, bigint]>;
}

/**
 * A generalized function to invoke a smart contract method.
 * Handles both read-only simulations and write transactions.
 */
async function invoke(
  method: string,
  params: xdr.ScVal[],
  readOnly: boolean = false
): Promise<any> {
  if (!CONTRACT_ID) {
    throw new Error('REACT_APP_CONTRACT_ID is not set in .env file');
  }

  const addressResult = await getAddress();
  const publicKey = addressResult.address;
  
  if (!publicKey) {
    throw new Error('Wallet not connected. Please connect your Freighter wallet.');
  }
  
  const source = await server.getAccount(publicKey);
  const op = contract.call(method, ...params);

  const tx = new TransactionBuilder(source, {
    fee: '1000000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(0)
    .build();

  if (readOnly) {
    const sim = await server.simulateTransaction(tx);
    
    if (rpc.Api.isSimulationSuccess(sim)) {
      return scValToNative(sim.result!.retval);
    }
    
    console.error('Simulation failed', sim);
    throw new Error('Read-only simulation failed');
  }

  // Write transactions
  const preparedTx = await server.prepareTransaction(tx);
  
  const signedResult = await signTransaction(preparedTx.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  const txToSubmit = TransactionBuilder.fromXDR(
    signedResult.signedTxXdr, 
    NETWORK_PASSPHRASE
  ) as Transaction;
  
  const sentTx = await server.sendTransaction(txToSubmit);

  if (sentTx.status === 'PENDING') {
    let getTxResponse = await server.getTransaction(sentTx.hash);

    while (getTxResponse.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      getTxResponse = await server.getTransaction(sentTx.hash);
    }
    
    if (getTxResponse.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      if (getTxResponse.resultMetaXdr) {
        const meta = getTxResponse.resultMetaXdr;
        
        if (meta.switch() === 3 && meta.v3().sorobanMeta()) {
          const returnValue = meta.v3().sorobanMeta()?.returnValue();
          if (returnValue) {
            return scValToNative(returnValue);
          }
        }
      }
      
      return null;
    }
    
    console.error('Transaction failed', getTxResponse);
    throw new Error(`Transaction failed with status: ${getTxResponse.status}`);
  }
  
  console.error('Failed to send transaction', sentTx);
  throw new Error(`Transaction failed to send with status: ${sentTx.status}`);
}

// --- Contract Interaction Functions (Write) ---

export async function createBet(
  publicKey: string, 
  question: string, 
  options: string[]
): Promise<number> {
  const params = [
    new Address(publicKey).toScVal(),
    nativeToScVal(question, { type: 'string' }),
    xdr.ScVal.scvVec(options.map(o => nativeToScVal(o, { type: 'string' }))), 
  ];
  return await invoke('create_bet', params, false);
}

export async function placeBet(
  publicKey: string, 
  betId: number, 
  optionIndex: number, 
  amount: number // Accept regular number, we'll convert to stroops
) {
  if (!TOKEN_ID) throw new Error('REACT_APP_TOKEN_ID is not set');
  
  // Convert to stroops (multiply by 10^7)
  const amountInStroops = BigInt(Math.floor(amount * STROOP_MULTIPLIER));
  
  const params = [
    new Address(publicKey).toScVal(),
    nativeToScVal(BigInt(betId), { type: 'u64' }),
    nativeToScVal(optionIndex, { type: 'u32' }),
    nativeToScVal(amountInStroops, { type: 'i128' }),
    new Address(TOKEN_ID).toScVal(),
  ];
  return await invoke('place_bet', params, false);
}

export async function resolveBet(
  publicKey: string, 
  betId: number, 
  winningOptionIndex: number
) {
  const params = [
    new Address(publicKey).toScVal(),
    nativeToScVal(BigInt(betId), { type: 'u64' }),
    nativeToScVal(winningOptionIndex, { type: 'u32' }),
  ];
  return await invoke('resolve_bet', params, false);
}

export async function claimWinnings(publicKey: string, betId: number) {
  if (!TOKEN_ID) throw new Error('REACT_APP_TOKEN_ID is not set');
  
  const params = [
    new Address(publicKey).toScVal(),
    nativeToScVal(BigInt(betId), { type: 'u64' }),
    new Address(TOKEN_ID).toScVal(),
  ];
  return await invoke('claim_winnings', params, false);
}

// --- Getter Functions (Read-Only) ---

function convertNativeBetToSorobanBet(nativeBet: any): SorobanBet {
  const stakes = new Map<string, [number, bigint]>();
  
  if (nativeBet.stakes && typeof nativeBet.stakes.forEach === 'function') {
    nativeBet.stakes.forEach((entry: any) => {
      stakes.set(entry.key.toString(), [entry.val[0], entry.val[1]]);
    });
  }

  return {
    id: Number(nativeBet.id),
    question: nativeBet.question,
    options: nativeBet.options,
    oracle: nativeBet.oracle.toString(),
    is_resolved: nativeBet.is_resolved,
    winning_option: nativeBet.winning_option !== undefined 
      ? Number(nativeBet.winning_option) 
      : undefined,
    total_pot: BigInt(nativeBet.total_pot),
    stakes: stakes,
  };
}

export async function getBet(betId: number): Promise<SorobanBet | null> {
  try {
    const params = [nativeToScVal(BigInt(betId), { type: 'u64' })];
    const result = await invoke('get_bet', params, true);
    
    if (!result) return null;
    return convertNativeBetToSorobanBet(result);
  } catch (e) {
    console.error(`Failed to get bet ${betId}:`, e);
    return null;
  }
}

export async function getBetsCount(): Promise<number> {
  try {
    const result = await invoke('get_bets_count', [], true);
    return Number(result || 0);
  } catch (e) {
    console.error('Failed to get bets count:', e);
    return 0;
  }
}

// Helper function to format token amounts for display
export function formatTokenAmount(stroops: bigint): string {
  const amount = Number(stroops) / STROOP_MULTIPLIER;
  return amount.toFixed(2);
}