import { WcHelpersUtil } from '@reown/appkit'
import { CaipNetwork, CaipNetworkId, ChainNamespace } from '@reown/appkit-common'
import { defineChain } from '@reown/appkit/networks'
import { Namespace, NamespaceConfig } from '@walletconnect/universal-provider'
import { ProposalTypes } from '@walletconnect/types'
import { mergeArrays, normalizeNamespaces } from '@walletconnect/utils'
import { HederaJsonRpcMethod } from '../..'

export const hederaNamespace = 'hedera' as ChainNamespace

export const HederaChainDefinition = {
  Native: {
    Mainnet: defineChain({
      id: 'mainnet',
      chainNamespace: hederaNamespace,
      caipNetworkId: 'hedera:mainnet' as CaipNetworkId,
      name: 'Hedera Mainnet',
      nativeCurrency: {
        symbol: 'ℏ',
        name: 'HBAR',
        decimals: 8,
      },
      rpcUrls: {
        default: {
          http: ['https://mainnet.hashio.io/api'],
        },
      },
      blockExplorers: {
        default: {
          name: 'Hashscan',
          url: 'https://hashscan.io/mainnet',
        },
      },
      testnet: false,
    }) as CaipNetwork,
    Testnet: defineChain({
      id: 'testnet',
      chainNamespace: hederaNamespace,
      caipNetworkId: 'hedera:testnet' as CaipNetworkId,
      name: 'Hedera Testnet',
      nativeCurrency: {
        symbol: 'ℏ',
        name: 'HBAR',
        decimals: 8,
      },
      rpcUrls: {
        default: {
          http: ['https://testnet.hashio.io/api'],
        },
      },
      blockExplorers: {
        default: {
          name: 'Hashscan',
          url: 'https://hashscan.io/testnet',
        },
      },
      testnet: true,
    }) as CaipNetwork,
  },
  EVM: {
    Mainnet: defineChain({
      id: 295,
      name: 'Hedera Mainnet EVM',
      chainNamespace: 'eip155',
      caipNetworkId: 'eip155:295',
      nativeCurrency: {
        symbol: 'ℏ',
        name: 'HBAR',
        decimals: 18,
      },
      rpcUrls: {
        default: {
          http: ['https://mainnet.hashio.io/api'],
        },
      },
      blockExplorers: {
        default: {
          name: 'Hashscan',
          url: 'https://hashscan.io/testnet',
        },
      },
      testnet: false,
    }) as CaipNetwork,
    Testnet: defineChain({
      id: 296,
      name: 'Hedera Testnet EVM',
      chainNamespace: 'eip155',
      caipNetworkId: 'eip155:296',
      nativeCurrency: {
        symbol: 'ℏ',
        name: 'HBAR',
        decimals: 18,
      },
      rpcUrls: {
        default: {
          http: ['https://testnet.hashio.io/api'],
        },
      },
      blockExplorers: {
        default: {
          name: 'Hashscan',
          url: 'https://hashscan.io/testnet',
        },
      },
      testnet: true,
    }) as CaipNetwork,
  },
}

// Support Hedera Networks
export function createNamespaces(caipNetworks: CaipNetwork[]): NamespaceConfig {
  return caipNetworks.reduce<NamespaceConfig>((acc, chain) => {
    const { id, chainNamespace, rpcUrls } = chain
    const rpcUrl = rpcUrls.default.http[0]

    const methods: string[] =
      chainNamespace == ('hedera' as ChainNamespace)
        ? Object.values(HederaJsonRpcMethod)
        : WcHelpersUtil.getMethodsByChainNamespace(chainNamespace)

    if (!acc[chainNamespace]) {
      acc[chainNamespace] = {
        methods,
        events: ['accountsChanged', 'chainChanged'],
        chains: [] as string[],
        rpcMap: {},
      } satisfies Namespace
    }

    const caipNetworkId = `${chainNamespace}:${id}`

    const namespace = acc[chainNamespace] as Namespace

    namespace.chains.push(caipNetworkId)

    if (namespace?.rpcMap && rpcUrl) {
      namespace.rpcMap[id] = rpcUrl
    }

    return acc
  }, {})
}

export function getChainsFromApprovedSession(accounts: string[]): string[] {
  return accounts.map((address) => `${address.split(':')[0]}:${address.split(':')[1]}`)
}

export function getChainId(chain: string): string {
  return chain.includes(':') ? chain.split(':')[1] : chain
}

export function mergeRequiredOptionalNamespaces(
  required: ProposalTypes.RequiredNamespaces = {},
  optional: ProposalTypes.RequiredNamespaces = {},
) {
  const requiredNamespaces = normalizeNamespaces(required)
  const optionalNamespaces = normalizeNamespaces(optional)
  return merge(requiredNamespaces, optionalNamespaces)
}

function merge<T extends ProposalTypes.RequiredNamespaces>(
  requiredNamespaces: T,
  optionalNamespaces: T,
): T {
  const merged: ProposalTypes.RequiredNamespaces = { ...requiredNamespaces }

  for (const [namespace, values] of Object.entries(optionalNamespaces)) {
    if (!merged[namespace]) {
      merged[namespace] = values
    } else {
      merged[namespace] = {
        ...merged[namespace],
        ...values,
        chains: mergeArrays(values.chains, merged[namespace]?.chains),
        methods: mergeArrays(values.methods || [], merged[namespace]?.methods || []),
        events: mergeArrays(values.events || [], merged[namespace]?.events || []),
      }
    }
  }

  return merged as T
}
