import { CaipNetwork } from '@reown/appkit-common'
import {
  HederaChainDefinition,
  createNamespaces,
  mergeRequiredOptionalNamespaces,
  hederaNamespace,
} from '../../../src/reown/utils/chains'

describe('Chain utilities additional branches', () => {
  test('createNamespaces handles existing namespace and missing rpc url', () => {
    const customNetwork = {
      id: 'custom',
      chainNamespace: hederaNamespace,
      caipNetworkId: 'hedera:custom',
      rpcUrls: { default: { http: [] as string[] } },
    } as unknown as CaipNetwork

    const result = createNamespaces([
      HederaChainDefinition.Native.Mainnet,
      customNetwork,
    ] as CaipNetwork[])

    expect(result.hedera?.chains).toEqual([
      'hedera:mainnet',
      'hedera:custom',
    ])
    // rpcMap should only contain mainnet entry since custom network has none
    expect(result.hedera?.rpcMap).toEqual({
      mainnet: 'https://mainnet.hashio.io/api',
    })
  })

  test('mergeRequiredOptionalNamespaces returns optional when required missing', () => {
    const optional = {
      hedera: {
        methods: ['m1'],
        chains: ['hedera:mainnet'],
        events: ['e1'],
      },
    }

    const result = mergeRequiredOptionalNamespaces({}, optional)
    expect(result).toEqual(optional)
  })

  test('mergeRequiredOptionalNamespaces with undefined arrays', () => {
    const required = { hedera: { chains: ['hedera:mainnet'] } } as any
    const optional = { hedera: { chains: ['hedera:testnet'] } } as any
    const result = mergeRequiredOptionalNamespaces(required, optional)
    expect(result.hedera.methods).toEqual([])
    expect(result.hedera.events).toEqual([])
    expect(result.hedera.chains).toEqual(['hedera:testnet', 'hedera:mainnet'])
  })

  test('mergeRequiredOptionalNamespaces with no params uses defaults', () => {
    expect(mergeRequiredOptionalNamespaces()).toEqual({})
  })
})

test('mergeRequiredOptionalNamespaces handles missing arrays after custom normalization', () => {
  jest.isolateModules(() => {
    jest.doMock('@walletconnect/utils', () => {
      const actual = jest.requireActual('@walletconnect/utils')
      return { ...actual, normalizeNamespaces: (ns: any) => ns }
    })
    const { mergeRequiredOptionalNamespaces: mergeFn } = require('../../../src/reown/utils/chains')
    const result = mergeFn(
      { hedera: { chains: ['hedera:mainnet'] } },
      { hedera: { chains: ['hedera:testnet'] } },
    )
    expect(result.hedera.methods).toEqual([])
    expect(result.hedera.events).toEqual([])
    expect(result.hedera.chains).toEqual(['hedera:testnet', 'hedera:mainnet'])
  })
})
