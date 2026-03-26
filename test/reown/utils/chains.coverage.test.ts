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
      hedera: {
        methods: ['hedera_signMessage'],
        chains: ['hedera:testnet'],
        events: [],
      },
    }
    const result = mergeRequiredOptionalNamespaces({}, optional)
    expect(result.hedera).toEqual(optional.hedera)
  })

  test('mergeRequiredOptionalNamespaces handles undefined params', () => {
    // call with no arguments to use default parameters
    expect(mergeRequiredOptionalNamespaces()).toEqual({})

    // optional methods undefined triggers default branch in merge
    const required = { hedera: { chains: ['hedera:testnet'] } }
    const optional = { hedera: { events: ['evt'] } }
    const result = mergeRequiredOptionalNamespaces(required, optional)
    expect(result.hedera).toEqual({
      chains: ['hedera:testnet'],
      events: ['evt'],
      methods: [],
    })
  })

  test('mergeRequiredOptionalNamespaces merges with existing methods/events', () => {
    const required = {
      hedera: {
        methods: ['meth1'],
        events: ['e1'],
        chains: ['hedera:mainnet'],
      },
    }
    const optional = {
      hedera: {
        chains: ['hedera:testnet'],
      },
    }
    const result = mergeRequiredOptionalNamespaces(required, optional)
    expect(result.hedera).toEqual({
      methods: ['meth1'],
      events: ['e1'],
      chains: ['hedera:testnet', 'hedera:mainnet'],
    })
  })

  test('merge handles falsy optional methods', () => {
    const required = {
      hedera: { methods: ['a'], chains: ['hedera:mainnet'], events: [] },
    }
    const optional = {
      hedera: { methods: null as any },
    }
    const result = mergeRequiredOptionalNamespaces(required, optional as any)
    expect(result.hedera.methods).toEqual(['a'])
  })
})
