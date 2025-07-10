import { HederaAdapter, HederaChainDefinition, hederaNamespace } from '../../src'
import { ProviderUtil } from '@reown/appkit/store'

describe('HederaAdapter extra branches', () => {
  it('constructor validates inputs', () => {
    expect(() => new HederaAdapter({ namespace: 'bad' as any })).toThrow()
    expect(() =>
      new HederaAdapter({
        namespace: 'eip155',
        networks: [{ chainNamespace: hederaNamespace } as any],
      }),
    ).toThrow('Invalid networks for eip155 namespace')
  })

  it('sendTransaction errors when namespace invalid', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    await expect(
      adapter.sendTransaction({ provider: {} as any } as any),
    ).rejects.toThrow('Namespace is not eip155')
  })

  it('writeContract errors for invalid namespace and provider', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    await expect(
      adapter.writeContract({ provider: {} as any } as any),
    ).rejects.toThrow('Namespace is not eip155')

    const evm = new HederaAdapter({ namespace: 'eip155' })
    await expect(
      evm.writeContract({ provider: undefined } as any),
    ).rejects.toThrow('Provider is undefined')
  })

  it('estimateGas executes with provider', async () => {
    const adapter = new HederaAdapter({ namespace: 'eip155' })
    const mock = jest.fn().mockResolvedValue(BigInt(5))
    const res = await adapter.estimateGas({
      provider: { eth_estimateGas: mock } as any,
      caipNetwork: HederaChainDefinition.EVM.Testnet,
      address: '0x',
      data: '0x',
      to: '0x',
    } as any)
    expect(mock).toHaveBeenCalled()
    expect(res.gas).toBe(BigInt(5))
  })

  it('getEnsAddress throws on wrong namespace', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    await expect(
      adapter.getEnsAddress({ name: 'demo.hbar' } as any),
    ).rejects.toThrow('Namespace is not eip155')
  })

  it('getWalletConnectConnector throws when missing', () => {
    const adapter = new HederaAdapter({ namespace: 'eip155' })
    expect(() => adapter['getWalletConnectConnector']()).toThrow(
      'WalletConnectConnector not found',
    )
  })


  it('getCapabilities parses capabilities', async () => {
    const adapter = new HederaAdapter({ namespace: 'eip155' })
    jest.spyOn(ProviderUtil, 'getProvider').mockReturnValue({
      session: { sessionProperties: { capabilities: '{"0x1": {"gas": "1"}}' } },
      request: jest.fn(),
    } as any)
    const caps = await adapter.getCapabilities('0x1' as any)
    expect(caps).toEqual({ gas: '1' })
  })
})
