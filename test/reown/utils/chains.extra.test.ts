import { mergeRequiredOptionalNamespaces } from '../../../src/reown/utils/chains'

describe('chains utilities extra coverage', () => {
  it('mergeRequiredOptionalNamespaces adds optional namespaces', () => {
    const required = {
      hedera: { methods: [], chains: ['hedera:mainnet'], events: [] },
    }
    const optional = {
      eip155: { methods: ['foo'], chains: ['eip155:296'], events: [] },
    }
    const result = mergeRequiredOptionalNamespaces(required, optional)
    expect(result.hedera.chains).toContain('hedera:mainnet')
    expect(result.eip155.chains).toEqual(['eip155:296'])
    expect(result.eip155.methods).toEqual(['foo'])
  })
})
