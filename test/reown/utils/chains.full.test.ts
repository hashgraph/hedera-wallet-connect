import { CaipNetwork } from '@reown/appkit-common'
import {
  HederaChainDefinition,
  createNamespaces,
  getChainsFromApprovedSession,
  getChainId,
  hederaNamespace,
  mergeRequiredOptionalNamespaces,
} from '../../../src/reown/utils/chains'
import { HederaChainId } from '../../../src'

describe('chains full branch coverage', () => {
  test('createNamespaces handles all known and unknown chains', () => {
    const unknownNetwork = {
      id: 'foo',
      chainNamespace: 'unknown',
      caipNetworkId: 'unknown:foo',
      rpcUrls: { default: { http: ['https://unknown'] } },
    } as unknown as CaipNetwork

    const noRpcNetwork = {
      id: 'noRpc',
      chainNamespace: hederaNamespace,
      caipNetworkId: 'hedera:noRpc',
      rpcUrls: { default: { http: [] as string[] } },
    } as unknown as CaipNetwork

    const result = createNamespaces([
      HederaChainDefinition.Native.Mainnet,
      HederaChainDefinition.Native.Testnet,
      HederaChainDefinition.EVM.Mainnet,
      HederaChainDefinition.EVM.Testnet,
      noRpcNetwork,
      unknownNetwork,
    ] as CaipNetwork[])

    expect(result.hedera.chains).toEqual([
      'hedera:mainnet',
      'hedera:testnet',
      'hedera:noRpc',
    ])
    expect(result.hedera.rpcMap).toEqual({
      mainnet: 'https://mainnet.hashio.io/api',
      testnet: 'https://testnet.hashio.io/api',
    })

    expect(result.eip155.chains).toEqual(['eip155:295', 'eip155:296'])
    expect(result.eip155.rpcMap).toEqual({
      '295': 'https://mainnet.hashio.io/api',
      '296': 'https://testnet.hashio.io/api',
    })

    expect(result.unknown.methods).toEqual([])
    expect(result.unknown.rpcMap).toEqual({ foo: 'https://unknown' })
    expect(result.unknown.chains).toEqual(['unknown:foo'])
  })

  test('mergeRequiredOptionalNamespaces merges optional arrays with existing namespace', () => {
    const required = {
      hedera: {
        methods: ['reqM'],
        events: ['reqE'],
        chains: ['hedera:mainnet'],
      },
    }
    const optional = {
      hedera: {
        methods: ['optM'],
        events: ['optE'],
        chains: ['hedera:testnet'],
      },
    }
    const result = mergeRequiredOptionalNamespaces(required, optional)

    expect(result.hedera.methods).toEqual(['optM', 'reqM'])
    expect(result.hedera.events).toEqual(['optE', 'reqE'])
    expect(result.hedera.chains).toEqual(['hedera:testnet', 'hedera:mainnet'])
  })

  test('getChainId handles all known and unknown chain ids', () => {
    Object.values(HederaChainId).forEach((id) => {
      expect(getChainId(id)).toBe(id.split(':')[1])
    })
    expect(getChainId('foo')).toBe('foo')
    expect(getChainId('bar:baz')).toBe('baz')
  })

  test('getChainsFromApprovedSession extracts chains from any account', () => {
    const accounts = [
      `${HederaChainId.Mainnet}:0.0.1`,
      `${HederaChainId.Testnet}:0.0.2`,
      `${HederaChainId.Previewnet}:0.0.3`,
      `${HederaChainId.Devnet}:0.0.4`,
      'foo:bar:0x123',
    ]
    expect(getChainsFromApprovedSession(accounts)).toEqual([
      'hedera:mainnet',
      'hedera:testnet',
      'hedera:previewnet',
      'hedera:devnet',
      'foo:bar',
    ])
  })
})
