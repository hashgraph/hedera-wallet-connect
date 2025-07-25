import { EventEmitter } from 'events'
import EIP155Provider from '../../../src/reown/providers/EIP155Provider'
import { JsonRpcProvider } from '@walletconnect/jsonrpc-provider'
import { HttpConnection } from '@walletconnect/jsonrpc-http-connection'

jest.mock('@walletconnect/jsonrpc-provider', () => {
  return { JsonRpcProvider: jest.fn().mockImplementation(function (this: any, conn: any) { this.connection = conn; this.request = jest.fn().mockResolvedValue('rpc'); }) }
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
    rpcMap: { 'eip155:296': 'https://test-rpc' },
  }
  const events = new EventEmitter()
  return new EIP155Provider({ client: mockClient, events, namespace })
}

describe('EIP155Provider basic', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('initializes and provides accounts', () => {
    const provider = createProvider()
    expect(provider.getDefaultChain()).toBe('296')
    expect(provider.requestAccounts()).toEqual(['0xabc'])
  })

  it('switchChain uses approved chain', async () => {
    const provider = createProvider()
    await provider['switchChain']({ topic: 't', request: { method: 'wallet_switchEthereumChain', params: [{ chainId: '0x128' }] }, chainId: 'eip155:296' } as any)
    expect(provider.chainId).toBe(0x128)
  })

  it('setDefaultChain emits event', () => {
    const events = new EventEmitter()
    const emitSpy = jest.spyOn(events, 'emit')
    const provider = new EIP155Provider({ client: mockClient, events, namespace: { chains: ['eip155:296'], accounts: [], events: [], methods: [], rpcMap: {} } })
    provider.setDefaultChain('296')
    expect(emitSpy).toHaveBeenCalledWith('default_chain_changed', 'eip155:296')
    expect(provider.getDefaultChain()).toBe('296')
  })

  it('http provider helpers and bundler url', async () => {
    const provider = createProvider()
    const http = provider['createHttpProvider'](296, 'https://rpc')!
    expect((http as any).connection).toBeInstanceOf(HttpConnection)
    provider['setHttpProvider'](296, 'https://rpc')
    expect(provider['getHttpProvider']()).toBeDefined()
    const url = provider['getBundlerUrl']('eip155:296', 'b')
    expect(url).toContain('bundler')
  })

  it('getCallStatus uses bundler', async () => {
    const provider = createProvider()
    ;(provider as any).getUserOperationReceipt = jest.fn().mockResolvedValue('ok')
    mockClient.session.get.mockReturnValueOnce({ sessionProperties: { bundler_name: 'b' } })
    const res = await provider['getCallStatus']({ topic: 't', request: { method: 'wallet_getCallsStatus', params: ['0x1'] }, chainId: 'eip155:296' } as any)
    expect(res).toBe('ok')
  })
})
