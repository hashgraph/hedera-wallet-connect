import { HederaProvider, HederaJsonRpcMethod, createNamespaces, HederaChainDefinition } from '../../../src'
import { requestTopic, testUserAccountId } from '../../_helpers'

jest.mock('@walletconnect/universal-provider')
jest.mock('../../../src/reown/providers/HIP820Provider')

describe('HederaProvider remaining lines', () => {
  let provider: HederaProvider

  beforeEach(async () => {
    provider = await HederaProvider.init({ projectId: 'pid', logger: 'error' })
    provider.session = {
      topic: requestTopic,
      namespaces: {
        hedera: { accounts: [`hedera:testnet:${testUserAccountId.toString()}`] },
      },
    } as any
    provider.namespaces = createNamespaces([
      HederaChainDefinition.Native.Testnet,
    ])
    provider.client = {} as any
    provider.events = { emit: jest.fn() } as any
    provider.nativeProvider = { request: jest.fn().mockResolvedValue('native') } as any
  })

  test('emit forwards events', () => {
    provider.emit('evt', { a: 1 })
    expect((provider.events.emit as jest.Mock).mock.calls[0]).toEqual(['evt', { a: 1 }])
  })

  test('request routes to native provider for hedera methods', async () => {
    await expect(
      provider.request({ method: HederaJsonRpcMethod.SignMessage })
    ).resolves.toBe('native')
    expect(provider.nativeProvider?.request).toHaveBeenCalledWith({
      request: { method: HederaJsonRpcMethod.SignMessage },
      chainId: 'hedera:testnet',
      topic: requestTopic,
      expiry: undefined,
    })
  })

  test('all rpc wrapper methods call request', async () => {
    const spy = jest.fn().mockResolvedValue('ok')
    provider.request = spy as any
    await provider.eth_blockNumber()
    await provider.eth_call({} as any)
    await provider.eth_feeHistory(1, 'latest', [1])
    await provider.eth_gasPrice()
    await provider.eth_getBlockByHash('0x', true)
    await provider.eth_getBlockByNumber('0x1')
    await provider.eth_getBlockTransactionCountByHash('0x2')
    await provider.eth_getBlockTransactionCountByNumber('0x3')
    await provider.eth_getCode('0x4')
    await provider.eth_getFilterLogs('fid')
    await provider.eth_getFilterChanges('fid')
    await provider.eth_getLogs({} as any)
    await provider.eth_getStorageAt('0x5', '0x0')
    await provider.eth_getTransactionByBlockHashAndIndex('0x6', '0x1')
    await provider.eth_getTransactionByBlockNumberAndIndex('0x7', '0x1')
    await provider.eth_getTransactionByHash('0x8')
    await provider.eth_getTransactionCount('0x9')
    await provider.eth_getTransactionReceipt('0xa')
    await provider.eth_hashrate()
    await provider.eth_maxPriorityFeePerGas()
    await provider.eth_mining()
    await provider.eth_newBlockFilter()
    await provider.eth_newFilter({} as any)
    await provider.eth_submitWork(['0x'])
    await provider.eth_syncing()
    await provider.eth_uninstallFilter('0x1')
    await provider.net_listening()
    await provider.net_version()
    await provider.web3_clientVersion()
    await provider.eth_chainId()
    expect(spy).toHaveBeenCalledTimes(30)
  })

  test('initProviders throws without client', () => {
    provider.client = undefined as any
    expect(() => (provider as any).initProviders()).toThrow('Sign Client not initialized')
  })

  test('rpcProviders returns existing providers', () => {
    const res = provider.rpcProviders
    expect(res).toEqual({ hedera: provider.nativeProvider })
  })

  test('rpcProviders setter is callable', () => {
    provider.rpcProviders = { hedera: {} as any }
    // getter should still return the original providers since setter is a no-op
    expect(provider.rpcProviders).toEqual({ hedera: provider.nativeProvider })
  })
})
