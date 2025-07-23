import { HederaAdapter, hederaNamespace, HederaChainDefinition } from '../../src'
import { ProviderUtil } from '@reown/appkit/store'
import { WcHelpersUtil } from '@reown/appkit'
import { testUserAccountId } from '../_helpers'

jest.mock('../../src/lib/shared/mirrorNode', () => ({ getAccountInfo: jest.fn() }))
const { getAccountInfo } = jest.requireMock('../../src/lib/shared/mirrorNode') as { getAccountInfo: jest.Mock }

describe('HederaAdapter branch coverage', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  test('setUniversalProvider uses fallback caipNetworks', () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    // force getCaipNetworks to return undefined
    jest.spyOn(adapter as any, 'getCaipNetworks').mockReturnValue(undefined)
    const provider = {} as any
    adapter.setUniversalProvider(provider)
    const connector = (adapter as any).connectors[0]
    expect(connector.caipNetworks).toEqual([])
  })

  test('getAccounts handles missing session', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    ;(adapter as any).provider = {} // provider with no session information
    const result = await adapter.getAccounts({ namespace: hederaNamespace } as any)
    expect(result.accounts).toEqual([])
  })

  test('getBalance returns zero when account info missing', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    ;(getAccountInfo as jest.Mock).mockResolvedValue(undefined)
    const result = await adapter.getBalance({
      address: testUserAccountId.toString(),
      caipNetwork: HederaChainDefinition.Native.Mainnet,
      chainId: 'hedera:mainnet',
    })
    expect(result.balance).toBe('0')
  })

  test('getBalance uses testnet ledger selection', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    const mockInfo = { balance: { balance: 100n } }
    ;(getAccountInfo as jest.Mock).mockResolvedValue(mockInfo)
    const res = await adapter.getBalance({
      address: testUserAccountId.toString(),
      caipNetwork: HederaChainDefinition.Native.Testnet,
      chainId: 'hedera:testnet',
    })
    expect(res.balance).toBe('0.000001')
  })

  test('getCapabilities falls back to provider request when capability missing', async () => {
    const adapter = new HederaAdapter({ namespace: 'eip155' })
    const request = jest.fn().mockResolvedValue('fallback')
    jest.spyOn(ProviderUtil, 'getProvider').mockReturnValue({
      session: { sessionProperties: { capabilities: '{"0x1": {"gas": "1"}}' } },
      request,
    } as any)
    const res = await adapter.getCapabilities('0x2' as any)
    expect(request).toHaveBeenCalled()
    expect(res).toBe('fallback')
  })

  test('getCapabilities handles provider with no session', async () => {
    const adapter = new HederaAdapter({ namespace: 'eip155' })
    const req = jest.fn().mockResolvedValue('none')
    jest.spyOn(ProviderUtil, 'getProvider').mockReturnValue({ request: req } as any)
    const result = await adapter.getCapabilities('0x1' as any)
    expect(req).toHaveBeenCalled()
    expect(result).toBe('none')
  })

  test('getEnsAddress returns false for non reown with network', async () => {
    const adapter = new HederaAdapter({ namespace: 'eip155' })
    const result = await adapter.getEnsAddress({
      name: 'notreown.eth',
      caipNetwork: HederaChainDefinition.EVM.Testnet,
    } as any)
    expect(result.address).toBe(false)
  })

  test('getEnsAddress falls back when reown name unresolved', async () => {
    const adapter = new HederaAdapter({ namespace: 'eip155' })
    jest.spyOn(WcHelpersUtil, 'resolveReownName').mockResolvedValue(undefined as any)
    const res = await adapter.getEnsAddress({
      name: 'demo.reown.id',
      caipNetwork: HederaChainDefinition.EVM.Testnet,
    } as any)
    expect(res.address).toBe(false)
  })

  test('estimateGas handles undefined network', async () => {
    const adapter = new HederaAdapter({ namespace: 'eip155' })
    const mock = jest.fn().mockResolvedValue(BigInt(7))
    const res = await adapter.estimateGas({
      provider: { eth_estimateGas: mock } as any,
      address: '0x',
      data: '0x',
      to: '0x',
    } as any)
    expect(mock).toHaveBeenCalledWith(
      { data: '0x', to: '0x', address: '0x' },
      '0x',
      NaN,
    )
    expect(res.gas).toBe(BigInt(7))
  })

  test('sendTransaction allows undefined network id', async () => {
    const adapter = new HederaAdapter({ namespace: 'eip155' })
    const send = jest.fn().mockResolvedValue('0xtx')
    const res = await adapter.sendTransaction({
      provider: { eth_sendTransaction: send } as any,
      to: '0x',
      value: 1n,
      data: '0x',
      gas: 1n,
      gasPrice: 1n,
      address: '0x',
    } as any)
    expect(send).toHaveBeenCalledWith(
      { value: 1n, to: '0x', data: '0x', gas: 1n, gasPrice: 1n, address: '0x' },
      '0x',
      NaN,
    )
    expect(res.hash).toBe('0xtx')
  })

  test('getWalletConnectProvider returns undefined when no connector', () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    expect(adapter.getWalletConnectProvider()).toBeUndefined()
  })
})
