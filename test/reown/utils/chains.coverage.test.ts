import { CaipNetworkId } from '@reown/appkit-common'
import { HederaChainDefinition, createNamespaces, mergeRequiredOptionalNamespaces } from '../../../src/reown/utils/chains'

// Custom network with no rpc url to trigger branch where rpcUrl is falsy
const customNetwork = {
  ...HederaChainDefinition.Native.Mainnet,
  id: 'custom',
  caipNetworkId: 'hedera:custom' as CaipNetworkId,
  rpcUrls: {
    default: { http: [] },
  },
} as any

// Previously this file mutated the global coverage object to artificially bump
// branch counts. The tests below now execute the relevant code paths
// directly so no manual manipulation is required.

describe('Chain Utilities additional coverage', () => {
  test('createNamespaces handles multiple networks', () => {
    const result = createNamespaces([
      HederaChainDefinition.Native.Mainnet,
      HederaChainDefinition.Native.Testnet,
    ] as any)

    expect(result.hedera.chains).toEqual(['hedera:mainnet', 'hedera:testnet'])
    expect(result.hedera.rpcMap).toEqual({
      mainnet: 'https://mainnet.hashio.io/api',
      testnet: 'https://testnet.hashio.io/api',
    })
  })

  test('createNamespaces skips rpc assignment without url', () => {
    const result = createNamespaces([customNetwork] as any)
    expect(result.hedera.chains).toEqual(['hedera:custom'])
    expect(result.hedera.rpcMap).toEqual({})
  })

  test('mergeRequiredOptionalNamespaces adds new namespace', () => {
    const optional = {
      eip155: {
        methods: ['eth_sendTransaction'],
        chains: ['eip155:1'],
        events: [],
      },
    }
    const result = mergeRequiredOptionalNamespaces({}, optional)
    expect(result.eip155).toEqual(optional.eip155)
  })

  test('mergeRequiredOptionalNamespaces handles undefined params', () => {
    // call with no arguments to use default parameters
    expect(mergeRequiredOptionalNamespaces()).toEqual({})

    // optional methods undefined triggers default branch in merge
    const required = { eip155: { chains: ['eip155:1'] } }
    const optional = { eip155: { events: ['evt'] } }
    const result = mergeRequiredOptionalNamespaces(required, optional)
    expect(result.eip155).toEqual({
      chains: ['eip155:1'],
      events: ['evt'],
      methods: [],
    })
  })

  test('mergeRequiredOptionalNamespaces merges with existing methods/events', () => {
    const required = {
      eip155: {
        methods: ['meth1'],
        events: ['e1'],
        chains: ['eip155:1'],
      },
    }
    const optional = {
      eip155: {
        chains: ['eip155:2'],
      },
    }
    const result = mergeRequiredOptionalNamespaces(required, optional)
    expect(result.eip155).toEqual({
      methods: ['meth1'],
      events: ['e1'],
      chains: ['eip155:2', 'eip155:1'],
    })
  })

  test('merge handles falsy optional methods', () => {
    const required = {
      eip155: { methods: ['a'], chains: ['eip155:1'], events: [] },
    }
    const optional = {
      eip155: { methods: null as any },
    }
    const result = mergeRequiredOptionalNamespaces(required, optional as any)
    expect(result.eip155.methods).toEqual(['a'])
  })
})
