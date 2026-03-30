import { EventEmitter } from 'events'
import HIP820Provider from '../../../src/reown/providers/HIP820Provider'
import { AccountId, Transaction } from '@hiero-ledger/sdk'
import { DAppSigner } from '../../../src'

const signTransactionMock = jest.fn()
const requestMock = jest.fn()

jest.mock('../../../src', () => {
  const actual = jest.requireActual('../../../src')
  return {
    ...actual,
    DAppSigner: jest.fn().mockImplementation((accountId: AccountId, client: any, topic: string, ledgerId: any) => ({
      accountId,
      client,
      topic,
      ledgerId,
      signTransaction: signTransactionMock,
      request: requestMock,
    })),
  }
})

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

describe('HIP820Provider', () => {
  beforeEach(() => {
    requestMock.mockReset()
    signTransactionMock.mockReset()
    ;(DAppSigner as jest.Mock).mockClear()
  })

  describe('requestAccounts', () => {
    it('returns empty array without accounts', () => {
      const provider = createProvider({ accounts: undefined })
      expect(provider.requestAccounts()).toEqual([])
    })

    it('deduplicates and filters by chain', () => {
      const provider = createProvider({
        accounts: [
          'hedera:testnet:0.0.1',
          'hedera:testnet:0.0.1',
          'hedera:mainnet:0.0.2',
        ],
      })
      provider.setDefaultChain('testnet')
      expect(provider.requestAccounts()).toEqual(['0.0.1'])
    })
  })

  describe('getDefaultChain', () => {
    it('returns current chainId', () => {
      const provider = createProvider()
      provider.chainId = 'custom'
      expect(provider.getDefaultChain()).toBe('custom')
    })

    it('falls back to namespace defaultChain', () => {
      const provider = createProvider({ defaultChain: 'previewnet' })
      provider.chainId = ''
      expect(provider.getDefaultChain()).toBe('previewnet')
    })

    it('uses first chain in namespace', () => {
      const provider = createProvider({ chains: ['hedera:previewnet'], defaultChain: undefined })
      provider.chainId = ''
      expect(provider.getDefaultChain()).toBe('previewnet')
    })

    it('returns mainnet when chain not found', () => {
      const provider = createProvider()
      provider.chainId = ''
      provider.namespace.chains = []
      delete (provider as any).namespace.defaultChain
      expect(provider.getDefaultChain()).toBe('mainnet')
    })
  })

  describe('getSigners and requests', () => {
    it('creates signers from accounts', () => {
      const provider = createProvider({ accounts: ['hedera:testnet:0.0.5'] })
      const signers = provider.getSigners('topic')
      expect((DAppSigner as jest.Mock).mock.calls[0][0]).toEqual(AccountId.fromString('0.0.5'))
      expect(signers).toHaveLength(1)
    })

    it('throws when accounts missing', () => {
      const provider = createProvider({ accounts: undefined })
      expect(() => provider.getSigners('t')).toThrow('Accounts not found')
    })

    it('delegates request and signTransaction', async () => {
      const provider = createProvider()
      requestMock.mockResolvedValue('ok')
      signTransactionMock.mockResolvedValue('signed')
      const tx = {} as Transaction
      const reqRes = await provider.request({ topic: 'topic', request: { method: 'm', params: [] } })
      expect(requestMock).toHaveBeenCalledWith({ method: 'm', params: [] })
      expect(reqRes).toBe('ok')
      const signRes = await provider.signTransaction(tx, 'topic')
      expect(signTransactionMock).toHaveBeenCalledWith(tx)
      expect(signRes).toBe('signed')
    })
  })
})
