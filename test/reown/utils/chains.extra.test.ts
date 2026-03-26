import { mergeRequiredOptionalNamespaces } from '../../../src/reown/utils/chains'

describe('chains utilities extra coverage', () => {
  it('mergeRequiredOptionalNamespaces adds optional namespaces', () => {
    const required = {
      hedera: { methods: [], chains: ['hedera:mainnet'], events: [] },
    }
    const optional = {
      hedera: { methods: ['foo'], chains: ['hedera:testnet'], events: [] },
    }
    const result = mergeRequiredOptionalNamespaces(required, optional)
    expect(result.hedera.chains).toContain('hedera:mainnet')
    expect(result.hedera.chains).toContain('hedera:testnet')
    expect(result.hedera.methods).toEqual(['foo'])
  })
})
