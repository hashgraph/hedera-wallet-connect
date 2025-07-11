import { HederaChainId } from '../../src'

describe('HederaChainId enum', () => {
  it('contains all expected chain ids with proper values', () => {
    expect(HederaChainId.Mainnet).toBe('hedera:mainnet')
    expect(HederaChainId.Testnet).toBe('hedera:testnet')
    expect(HederaChainId.Previewnet).toBe('hedera:previewnet')
    expect(HederaChainId.Devnet).toBe('hedera:devnet')
  })

  it('Object.values returns all enum values', () => {
    const values = Object.values(HederaChainId)
    expect(values).toEqual([
      'hedera:mainnet',
      'hedera:testnet',
      'hedera:previewnet',
      'hedera:devnet',
    ])
  })
})
