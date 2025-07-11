import { EventEmitter } from 'events'
import EIP155Provider from '../../../src/reown/providers/EIP155Provider'
import { JsonRpcProvider } from '@walletconnect/jsonrpc-provider'
import { HttpConnection } from '@walletconnect/jsonrpc-http-connection'

jest.mock('@walletconnect/jsonrpc-provider', () => {
  return {
    JsonRpcProvider: jest.fn().mockImplementation(function (this: any, conn: any) {
      this.connection = conn
      this.request = jest.fn()
    }),
  }
})

jest.mock('@walletconnect/jsonrpc-http-connection', () => {
  return { HttpConnection: jest.fn().mockImplementation(function (url: string) { this.url = url }) }
})

const mockClient = {
  core: { projectId: 'pid' },
  request: jest.fn().mockResolvedValue('client'),
  session: { get: jest.fn(() => ({ sessionProperties: {} })) },
} as any

function createProvider() {
  const namespace = {
    chains: ['eip155:296'],
    accounts: ['eip155:296:0xabc'],
    events: [],
    methods: ['wallet_switchEthereumChain'],
    rpcMap: { 'eip155:296': 'https://rpc' },
  }
  const events = new EventEmitter()
  return new EIP155Provider({ client: mockClient, events, namespace })
}

describe('EIP155Provider remaining branches', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  test('getDefaultChain uses namespace default and throws when chain missing', () => {
    const provider = createProvider()
    provider.chainId = 0 as any
    provider.namespace.defaultChain = '123'
    expect(provider.getDefaultChain()).toBe('123')

    provider.namespace.defaultChain = undefined as any
    provider.namespace.chains = []
    expect(() => provider.getDefaultChain()).toThrow('ChainId not found')
  })

  test('setHttpProvider ignores undefined provider', () => {
    const provider = createProvider()
    provider['setHttpProvider'](0)
    expect(provider['httpProviders'][0]).toBeUndefined()
  })

  test('switchChain handles missing params', async () => {
    const provider = createProvider()
    const reqSpy = jest.spyOn(mockClient, 'request').mockResolvedValue(null as any)
    await provider['switchChain']({
      topic: 't',
      request: { method: 'wallet_switchEthereumChain' },
      chainId: 'eip155:296',
    } as any)
    expect(reqSpy).toHaveBeenCalled()
    expect(provider.chainId).toBe(0)
  })

  test('switchChain prefixes chain id without 0x', async () => {
    const provider = createProvider()
    const reqSpy = jest.spyOn(mockClient, 'request').mockResolvedValue(null as any)
    jest.spyOn(provider as any, 'createHttpProvider').mockReturnValue({} as any)
    await provider['switchChain']({
      topic: 't',
      request: { method: 'wallet_switchEthereumChain', params: [{ chainId: '129' }] },
      chainId: 'eip155:296',
    } as any)
    expect(reqSpy).toHaveBeenCalled()
    expect(provider.chainId).toBe(0x129)
  })
})
