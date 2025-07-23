import { EventEmitter } from 'events'
import EIP155Provider from '../../../src/reown/providers/EIP155Provider'
import { JsonRpcProvider } from '@walletconnect/jsonrpc-provider'
import { HttpConnection } from '@walletconnect/jsonrpc-http-connection'

jest.mock('@walletconnect/jsonrpc-provider', () => {
  return {
    JsonRpcProvider: jest.fn().mockImplementation(function (this: any, conn: any) {
      this.connection = conn
      this.request = jest.fn().mockResolvedValue('rpc')
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

function createProvider(overrides: Partial<any> = {}) {
  const namespace = {
    chains: ['eip155:296'],
    accounts: ['eip155:296:0xabc'],
    events: [],
    methods: ['wallet_switchEthereumChain', 'wallet_getCallsStatus'],
    rpcMap: { 'eip155:296': 'https://rpc' },
    ...overrides,
  }
  const events = new EventEmitter()
  return new EIP155Provider({ client: mockClient, events, namespace })
}

describe('EIP155Provider branch coverage additions', () => {
  afterEach(() => {
    jest.clearAllMocks()
    mockClient.request.mockResolvedValue('client')
    mockClient.session.get.mockReturnValue({ sessionProperties: {} })
  })

  test('createHttpProviders handles missing rpcMap', () => {
    const provider = createProvider({ rpcMap: undefined })
    const http = provider['createHttpProviders']()
    expect(http[296]).toBeInstanceOf(JsonRpcProvider)
  })

  test('switchChain throws when params element missing', async () => {
    const provider = createProvider()
    await expect(
      provider['switchChain']({
        topic: 't',
        request: { method: 'wallet_switchEthereumChain', params: [] },
        chainId: 'eip155:296',
      } as any),
    ).rejects.toThrow()
  })

  test('switchChain passes undefined chain when namespace chains empty', async () => {
    const provider = createProvider()
    ;(provider as any).namespace.chains = undefined as any
    jest.spyOn(provider as any, 'isChainApproved').mockReturnValue(false)
    const reqSpy = jest.spyOn(mockClient, 'request').mockResolvedValue(null as any)
    await provider['switchChain']({
      topic: 't',
      request: { method: 'wallet_switchEthereumChain', params: [{ chainId: '0x128' }] },
      chainId: 'eip155:296',
    } as any)
    expect(reqSpy.mock.calls[0][0].chainId).toBeUndefined()
  })

  test('getCallStatus handles missing session properties', async () => {
    const provider = createProvider()
    mockClient.session.get.mockReturnValueOnce({})
    const res = await (provider as any).getCallStatus({
      topic: 't',
      request: { method: 'wallet_getCallsStatus', params: ['0x1'] },
      chainId: 'eip155:296',
    } as any)
    expect(res).toBe('client')
  })

  test('getUserOperationReceipt sends undefined param when missing', async () => {
    const provider = createProvider()
    const fetchMock = jest
      .spyOn(global, 'fetch' as any)
      .mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue('ok') } as any)
    const res = await (provider as any).getUserOperationReceipt('https://b', {} as any)
    expect(res).toBe('ok')
    await (provider as any).getUserOperationReceipt('https://b', { request: {} } as any)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body)
    expect(body.params[0]).toBeNull()
    fetchMock.mockRestore()
  })
})
