import { HederaAdapter, hederaNamespace } from '../../src'

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

  test('utility methods', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    const parsed = adapter.parseUnits({ value: '2', decimals: 8 })
    expect(parsed.toString()).toBe('200000000')
    const formatted = adapter.formatUnits({ value: parsed, decimals: 8 })
    expect(formatted).toBe('2')
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

  test('estimateGas throws for hedera namespace', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    await expect(adapter.estimateGas({} as any)).rejects.toThrow(
      'estimateGas is not supported for the hedera namespace',
    )
  })

  test('sendTransaction throws for hedera namespace', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    await expect(adapter.sendTransaction({} as any)).rejects.toThrow(
      'sendTransaction is not supported for the hedera namespace',
    )
  })

  test('writeContract throws for hedera namespace', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    await expect(adapter.writeContract({} as any)).rejects.toThrow(
      'writeContract is not supported for the hedera namespace',
    )
  })

  test('getCapabilities throws for hedera namespace', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    await expect(adapter.getCapabilities('0x1' as any)).rejects.toThrow(
      'getCapabilities is not supported for the hedera namespace',
    )
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

  test('constructor rejects non-hedera namespace', () => {
    expect(() => new HederaAdapter({ namespace: 'eip155' as any })).toThrow(
      'Namespace must be "hedera"',
    )
  })
})
