import { HederaAdapter, hederaNamespace } from '../../src'

describe('HederaAdapter extra branches', () => {
  it('constructor rejects non-hedera namespace', () => {
    expect(() => new HederaAdapter({ namespace: 'bad' as any })).toThrow()
    expect(() => new HederaAdapter({ namespace: 'eip155' as any })).toThrow(
      'Namespace must be "hedera"',
    )
  })

  it('constructor rejects invalid networks for hedera namespace', () => {
    expect(() =>
      new HederaAdapter({
        namespace: hederaNamespace,
        networks: [{ chainNamespace: 'eip155' } as any],
      }),
    ).toThrow('Invalid networks for hedera namespace')
  })

  it('estimateGas throws for hedera namespace', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    await expect(
      adapter.estimateGas({ provider: {} as any } as any),
    ).rejects.toThrow('estimateGas is not supported for the hedera namespace')
  })

  it('sendTransaction throws for hedera namespace', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    await expect(
      adapter.sendTransaction({ provider: {} as any } as any),
    ).rejects.toThrow('sendTransaction is not supported for the hedera namespace')
  })

  it('writeContract throws for hedera namespace', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    await expect(
      adapter.writeContract({ provider: {} as any } as any),
    ).rejects.toThrow('writeContract is not supported for the hedera namespace')
  })

  it('getCapabilities throws for hedera namespace', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    await expect(adapter.getCapabilities('0x1' as any)).rejects.toThrow(
      'getCapabilities is not supported for the hedera namespace',
    )
  })

  it('getWalletConnectConnector throws when missing', () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    expect(() => adapter['getWalletConnectConnector']()).toThrow(
      'WalletConnectConnector not found',
    )
  })
})
