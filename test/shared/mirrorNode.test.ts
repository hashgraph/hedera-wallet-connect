import { getAccountInfo } from '../../src/lib/shared/mirrorNode'
import { LedgerId } from '@hashgraph/sdk'

describe('getAccountInfo', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    jest.resetAllMocks()
  })

  it('returns account info when fetch succeeds', async () => {
    const mockAccount = { account: '0.0.123' }
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      json: jest.fn().mockResolvedValue(mockAccount),
    }) as any

    const result = await getAccountInfo(LedgerId.TESTNET, '0.0.123')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://testnet.mirrornode.hedera.com/api/v1/accounts/0.0.123',
      { headers: { accept: 'application/json' } },
    )
    expect(result).toEqual(mockAccount)
  })

  it('returns null for non-200 status', async () => {
    global.fetch = jest.fn().mockResolvedValue({ status: 404 }) as any
    const result = await getAccountInfo(LedgerId.MAINNET, '0.0.1')
    expect(result).toBeNull()
  })
})
