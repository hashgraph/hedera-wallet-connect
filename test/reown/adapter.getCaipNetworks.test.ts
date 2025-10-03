import { HederaAdapter, HederaChainDefinition, hederaNamespace } from '../../src/reown'

describe('HederaAdapter getCaipNetworks', () => {
  it('returns EIP155 networks when namespace is eip155', () => {
    const adapter = new HederaAdapter({ namespace: 'eip155' })
    const networks = adapter.getCaipNetworks()
    
    expect(networks).toHaveLength(2)
    expect(networks).toContainEqual(HederaChainDefinition.EVM.Mainnet)
    expect(networks).toContainEqual(HederaChainDefinition.EVM.Testnet)
    expect(networks[0].caipNetworkId).toBe('eip155:295')
    expect(networks[1].caipNetworkId).toBe('eip155:296')
  })

  it('returns native Hedera networks when namespace is hedera', () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    const networks = adapter.getCaipNetworks()
    
    expect(networks).toHaveLength(2)
    expect(networks).toContainEqual(HederaChainDefinition.Native.Mainnet)
    expect(networks).toContainEqual(HederaChainDefinition.Native.Testnet)
    expect(networks[0].caipNetworkId).toBe('hedera:mainnet')
    expect(networks[1].caipNetworkId).toBe('hedera:testnet')
  })

  it('returns EIP155 networks when explicitly requesting eip155 namespace', () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    const networks = adapter.getCaipNetworks('eip155')
    
    expect(networks).toHaveLength(2)
    expect(networks).toContainEqual(HederaChainDefinition.EVM.Mainnet)
    expect(networks).toContainEqual(HederaChainDefinition.EVM.Testnet)
  })

  it('returns native Hedera networks when explicitly requesting hedera namespace', () => {
    const adapter = new HederaAdapter({ namespace: 'eip155' })
    const networks = adapter.getCaipNetworks(hederaNamespace)
    
    expect(networks).toHaveLength(2)
    expect(networks).toContainEqual(HederaChainDefinition.Native.Mainnet)
    expect(networks).toContainEqual(HederaChainDefinition.Native.Testnet)
  })

  it('returns all networks when requesting undefined namespace from adapter without namespace', () => {
    // Create adapter with minimal params to simulate no namespace
    const adapter = new HederaAdapter({ namespace: 'eip155' })
    // Override the namespace to simulate undefined
    ;(adapter as any).namespace = undefined
    const networks = adapter.getCaipNetworks()
    
    expect(networks).toHaveLength(4)
    expect(networks).toContainEqual(HederaChainDefinition.EVM.Mainnet)
    expect(networks).toContainEqual(HederaChainDefinition.EVM.Testnet)
    expect(networks).toContainEqual(HederaChainDefinition.Native.Mainnet)
    expect(networks).toContainEqual(HederaChainDefinition.Native.Testnet)
  })

  it('returns all networks when requesting unknown namespace', () => {
    const adapter = new HederaAdapter({ namespace: 'eip155' })
    const networks = adapter.getCaipNetworks('solana' as any)
    
    expect(networks).toHaveLength(4)
    expect(networks).toContainEqual(HederaChainDefinition.EVM.Mainnet)
    expect(networks).toContainEqual(HederaChainDefinition.EVM.Testnet)
    expect(networks).toContainEqual(HederaChainDefinition.Native.Mainnet)
    expect(networks).toContainEqual(HederaChainDefinition.Native.Testnet)
  })
})