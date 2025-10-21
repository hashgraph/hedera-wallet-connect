import { HederaAdapter, HederaChainDefinition, hederaNamespace } from '../../src'
import { WcHelpersUtil } from '@reown/appkit-controllers'

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
      adapter.getEnsAddress({ name: 'demo.reown.id' } as any),
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
    // Set provider directly on adapter
    ;(adapter as any).provider = {
      session: { sessionProperties: { capabilities: '{"0x1": {"gas": "1"}}' } },
      request: jest.fn(),
    }
    const caps = await adapter.getCapabilities('0x1' as any)
    expect(caps).toEqual({ gas: '1' })
  })

  it('signMessage uses evm path', async () => {
    const adapter = new HederaAdapter({ namespace: 'eip155' })
    const mockProvider = { eth_signMessage: jest.fn().mockResolvedValue('0x1') } as any
    const res = await adapter.signMessage({ provider: mockProvider, message: 'm', address: '0xabc' } as any)
    expect(mockProvider.eth_signMessage).toHaveBeenCalled()
    expect(res.signature).toBe('0x1')
  })

  it('signMessage errors when provider missing', async () => {
    const adapter = new HederaAdapter({ namespace: 'eip155' })
    await expect(
      adapter.signMessage({ provider: undefined } as any),
    ).rejects.toThrow('Provider is undefined')
  })

  it('getCapabilities errors when provider missing', async () => {
    const adapter = new HederaAdapter({ namespace: 'eip155' })
    // Provider is undefined by default
    await expect(adapter.getCapabilities('0x1' as any)).rejects.toThrow('Provider is undefined')
  })

  it('getCapabilities errors on invalid json', async () => {
    const adapter = new HederaAdapter({ namespace: 'eip155' })
    // Set provider directly on adapter
    ;(adapter as any).provider = {
      session: { sessionProperties: { capabilities: 'bad' } },
      request: jest.fn(),
    }
    await expect(adapter.getCapabilities('0x1' as any)).rejects.toThrow('Error parsing wallet capabilities')
  })

describe('additional cases', () => {

  it('estimateGas throws when provider missing', async () => {
    const adapter = new HederaAdapter({ namespace: 'eip155' })
    await expect(adapter.estimateGas({ provider: undefined } as any)).rejects.toThrow('Provider is undefined')
  })

  it('estimateGas throws when namespace wrong', async () => {
    const adapter = new HederaAdapter({ namespace: hederaNamespace })
    await expect(
      adapter.estimateGas({ provider: {} as any, caipNetwork: HederaChainDefinition.EVM.Testnet } as any)
    ).rejects.toThrow('Namespace is not eip155')
  })

  it('getEnsAddress resolves reown name', async () => {
    const adapter = new HederaAdapter({ namespace: 'eip155' })
    jest.spyOn(WcHelpersUtil, 'resolveReownName').mockResolvedValue('0xabc' as any)
    const res = await adapter.getEnsAddress({ name: 'demo.reown.id', caipNetwork: HederaChainDefinition.EVM.Testnet } as any)
    expect(res.address).toBe('0xabc')
  })

  it('sendTransaction errors when provider missing', async () => {
    const adapter = new HederaAdapter({ namespace: 'eip155' })
    await expect(adapter.sendTransaction({ provider: undefined } as any)).rejects.toThrow('Provider is undefined')
  })

  it('getCapabilities falls back to provider request', async () => {
    const adapter = new HederaAdapter({ namespace: 'eip155' })
    const req = jest.fn().mockResolvedValue('cap')
    // Set provider directly on adapter
    ;(adapter as any).provider = { session: { sessionProperties: {} }, request: req }
    const res = await adapter.getCapabilities('0x1' as any)
    expect(req).toHaveBeenCalled()
    expect(res).toBe('cap')
  })
})
})
