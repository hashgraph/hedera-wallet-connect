import { UniversalProvider } from '@walletconnect/universal-provider'
import { HederaProvider, HederaJsonRpcMethod, createNamespaces, HederaChainDefinition } from '../../../src'
import { requestTopic, testUserAccountId } from '../../_helpers'

jest.mock('ethers')
jest.mock('@walletconnect/universal-provider')
jest.mock('../../../src/reown/providers/HIP820Provider')
jest.mock('../../../src/reown/providers/EIP155Provider')

describe('HederaProvider additional branches', () => {
  let provider: HederaProvider
  const sessionBase = {
    topic: requestTopic,
    namespaces: {
      hedera: { accounts: [`hedera:testnet:${testUserAccountId.toString()}`] },
      eip155: { accounts: ['eip155:296:0xabc'] },
    },
  } as any

  beforeEach(async () => {
    provider = await HederaProvider.init({ projectId: 't', logger: 'error' })
    provider.client = {} as any
  })

  test('initProviders returns empty when no session', () => {
    expect((provider as any).initProviders()).toEqual({})
  })

  test('initProviders throws on unsupported namespace', () => {
    provider.session = { topic: 't', namespaces: { foo: { accounts: [] } } } as any
    provider.namespaces = provider.session.namespaces
    expect(() => (provider as any).initProviders()).toThrow('Unsupported namespace: foo')
  })

  test('initProviders sets providers', () => {
    provider.session = sessionBase
    provider.namespaces = createNamespaces([
      HederaChainDefinition.Native.Testnet,
      HederaChainDefinition.EVM.Testnet,
    ])
    const result = (provider as any).initProviders()
    expect('hedera' in result && 'eip155' in result).toBe(true)
  })

  test('rpcProviders calls init when missing', () => {
    const spy = jest.spyOn(provider as any, 'initProviders').mockReturnValue({ hedera: 1, eip155: 2 } as any)
    const res = provider.rpcProviders
    expect(spy).toHaveBeenCalled()
    expect(res).toEqual({ hedera: 1, eip155: 2 })
  })

  test('getAccountAddresses errors without session', () => {
    expect(() => provider.getAccountAddresses()).toThrow('Not initialized')
  })

  test('request throws when not connected', async () => {
    await expect(provider.request({ method: 'eth_chainId' })).rejects.toThrow('connect() before request')
  })

  test('request handles missing providers', async () => {
    provider.session = sessionBase
    provider.namespaces = createNamespaces([
      HederaChainDefinition.Native.Testnet,
      HederaChainDefinition.EVM.Testnet,
    ])
    await expect(
      provider.request({ method: HederaJsonRpcMethod.SignMessage })
    ).rejects.toThrow('nativeProvider not initialized')

    provider.nativeProvider = {} as any
    await expect(provider.request({ method: 'eth_chainId' })).rejects.toThrow('eip155Provider not initialized')
  })
})
