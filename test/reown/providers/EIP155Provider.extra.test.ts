import { EventEmitter } from 'events'
import EIP155Provider from '../../../src/reown/providers/EIP155Provider'
import { JsonRpcProvider } from '@walletconnect/jsonrpc-provider'
import { HttpConnection } from '@walletconnect/jsonrpc-http-connection'

jest.mock('@walletconnect/jsonrpc-provider', () => {
  return { JsonRpcProvider: jest.fn().mockImplementation(function (this: any, conn: any) { this.connection = conn; this.request = jest.fn() }) }
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
    methods: ['wallet_switchEthereumChain', 'wallet_getCallsStatus'],
    rpcMap: { 'eip155:296': 'https://rpc' },
  }
  const events = new EventEmitter()
  return new EIP155Provider({ client: mockClient, events, namespace })
}

describe('EIP155Provider extra branches', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('createHttpProvider handles invalid input', () => {
    const provider = createProvider()
    expect(provider['createHttpProvider'](0)).toBeUndefined()
    expect(() => provider['createHttpProvider'](999)).toThrow('No RPC url provided')
  })

  it('getDefaultChain falls back to namespace', () => {
    const provider = createProvider()
    provider.chainId = 0 as any
    delete (provider as any).namespace.defaultChain
    expect(provider.getDefaultChain()).toBe('296')
  })

  it('getHttpProvider throws when missing', () => {
    const provider = createProvider()
    provider['httpProviders'] = {}
    expect(() => provider['getHttpProvider']()).toThrow('JSON-RPC provider')
  })

  it('switchChain errors when not approved and wallet lacks method', async () => {
    const provider = createProvider()
    provider.namespace.methods = []
    await expect(
      provider['switchChain']({
        topic: 't',
        request: { method: 'wallet_switchEthereumChain', params: [{ chainId: '0x129' }] },
        chainId: 'eip155:296',
      } as any),
    ).rejects.toThrow()
  })

  it('getCallStatus uses custom url and throws when not approved', async () => {
    const provider = createProvider()
    ;(provider as any).getUserOperationReceipt = jest.fn().mockResolvedValue('ok')
    mockClient.session.get.mockReturnValueOnce({ sessionProperties: { bundler_url: 'https://bundler' } })
    expect(
      await provider['getCallStatus']({
        topic: 't',
        request: { method: 'wallet_getCallsStatus', params: ['0x1'] },
        chainId: 'eip155:296',
      } as any),
    ).toBe('ok')

    provider.namespace.methods = []
    await expect(
      provider['getCallStatus']({
        topic: 't',
        request: { method: 'wallet_getCallsStatus', params: ['0x1'] },
        chainId: 'eip155:296',
      } as any),
    ).rejects.toThrow('Fetching call status not approved')
  })

  it('isChainApproved checks namespace', () => {
    const provider = createProvider()
    expect(provider['isChainApproved'](296)).toBe(true)
    expect(provider['isChainApproved'](1)).toBe(false)
  })
})
