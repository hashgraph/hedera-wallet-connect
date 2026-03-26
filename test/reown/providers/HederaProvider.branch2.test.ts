import { UniversalProvider } from '@walletconnect/universal-provider'
import { HederaProvider, HederaJsonRpcMethod, createNamespaces, HederaChainDefinition } from '../../../src'
import { requestTopic, testUserAccountId, prepareTestTransaction } from '../../_helpers'
import { TopicCreateTransaction } from '@hiero-ledger/sdk'

jest.mock('@walletconnect/universal-provider')
jest.mock('../../../src/reown/providers/HIP820Provider')

describe('HederaProvider additional branch coverage 2', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  test('init handles missing optional namespaces', async () => {
    jest
      .spyOn(UniversalProvider.prototype as any, 'initialize')
      .mockImplementation(function () {
        this.namespaces = {
          hedera: { chains: ['hedera:testnet'] },
        }
        this.optionalNamespaces = undefined
        this.session = { topic: requestTopic, namespaces: {} }
        return Promise.resolve()
      })
    const initProvidersSpy = jest
      .spyOn(HederaProvider.prototype as any, 'initProviders')
      .mockReturnValue({})

    const provider = await HederaProvider.init({
      projectId: 'pid',
      logger: 'error',
      session: { topic: requestTopic, namespaces: {} } as any,
    })

    expect(initProvidersSpy).toHaveBeenCalled()
    expect(provider.namespaces).toEqual({})
  })

  test('request uses supplied chain ids', async () => {
    const provider = await HederaProvider.init({ projectId: 'pid', logger: 'error' })
    provider.session = {
      topic: requestTopic,
      namespaces: {
        hedera: { accounts: [`hedera:testnet:${testUserAccountId.toString()}`] },
      },
    } as any
    provider.namespaces = createNamespaces([
      HederaChainDefinition.Native.Testnet,
    ])
    provider.nativeProvider = { request: jest.fn().mockResolvedValue('h') } as any

    await provider.request({ method: HederaJsonRpcMethod.SignMessage }, 'hedera:previewnet')
    expect(provider.nativeProvider?.request).toHaveBeenCalledWith({
      request: { method: HederaJsonRpcMethod.SignMessage },
      chainId: 'hedera:previewnet',
      topic: requestTopic,
      expiry: undefined,
    })
  })

  test('hedera_signTransaction accepts prefixed signerAccountId', async () => {
    const provider = await HederaProvider.init({ projectId: 'pid', logger: 'error' })
    const tx = prepareTestTransaction(new TopicCreateTransaction(), { freeze: true })
    provider.session = {
      topic: requestTopic,
      namespaces: { hedera: { accounts: [`hedera:testnet:${testUserAccountId.toString()}`] } },
    } as any
    provider.namespaces = { hedera: { chains: ['hedera:testnet'] } } as any
    const signTransaction = jest.fn().mockResolvedValue('ok')
    provider.nativeProvider = {
      requestAccounts: () => [testUserAccountId.toString()],
      signTransaction,
    } as any

    const res = await provider.hedera_signTransaction({
      signerAccountId: `hedera:previewnet:${testUserAccountId.toString()}`,
      transactionBody: tx,
    } as any)

    expect(res).toBe('ok')
    expect(signTransaction).toHaveBeenCalled()
  })

  test('request handles missing provider request method', async () => {
    const provider = await HederaProvider.init({ projectId: 'pid', logger: 'error' })
    provider.session = { topic: requestTopic, namespaces: { hedera: { accounts: [] } } } as any
    provider.namespaces = {}
    let first = true
    Object.defineProperty(provider, 'nativeProvider', {
      configurable: true,
      get() {
        if (first) {
          first = false
          return {}
        }
        return undefined
      },
    })

    await expect(
      provider.request({ method: HederaJsonRpcMethod.SignMessage })
    ).resolves.toBeUndefined()
  })

  test('hedera_signTransaction handles missing requestAccounts method', async () => {
    const provider = await HederaProvider.init({ projectId: 'pid', logger: 'error' })
    const tx = prepareTestTransaction(new TopicCreateTransaction(), { freeze: true })
    provider.session = { topic: requestTopic, namespaces: { hedera: { accounts: [`hedera:testnet:${testUserAccountId}`] } } } as any
    provider.namespaces = { hedera: { chains: ['hedera:testnet'] } } as any
    let first = true
    Object.defineProperty(provider, 'nativeProvider', {
      configurable: true,
      get() {
        if (first) {
          first = false
          return { signTransaction: jest.fn() }
        }
        return undefined
      },
    })
    await expect(
      provider.hedera_signTransaction({ signerAccountId: testUserAccountId.toString(), transactionBody: tx } as any)
    ).rejects.toThrow('Signer not found')
  })

  test('init with only hedera namespace', async () => {
    jest
      .spyOn(UniversalProvider.prototype as any, 'initialize')
      .mockImplementation(function () {
        this.namespaces = { hedera: { chains: ['hedera:testnet'] } }
        this.providerOpts = { optionalNamespaces: { hedera: { rpcMap: { 'hedera:testnet': 'hrpc' } } } }
        this.session = { topic: requestTopic, namespaces: {} }
        return Promise.resolve()
      })
    const initSpy = jest.spyOn(HederaProvider.prototype as any, 'initProviders').mockReturnValue({})
    const provider = await HederaProvider.init({ projectId: 'pid', logger: 'error', session: { topic: requestTopic, namespaces: {} } as any })
    expect(provider.namespaces).toEqual({ hedera: { rpcMap: { 'hedera:testnet': 'hrpc' } } })
    initSpy.mockRestore()
    ;(UniversalProvider.prototype.initialize as jest.Mock).mockRestore()
  })

  test('hedera_signTransaction throws when params undefined', async () => {
    const provider = await HederaProvider.init({ projectId: 'pid', logger: 'error' })
    provider.session = { topic: requestTopic, namespaces: { hedera: { accounts: [`hedera:testnet:${testUserAccountId}`] } } } as any
    provider.namespaces = { hedera: { chains: ['hedera:testnet'] } } as any
    provider.nativeProvider = { requestAccounts: () => [testUserAccountId.toString()], signTransaction: jest.fn() } as any
    await expect(provider.hedera_signTransaction(undefined as any)).rejects.toThrow('Transaction sent in incorrect format')
  })
})
