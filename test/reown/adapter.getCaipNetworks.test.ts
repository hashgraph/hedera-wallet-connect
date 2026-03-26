import { HederaAdapter, HederaChainDefinition, hederaNamespace } from '../../src/reown'

describe('HederaAdapter getCaipNetworks', () => {
  it('returns native Hedera networks when namespace is hedera', () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    const networks = adapter.getCaipNetworks()

    expect(networks).toHaveLength(2)
    expect(networks).toContainEqual(HederaChainDefinition.Native.Mainnet)
    expect(networks).toContainEqual(HederaChainDefinition.Native.Testnet)
    expect(networks[0].caipNetworkId).toBe('hedera:mainnet')
    expect(networks[1].caipNetworkId).toBe('hedera:testnet')
  })

  it('returns native Hedera networks when explicitly requesting hedera namespace', () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    const networks = adapter.getCaipNetworks(hederaNamespace)

    expect(networks).toHaveLength(2)
    expect(networks).toContainEqual(HederaChainDefinition.Native.Mainnet)
    expect(networks).toContainEqual(HederaChainDefinition.Native.Testnet)
  })

  it('returns native Hedera networks when namespace is undefined', () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    ;(adapter as any).namespace = undefined
    const networks = adapter.getCaipNetworks()

    expect(networks).toHaveLength(2)
    expect(networks).toContainEqual(HederaChainDefinition.Native.Mainnet)
    expect(networks).toContainEqual(HederaChainDefinition.Native.Testnet)
  })

  describe('with params.networks', () => {
    it('returns only the user-provided hedera networks when configured', () => {
      const adapter = new HederaAdapter({
        namespace: hederaNamespace,
        networks: [HederaChainDefinition.Native.Testnet],
      })
      const networks = adapter.getCaipNetworks()

      expect(networks).toHaveLength(1)
      expect(networks).toContainEqual(HederaChainDefinition.Native.Testnet)
    })

    it('filters user-provided networks by the requested hedera namespace', () => {
      const adapter = new HederaAdapter({
        namespace: hederaNamespace,
        networks: [HederaChainDefinition.Native.Mainnet, HederaChainDefinition.Native.Testnet],
      })
      const networks = adapter.getCaipNetworks(hederaNamespace)

      expect(networks).toHaveLength(2)
      expect(networks).toContainEqual(HederaChainDefinition.Native.Mainnet)
      expect(networks).toContainEqual(HederaChainDefinition.Native.Testnet)
    })

    it('returns all user-provided networks when targetNamespace is undefined', () => {
      const adapter = new HederaAdapter({
        namespace: hederaNamespace,
        networks: [HederaChainDefinition.Native.Mainnet, HederaChainDefinition.Native.Testnet],
      })
      ;(adapter as any).namespace = undefined
      const networks = adapter.getCaipNetworks()

      expect(networks).toHaveLength(2)
      expect(networks).toContainEqual(HederaChainDefinition.Native.Mainnet)
      expect(networks).toContainEqual(HederaChainDefinition.Native.Testnet)
    })

    it('falls back to hardcoded networks when params.networks is an empty array', () => {
      const adapter = new HederaAdapter({
        namespace: hederaNamespace,
        networks: [],
      })
      const networks = adapter.getCaipNetworks()

      expect(networks).toHaveLength(2)
      expect(networks).toContainEqual(HederaChainDefinition.Native.Mainnet)
      expect(networks).toContainEqual(HederaChainDefinition.Native.Testnet)
    })
  })
})
