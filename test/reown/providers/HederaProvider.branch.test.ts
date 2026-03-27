import { UniversalProvider } from '@walletconnect/universal-provider'
import { HederaProvider } from '../../../src'
import { requestTopic, testUserAccountId, prepareTestTransaction } from '../../_helpers'
import { TopicCreateTransaction } from '@hiero-ledger/sdk'

jest.mock('ethers')
jest.mock('@walletconnect/universal-provider')
jest.mock('../../../src/reown/providers/HIP820Provider')
jest.mock('../../../src/reown/providers/EIP155Provider')

describe('HederaProvider additional branch coverage', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  test('init merges namespaces and calls initProviders', async () => {
    const initSpy = jest
      .spyOn(UniversalProvider.prototype as any, 'initialize')
      .mockImplementation(function () {
        this.namespaces = {
          eip155: { chains: ['eip155:1'] },
          hedera: { chains: ['hedera:testnet'] },
        }
        this.providerOpts = {
          optionalNamespaces: {
            eip155: { rpcMap: { 'eip155:1': 'rpc' } },
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
      eip155: { rpcMap: { 'eip155:1': 'rpc' } },
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

  test('eth_signMessage handles hex input', async () => {
    const provider = await HederaProvider.init({ projectId: 'pid', logger: 'error', session: { topic: requestTopic, namespaces: {} } as any })
    const ethers = require('ethers')
    ;(ethers.isHexString as jest.Mock).mockReturnValue(true)
    provider.request = jest.fn().mockResolvedValue('0xsig') as any

    const result = await provider.eth_signMessage('0xabc', '0x1')
    expect(result).toBe('0xsig')
    expect((provider.request as jest.Mock).mock.calls[0][0]).toEqual({
      method: 'personal_sign',
      params: ['0xabc', '0x1'],
    })
  })

  test('eth_sendTransaction returns null without receipt hash', async () => {
    const provider = await HederaProvider.init({ projectId: 'pid', logger: 'error', session: { topic: requestTopic, namespaces: {} } as any })
    const mockWait = jest.fn().mockResolvedValue({})
    const mockSendTransaction = jest.fn().mockResolvedValue({ wait: mockWait })
    const mockSigner = { sendTransaction: mockSendTransaction }
    const mockGetSigner = jest.fn().mockReturnValue(mockSigner)
    const { JsonRpcSigner, BrowserProvider } = require('ethers')
    jest.spyOn(JsonRpcSigner.prototype, 'sendTransaction').mockImplementation(mockSendTransaction)
    jest.spyOn(BrowserProvider.prototype, 'getSigner').mockImplementation(mockGetSigner)

    const data = {
      to: '0x0',
      value: BigInt(1),
      gas: BigInt(1),
      gasPrice: BigInt(1),
      data: '0x',
      chainNamespace: 'eip155',
    } as any
    const res = await provider.eth_sendTransaction(data, '0x1', 1)
    expect(res).toBeNull()
  })

  test('eth_getBlockByHash uses default parameter', async () => {
    const provider = await HederaProvider.init({ projectId: 'pid', logger: 'error', session: { topic: requestTopic, namespaces: {} } as any })
    const spy = jest.fn().mockResolvedValue('ok')
    provider.request = spy as any
    await provider.eth_getBlockByHash('0xabc')
    expect(spy).toHaveBeenCalledWith({ method: 'eth_getBlockByHash', params: ['0xabc', false] })
  })
})
