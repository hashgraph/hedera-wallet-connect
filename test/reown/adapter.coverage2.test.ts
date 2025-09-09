import { HederaAdapter, hederaNamespace, HederaChainDefinition } from '../../src'
import { getAccountBalance } from '../../src/reown/utils'

jest.mock('../../src/reown/utils', () => {
  const actual = jest.requireActual('../../src/reown/utils')
  return { ...actual, getAccountBalance: jest.fn() }
})

const mockedGetBalance = getAccountBalance as jest.MockedFunction<typeof getAccountBalance>

describe('HederaAdapter additional coverage', () => {
  test('connect returns wallet connect result', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    ;(adapter as any).provider = {}
    const mockConnector = { 
      type: 'WALLET_CONNECT', 
      connectWalletConnect: jest.fn().mockResolvedValue({}),
      disconnect: jest.fn().mockResolvedValue({})
    }
    jest.spyOn(adapter as any, 'getWalletConnectConnector').mockReturnValue(mockConnector)
    
    const res = await adapter.connect({ chainId: '5' } as any)
    expect(res).toEqual({
      id: 'WALLET_CONNECT',
      type: 'WALLET_CONNECT',
      chainId: 5,
      provider: {},
      address: '',
    })
  })

  test('getAccounts extracts unique addresses', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    ;(adapter as any).provider = {
      session: {
        namespaces: {
          hedera: {
            accounts: ['hedera:296:0x1', 'hedera:296:0x2', 'hedera:296:0x1'],
          },
        },
      },
    }
    const res = await adapter.getAccounts({ namespace: hederaNamespace } as any)
    expect(res.accounts).toEqual([
      { namespace: hederaNamespace, address: '0x1', type: 'eoa', publicKey: undefined, path: undefined },
      { namespace: hederaNamespace, address: '0x2', type: 'eoa', publicKey: undefined, path: undefined },
    ])
  })

  test('syncConnections resolves', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    await expect(adapter.syncConnections({} as any)).resolves.toBeUndefined()
  })

  test('getBalance returns formatted balance', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    const empty = await adapter.getBalance({ address: '0x1' } as any)
    expect(empty).toEqual({ balance: '0', decimals: 0, symbol: '' })

    mockedGetBalance.mockResolvedValue({
      hbars: { toTinybars: () => ({ toString: () => '100000000' }) },
    } as any)
    const caipNetwork = {
      id: '296',
      testnet: true,
      nativeCurrency: { decimals: 8, symbol: 'HBAR' },
    }
    const res = await adapter.getBalance({ address: '0x1', caipNetwork } as any)
    expect(mockedGetBalance).toHaveBeenCalled()
    expect(res).toEqual({ balance: '1.0', decimals: 8, symbol: 'HBAR' })
  })

  test('signMessage uses hedera provider path', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    const provider = { hedera_signMessage: jest.fn().mockResolvedValue({ signatureMap: 'sig' }) }
    const result = await adapter.signMessage({ provider: provider as any, message: 'msg', address: '0.0.123' } as any)
    expect(provider.hedera_signMessage).toHaveBeenCalledWith({ signerAccountId: '0.0.123', message: 'msg' })
    expect(result.signature).toBe('sig')
  })

  test('sendTransaction executes for eip155 namespace', async () => {
    const adapter = new HederaAdapter({ namespace: 'eip155' })
    const provider = { eth_sendTransaction: jest.fn().mockResolvedValue('0xabc') }
    const res = await adapter.sendTransaction({
      provider: provider as any,
      value: 0n,
      to: '0x2',
      data: '0x',
      gas: 1n,
      gasPrice: 1n,
      address: '0x1',
      caipNetwork: HederaChainDefinition.EVM.Mainnet,
    } as any)
    expect(provider.eth_sendTransaction).toHaveBeenCalled()
    expect(res.hash).toBe('0xabc')
  })
})
