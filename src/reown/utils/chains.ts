import { CaipNetwork } from '@reown/appkit'
import { hedera, hederaTestnet } from '@reown/appkit/networks'

export interface HederaNetwork extends CaipNetwork {
  chainId: string
  rpcUrl: string
  blockExplorer: string
}

export const mainnetConfig: HederaNetwork = {
  ...hedera,
  chainNamespace: 'eip155' as const,
  chainId: '295',
  id: 'eip155:295',
  name: 'Hedera Mainnet',
  rpcUrl: 'https://mainnet.hashio.io/api',
  blockExplorer: 'https://hashscan.io/mainnet',
  caipNetworkId: 'eip155:295',
  nativeCurrency: {
    name: 'HBAR',
    symbol: 'HBAR',
    decimals: 8,
  },
}

export const testnetConfig: HederaNetwork = {
  ...hederaTestnet,
  chainNamespace: 'eip155' as const,
  chainId: '296',
  id: 'eip155:296',
  name: 'Hedera Testnet',
  rpcUrl: 'https://testnet.hashio.io/api',
  blockExplorer: 'https://hashscan.io/testnet',
  caipNetworkId: 'eip155:296',
  nativeCurrency: {
    name: 'HBAR',
    symbol: 'HBAR',
    decimals: 8,
  },
}
