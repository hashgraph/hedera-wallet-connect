import { UniversalProvider } from '@walletconnect/universal-provider'
import { HederaProvider, HederaJsonRpcMethod, createNamespaces, HederaChainDefinition } from '../../../src'
import { requestTopic, testUserAccountId } from '../../_helpers'

jest.mock('@walletconnect/universal-provider')
jest.mock('../../../src/reown/providers/HIP820Provider')

describe('HederaProvider additional branches', () => {
  let provider: HederaProvider
  const sessionBase = {
    topic: requestTopic,
    namespaces: {
      hedera: { accounts: [`hedera:testnet:${testUserAccountId.toString()}`] },
    },
  } as any

  beforeEach(async () => {
    provider = await HederaProvider.init({ projectId: 't', logger: 'error' })
    provider.client = {} as any
  })

  test('initProviders returns empty when no session', () => {
    expect((provider as any).initProviders()).toEqual({})
  })

  test('initProviders warns on unsupported namespace', () => {
    provider.session = { topic: 't', namespaces: { foo: { accounts: [] } } } as any
    provider.namespaces = provider.session.namespaces
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const result = (provider as any).initProviders()
    // The unsupported namespace is skipped with a warning, not thrown
    expect(Object.keys(result)).not.toContain('foo')
    warnSpy.mockRestore()
  })

  test('initProviders sets providers', () => {
    provider.session = sessionBase
    provider.namespaces = createNamespaces([
      HederaChainDefinition.Native.Testnet,
    ])
    const result = (provider as any).initProviders()
    expect('hedera' in result).toBe(true)
  })

  test('initProviders skips eip155 namespace', () => {
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
    const result = (provider as any).initProviders()
    expect('hedera' in result).toBe(true)
    expect('eip155' in result).toBe(false)
  })

  test('rpcProviders calls init when missing', () => {
    const spy = jest.spyOn(provider as any, 'initProviders').mockReturnValue({ hedera: 1 } as any)
    const res = provider.rpcProviders
    expect(spy).toHaveBeenCalled()
    expect(res).toEqual({ hedera: 1 })
  })

  test('getAccountAddresses errors without session', () => {
    expect(() => provider.getAccountAddresses()).toThrow('Not initialized')
  })

  test('request throws when not connected', async () => {
    await expect(provider.request({ method: 'eth_chainId' })).rejects.toThrow('connect() before request')
  })

  test('request handles missing nativeProvider', async () => {
    provider.session = sessionBase
    provider.namespaces = createNamespaces([
      HederaChainDefinition.Native.Testnet,
    ])
    await expect(
      provider.request({ method: HederaJsonRpcMethod.SignMessage })
    ).rejects.toThrow('nativeProvider not initialized')
  })
})
