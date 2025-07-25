import { EventEmitter } from 'events'
import HIP820Provider from '../../../src/reown/providers/HIP820Provider'

function createProvider(namespace?: Partial<any>) {
  return new HIP820Provider({
    namespace: {
      chains: ['hedera:testnet'],
      accounts: ['hedera:testnet:0.0.1'],
      events: [],
      methods: [],
      ...namespace,
    },
    client: {},
    events: new EventEmitter(),
  })
}

describe('HIP820Provider additional coverage', () => {
  test('httpProviders getter returns empty object', () => {
    const provider = createProvider()
    expect(provider.httpProviders).toEqual({})
  })

  test('updateNamespace merges namespace properties', () => {
    const provider = createProvider()
    provider.updateNamespace({ methods: ['a'] } as any)
    expect(provider.namespace.methods).toEqual(['a'])
  })

  test('setDefaultChain updates chainId and namespace', () => {
    const provider = createProvider({ defaultChain: 'testnet' })
    provider.setDefaultChain('previewnet')
    expect(provider.chainId).toBe('previewnet')
    expect(provider.namespace.defaultChain).toBe('previewnet')
  })
})
