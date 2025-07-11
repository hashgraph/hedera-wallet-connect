import { EventEmitter } from 'events'
import EIP155Provider from '../../../src/reown/providers/EIP155Provider'
import { JsonRpcProvider } from '@walletconnect/jsonrpc-provider'
import { HttpConnection } from '@walletconnect/jsonrpc-http-connection'

jest.mock('@walletconnect/jsonrpc-provider', () => {
  return {
    JsonRpcProvider: jest.fn().mockImplementation(function (this: any, conn: any) {
      this.connection = conn
      this.request = jest.fn().mockResolvedValue('rpc')
    })
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

function createProvider(extraMethods: string[] = []) {
  const namespace = {
    chains: ['eip155:296'],
    accounts: ['eip155:296:0xabc'],
    events: [],
    methods: ['wallet_switchEthereumChain', ...extraMethods],
    rpcMap: { 'eip155:296': 'https://rpc' },
  }
  const events = new EventEmitter()
  return new EIP155Provider({ client: mockClient, events, namespace })
}

afterEach(() => {
  jest.clearAllMocks()
})

describe('EIP155Provider request and extra paths', () => {
  it('handles known methods in request', async () => {
    const provider = createProvider(['wallet_getCallsStatus'])
    jest.spyOn(provider as any, 'switchChain').mockResolvedValue(null)
    jest.spyOn(provider as any, 'getCallStatus').mockResolvedValue('status')

    await expect(
      provider.request({ topic: 't', request: { method: 'eth_requestAccounts' }, chainId: 'eip155:296' } as any),
    ).resolves.toEqual(['0xabc'])
    await expect(
      provider.request({ topic: 't', request: { method: 'eth_accounts' }, chainId: 'eip155:296' } as any),
    ).resolves.toEqual(['0xabc'])
    await provider.request({
      topic: 't',
      request: { method: 'wallet_switchEthereumChain', params: [{ chainId: '0x128' }] },
      chainId: 'eip155:296',
    } as any)
    expect((provider as any).switchChain).toHaveBeenCalled()
    await expect(
      provider.request({ topic: 't', request: { method: 'eth_chainId' }, chainId: 'eip155:296' } as any),
    ).resolves.toBe(296)
    await expect(
      provider.request({ topic: 't', request: { method: 'wallet_getCallsStatus' }, chainId: 'eip155:296' } as any),
    ).resolves.toBe('status')
  })

  it('delegates to client or http provider', async () => {
    const provider = createProvider(['foo'])
    await provider.request({ topic: 't', request: { method: 'foo' }, chainId: 'eip155:296' } as any)
    expect(mockClient.request).toHaveBeenCalled()

    mockClient.request.mockClear()
    const httpReq = (provider as any).httpProviders[296].request as jest.Mock
    await provider.request({ topic: 't', request: { method: 'bar' }, chainId: 'eip155:296' } as any)
    expect(httpReq).toHaveBeenCalled()
  })

  it('updateNamespace merges namespace', () => {
    const provider = createProvider()
    provider.updateNamespace({
      chains: ['eip155:296'],
      accounts: ['eip155:296:0xdef'],
      events: [],
      methods: [],
      rpcMap: {},
    })
    expect(provider.namespace.accounts).toContain('eip155:296:0xdef')
  })

  it('getAccounts handles missing accounts', () => {
    const provider = createProvider()
    ;(provider as any).namespace.accounts = undefined
    expect((provider as any).getAccounts()).toEqual([])
  })

  it('getCallStatus warns when bundler fetch fails', async () => {
    const provider = createProvider(['wallet_getCallsStatus'])
    ;(provider as any).getUserOperationReceipt = jest.fn().mockRejectedValue(new Error('fail'))
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    mockClient.session.get.mockReturnValueOnce({ sessionProperties: { bundler_name: 'b' } })
    const res = await (provider as any).getCallStatus({
      topic: 't',
      request: { method: 'wallet_getCallsStatus', params: ['0x1'] },
      chainId: 'eip155:296',
    } as any)
    expect(warn).toHaveBeenCalled()
    expect(res).toBe('client')
    warn.mockRestore()
  })

  it('getCallStatus warns when custom url fetch fails', async () => {
    const provider = createProvider(['wallet_getCallsStatus'])
    ;(provider as any).getUserOperationReceipt = jest.fn().mockRejectedValue(new Error('fail'))
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    mockClient.session.get.mockReturnValueOnce({ sessionProperties: { bundler_url: 'https://b' } })
    await (provider as any).getCallStatus({
      topic: 't',
      request: { method: 'wallet_getCallsStatus', params: ['0x1'] },
      chainId: 'eip155:296',
    } as any)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('getUserOperationReceipt succeeds', async () => {
    const provider = createProvider()
    const fetchMock = jest
      .spyOn(global, 'fetch' as any)
      .mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue('ok') } as any)
    const res = await (provider as any).getUserOperationReceipt('https://b', { request: { params: ['0x1'] } } as any)
    expect(res).toBe('ok')
    fetchMock.mockRestore()
  })
})
