jest.mock('@hashgraph/sdk', () => {
  const populateAccountNumMock = jest.fn()
  const executeMock = jest.fn()
  const fromStringMock = jest.fn()
  const fromEvmAddressMock = jest.fn()
  const forTestnet = jest.fn(() => ({ name: 'testnet' }))
  const forMainnet = jest.fn(() => ({ name: 'mainnet' }))

  class AccountId {
    num: { isZero: () => boolean }
    evmAddress: string | null
    constructor(num: number, evm: string | null) {
      this.num = { isZero: () => num === 0 }
      this.evmAddress = evm
    }
    async populateAccountNum(client: any) {
      this.num = { isZero: () => false }
      return populateAccountNumMock(client)
    }
    static fromString(addr: string) { return fromStringMock(addr) }
    static fromEvmAddress(shard: number, realm: number, addr: string) { return fromEvmAddressMock(shard, realm, addr) }
  }

  fromStringMock.mockImplementation((addr: string) => {
    if (/^\d+\.\d+\.\d+$/.test(addr)) {
      const num = Number(addr.split('.')[2])
      return new AccountId(num, null)
    }
    throw new Error('invalid')
  })
  fromEvmAddressMock.mockImplementation((shard: number, realm: number, addr: string) => new AccountId(0, addr))

  class AccountBalanceQuery {
    setAccountId() { return this }
    execute(client: any) { return executeMock(client) }
  }

  return {
    AccountBalance: class {},
    AccountBalanceQuery,
    AccountId,
    Client: { forTestnet, forMainnet },
    LedgerId: { TESTNET: 'TESTNET', MAINNET: 'MAINNET' },
    __mocks: { populateAccountNumMock, executeMock, fromStringMock, fromEvmAddressMock, forTestnet, forMainnet }
  }
})

import { getAccountBalance } from '../../../src/reown/utils'
import { LedgerId, __mocks } from '@hashgraph/sdk'

const { populateAccountNumMock, executeMock, fromStringMock, fromEvmAddressMock, forTestnet, forMainnet } = __mocks

beforeEach(() => {
  jest.clearAllMocks()
})

describe(getAccountBalance.name, () => {
  it('returns balance for a Hedera account string', async () => {
    const mockBalance: any = {}
    executeMock.mockResolvedValue(mockBalance)

    const result = await getAccountBalance(LedgerId.TESTNET, '0.0.123')

    expect(forTestnet).toHaveBeenCalledTimes(1)
    expect(forMainnet).not.toHaveBeenCalled()
    expect(fromStringMock).toHaveBeenCalledWith('0.0.123')
    expect(fromEvmAddressMock).not.toHaveBeenCalled()
    expect(populateAccountNumMock).not.toHaveBeenCalled()
    expect(result).toBe(mockBalance)
  })

  it('handles evm address and populates account number', async () => {
    const mockBalance: any = {}
    executeMock.mockResolvedValue(mockBalance)

    const result = await getAccountBalance(LedgerId.MAINNET, '0xabc')

    expect(forMainnet).toHaveBeenCalledTimes(1)
    expect(forTestnet).not.toHaveBeenCalled()
    expect(fromStringMock).toHaveBeenCalled() // error triggers fallback
    expect(fromEvmAddressMock).toHaveBeenCalledWith(0, 0, '0xabc')
    expect(populateAccountNumMock).toHaveBeenCalled()
    expect(result).toBe(mockBalance)
  })

  it('returns null when balance query fails', async () => {
    executeMock.mockRejectedValue(new Error('boom'))
    const result = await getAccountBalance(LedgerId.TESTNET, '0xdef')
    expect(result).toBeNull()
  })
})
