import { UniversalProvider } from '@walletconnect/universal-provider'
import { HederaProvider } from '../../../src'
import { requestTopic, testUserAccountId, prepareTestTransaction } from '../../_helpers'
import { TopicCreateTransaction } from '@hiero-ledger/sdk'

jest.mock('@walletconnect/universal-provider')
jest.mock('../../../src/reown/providers/HIP820Provider')

describe('HederaProvider additional branch coverage', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  test('init merges namespaces and calls initProviders', async () => {
    const initSpy = jest
      .spyOn(UniversalProvider.prototype as any, 'initialize')
      .mockImplementation(function () {
        this.namespaces = {
          hedera: { chains: ['hedera:testnet'] },
        }
        this.providerOpts = {
          optionalNamespaces: {
            hedera: { rpcMap: { 'hedera:testnet': 'hrpc' } },
          }
        }
        this.session = { topic: requestTopic, namespaces: {} }
        return Promise.resolve()
      })
    const pairSpy = jest
      .spyOn(HederaProvider.prototype as any, 'initProviders')
      .mockReturnValue({})

    const provider = await HederaProvider.init({
      projectId: 'pid',
      logger: 'error',
      session: { topic: requestTopic, namespaces: {} } as any,
    })

    expect(pairSpy).toHaveBeenCalled()
    expect(provider.namespaces).toEqual({
      hedera: { rpcMap: { 'hedera:testnet': 'hrpc' } },
    })

    initSpy.mockRestore()
    pairSpy.mockRestore()
  })

  test('init without namespaces skips initProviders', async () => {
    const initSpy = jest
      .spyOn(UniversalProvider.prototype as any, 'initialize')
      .mockImplementation(() => Promise.resolve())
    const pairSpy = jest
      .spyOn(HederaProvider.prototype as any, 'initProviders')
      .mockReturnValue({})

    const provider = await HederaProvider.init({ projectId: 'pid', logger: 'error' })

    expect(pairSpy).not.toHaveBeenCalled()
    expect(provider.namespaces).toEqual({})

    initSpy.mockRestore()
    pairSpy.mockRestore()
  })

  test('getAccountAddresses handles undefined map result', async () => {
    const provider = await HederaProvider.init({ projectId: 'pid', logger: 'error' })
    provider.session = {
      namespaces: { hedera: { accounts: [] } },
    } as any
    provider.namespaces = {}

    expect(provider.getAccountAddresses()).toEqual([])
  })

  test('hedera_signTransaction fails with missing signerAccountId', async () => {
    const provider = await HederaProvider.init({ projectId: 'pid', logger: 'error' })
    const tx = prepareTestTransaction(new TopicCreateTransaction(), { freeze: true })
    provider.session = { topic: requestTopic, namespaces: { hedera: { accounts: ['hedera:testnet:0.0.1'] } } } as any
    provider.namespaces = { hedera: { chains: ['hedera:testnet'] } } as any
    provider.nativeProvider = { requestAccounts: () => [testUserAccountId.toString()], signTransaction: jest.fn() } as any

    await expect(
      provider.hedera_signTransaction({ signerAccountId: undefined as any, transactionBody: tx })
    ).rejects.toThrow('Signer not found')
  })

  test('eth_getBlockByHash uses default parameter', async () => {
    const provider = await HederaProvider.init({ projectId: 'pid', logger: 'error', session: { topic: requestTopic, namespaces: {} } as any })
    const spy = jest.fn().mockResolvedValue('ok')
    provider.request = spy as any
    await provider.eth_getBlockByHash('0xabc')
    expect(spy).toHaveBeenCalledWith({ method: 'eth_getBlockByHash', params: ['0xabc', false] })
  })
})
