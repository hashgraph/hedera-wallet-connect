import { HederaAdapter, hederaNamespace, HederaChainDefinition } from '../../src'
import { formatUnits, parseUnits, Contract } from 'ethers'

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers')
  return {
    ...actual,
    BrowserProvider: jest.fn().mockImplementation(() => ({})),
    JsonRpcSigner: jest.fn().mockImplementation(() => ({})),
    Contract: jest.fn(),
  }
})

describe('HederaAdapter complete coverage', () => {
  test('constructor validates hedera networks', () => {
    expect(() =>
      new HederaAdapter({
        namespace: hederaNamespace,
        networks: [{ chainNamespace: 'eip155' } as any],
      }),
    ).toThrow('Invalid networks for hedera namespace')
  })

  test('setUniversalProvider and disconnect', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    const provider = { disconnect: jest.fn(), setDefaultChain: jest.fn() } as any
    adapter.setUniversalProvider(provider)
    expect((adapter as any).connectors.length).toBe(1)
    await adapter.disconnect()
    expect(provider.disconnect).toHaveBeenCalled()
  })

  test('syncConnectors resolves', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    await expect(adapter.syncConnectors()).resolves.toBeUndefined()
  })

  test('utility and unsupported methods', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    const parsed = adapter.parseUnits({ value: '2', decimals: 8 })
    expect(parsed.toString()).toBe(parseUnits('2', 8).toString())
    const formatted = adapter.formatUnits({ value: parsed, decimals: 8 })
    expect(formatted).toBe(formatUnits(parsed, 8))
    await expect(adapter.getProfile()).resolves.toEqual({ profileImage: '', profileName: '' })
    await expect(adapter.grantPermissions()).resolves.toEqual({})
    await expect(adapter.revokePermissions()).resolves.toBe('0x')
  })

  test('syncConnection and switchNetwork', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    const provider = { setDefaultChain: jest.fn(), disconnect: jest.fn() } as any
    adapter.setUniversalProvider(provider)
    const res = await adapter.syncConnection({ chainId: '1' })
    expect(res.type).toBe('WALLET_CONNECT')
    await adapter.switchNetwork({ caipNetwork: { caipNetworkId: '5' } as any })
    expect(provider.setDefaultChain).toHaveBeenCalledWith('5')
    expect(adapter.getWalletConnectProvider()).toBe(provider)
  })

  test('walletGetAssets returns empty object', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    await expect(adapter.walletGetAssets({} as any)).resolves.toEqual({})
  })

  test('getEnsAddress default path', async () => {
    const adapter = new HederaAdapter({ namespace: 'eip155' })
    const res = await adapter.getEnsAddress({ name: 'foo' } as any)
    expect(res.address).toBe(false)
  })

  test('writeContract executes method', async () => {
    const adapter = new HederaAdapter({
      namespace: 'eip155',
      networks: [HederaChainDefinition.EVM.Testnet],
    })
    const mockMethod = jest.fn().mockResolvedValue('0xabc')
    ;(Contract as unknown as jest.Mock).mockImplementation(() => ({
      transfer: mockMethod,
    }))
    const result = await adapter.writeContract({
      provider: {} as any,
      caipNetwork: HederaChainDefinition.EVM.Testnet,
      caipAddress: '0x1',
      abi: [],
      tokenAddress: '0x2',
      method: 'transfer',
      args: [1],
    } as any)
    expect(mockMethod).toHaveBeenCalled()
    expect(result.hash).toBe('0xabc')
  })

  test('getCapabilities branches', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    await expect(adapter.getCapabilities('0x1' as any)).rejects.toThrow('Namespace is not eip155')

    const evmAdapter = new HederaAdapter({ namespace: 'eip155' })
    const req = jest.fn().mockResolvedValue('cap')
    // Set provider directly on adapter
    ;(evmAdapter as any).provider = { session: { sessionProperties: {} }, request: req }
    const res = await evmAdapter.getCapabilities('0x1' as any)
    expect(req).toHaveBeenCalled()
    expect(res).toBe('cap')
  })

  test('writeContract error when method missing', async () => {
    const adapter = new HederaAdapter({ namespace: 'eip155' })
    await expect(
      adapter.writeContract({ provider: {} as any, method: undefined } as any),
    ).rejects.toThrow('Contract method is undefined')
  })

  test('writeContract error when contract lacks method', async () => {
    const adapter = new HederaAdapter({ namespace: 'eip155' })
    ;(Contract as unknown as jest.Mock).mockImplementation(() => ({}))
    await expect(
      adapter.writeContract({
        provider: {} as any,
        caipNetwork: HederaChainDefinition.EVM.Testnet,
        caipAddress: '0x',
        abi: [],
        tokenAddress: '0x2',
        method: 'transfer',
        args: [],
      } as any),
    ).rejects.toThrow('Contract method is undefined')
  })

  test('disconnect handles errors', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    const error = new Error('fail')
    const provider = { disconnect: jest.fn().mockRejectedValue(error) } as any
    adapter.setUniversalProvider(provider)
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    await adapter.disconnect()
    expect(warn).toHaveBeenCalledWith('[WARN - HederaAdapter] disconnect - error', error)
    warn.mockRestore()
  })
})
