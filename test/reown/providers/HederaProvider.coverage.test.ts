import { HederaProvider, HederaJsonRpcMethod, createNamespaces, HederaChainDefinition } from '../../../src'
import { requestTopic, testUserAccountId } from '../../_helpers'

jest.mock('ethers')
jest.mock('@walletconnect/universal-provider')
jest.mock('../../../src/reown/providers/HIP820Provider')
jest.mock('../../../src/reown/providers/EIP155Provider')

describe('HederaProvider remaining lines', () => {
  let provider: HederaProvider

  beforeEach(async () => {
    provider = await HederaProvider.init({ projectId: 'pid', logger: 'error' })
    provider.session = {
      topic: requestTopic,
      namespaces: {
        hedera: { accounts: [`hedera:testnet:${testUserAccountId.toString()}`] },
        eip155: { accounts: ['eip155:296:0xabc'] },
      },
    } as any
    provider.namespaces = createNamespaces([
      HederaChainDefinition.Native.Testnet,
      HederaChainDefinition.EVM.Testnet,
    ])
    provider.client = {} as any
    provider.events = { emit: jest.fn() } as any
    provider.nativeProvider = { request: jest.fn().mockResolvedValue('native') } as any
    provider.eip155Provider = { request: jest.fn().mockResolvedValue('eip') } as any
  })

  test('emit forwards events', () => {
    provider.emit('evt', { a: 1 })
    expect((provider.events.emit as jest.Mock).mock.calls[0]).toEqual(['evt', { a: 1 }])
  })

  test('request routes to native and eip155 providers', async () => {
    await expect(
      provider.request({ method: HederaJsonRpcMethod.SignMessage })
    ).resolves.toBe('native')
    expect(provider.nativeProvider?.request).toHaveBeenCalledWith({
      request: { method: HederaJsonRpcMethod.SignMessage },
      chainId: 'hedera:testnet',
      topic: requestTopic,
      expiry: undefined,
    })

    await expect(provider.request({ method: 'eth_chainId' })).resolves.toBe('eip')
    expect(provider.eip155Provider?.request).toHaveBeenCalledWith({
      request: { method: 'eth_chainId' },
      chainId: 'eip155:296',
      topic: requestTopic,
      expiry: undefined,
    })
  })

  test('error branches for transaction helpers', async () => {
    await expect(
      provider.eth_estimateGas({ chainNamespace: 'eip155' } as any, undefined as any, 296)
    ).rejects.toThrow('address is undefined')

    await expect(
      provider.eth_sendTransaction({ chainNamespace: 'hedera' } as any, '0x1', 1)
    ).rejects.toThrow('chainNamespace is not eip155')

    await expect(
      provider.eth_writeContract({ tokenAddress: '0x1', abi: [], args: [], method: 'm' } as any, undefined as any, 1)
    ).rejects.toThrow('writeContract - address is undefined')

    await expect(
      provider.eth_writeContract({ tokenAddress: '0x1', abi: [], args: [], method: undefined as any } as any, '0x2', 1)
    ).rejects.toThrow('Contract method is undefined')
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
    expect(res).toEqual({ hedera: provider.nativeProvider, eip155: provider.eip155Provider })
  })
})
