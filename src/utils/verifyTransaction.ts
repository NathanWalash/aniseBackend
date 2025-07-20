import { ethers } from 'ethers';

const AMOY_RPC_URL = 'https://polygon-amoy.infura.io/v3/e3899c2e9571490db9a718222ccf6649';

/**
 * Verifies a Polygon transaction by txHash.
 * @param txHash The transaction hash to verify
 * @param expectedTo (optional) The expected contract address
 * @param expectedEventSig (optional) The expected event signature (e.g., 'DAODeployed(address,address,string)')
 * @param abi (optional) ABI array to decode logs
 * @returns Decoded event data if found
 * @throws Error if verification fails
 */
export async function verifyTransaction({
  txHash,
  expectedTo,
  expectedEventSig,
  abi,
}: {
  txHash: string;
  expectedTo?: string;
  expectedEventSig?: string;
  abi?: any[];
}): Promise<any> {
  const provider = new ethers.JsonRpcProvider(AMOY_RPC_URL);
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) throw new Error('Transaction not found');
  if (receipt.status !== 1) throw new Error('Transaction failed');
  if (expectedTo && receipt.to?.toLowerCase() !== expectedTo.toLowerCase()) {
    throw new Error('Transaction sent to unexpected contract');
  }
  // If event signature and ABI provided, decode logs
  if (expectedEventSig && abi) {
    const iface = new ethers.Interface(abi);
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed && parsed.signature === expectedEventSig) {
          return parsed.args;
        }
      } catch (e) {
        // Not this event, continue
      }
    }
    throw new Error('Expected event not found in logs');
  }
  return receipt;
}

// Usage example (in controller):
// const eventData = await verifyTransaction({ txHash, expectedTo, expectedEventSig, abi }); 