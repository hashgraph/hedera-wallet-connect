import { EventEmitter } from 'events'
import { engineEvent } from '@walletconnect/utils'
import {
  installWalletConnectMultiTabRouter,
  resolveWalletConnectMultiTabRouterOptions,
  WalletConnectMultiTabRouter,
} from '../../src/lib/shared/WalletConnectMultiTabRouter'

type TestClient = {
  client: any
  events: EventEmitter
  originalSendRequest: jest.Mock
  originalProviderHandler: jest.Mock
  decode: jest.Mock
  historyResolve: jest.Mock
  historyDelete: jest.Mock
  ack: jest.Mock
}

type StoredOwner = {
  version: 2
  key: string
  topic: string
  rpcId: number
  ownerInstanceId: string
  expiresAt: number
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()
  public failReads = false
  public failWrites = false

  get length(): number {
    if (this.failReads) throw new DOMException('Storage denied', 'SecurityError')
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    if (this.failReads) throw new DOMException('Storage denied', 'SecurityError')
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    if (this.failReads) throw new DOMException('Storage denied', 'SecurityError')
    return Array.from(this.values.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new DOMException('Storage denied', 'SecurityError')
    this.values.set(key, value)
  }
}

class MockBroadcastChannel {
  private static readonly channels = new Map<string, Set<MockBroadcastChannel>>()
  public onmessage: ((event: MessageEvent<unknown>) => void) | null = null

  constructor(private readonly name: string) {
    const peers = MockBroadcastChannel.channels.get(name) ?? new Set<MockBroadcastChannel>()
    peers.add(this)
    MockBroadcastChannel.channels.set(name, peers)
  }

  postMessage(data: unknown): void {
    for (const peer of MockBroadcastChannel.channels.get(this.name) ?? []) {
      if (peer !== this) peer.onmessage?.({ data } as MessageEvent<unknown>)
    }
  }

  close(): void {
    MockBroadcastChannel.channels.get(this.name)?.delete(this)
  }

  static clear(): void {
    MockBroadcastChannel.channels.clear()
  }
}

class TestWindow {
  private readonly storageListeners = new Set<(event: StorageEvent) => void>()
  public readonly BroadcastChannel?: typeof BroadcastChannel

  constructor(
    public readonly localStorage: Storage,
    withBroadcastChannel: boolean = true,
    broadcastChannel: typeof BroadcastChannel = MockBroadcastChannel as unknown as typeof BroadcastChannel,
  ) {
    this.BroadcastChannel = withBroadcastChannel ? broadcastChannel : undefined
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type !== 'storage') return
    const callback =
      typeof listener === 'function'
        ? (listener as (event: StorageEvent) => void)
        : (event: StorageEvent) => listener.handleEvent(event)
    this.storageListeners.add(callback)
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type !== 'storage' || typeof listener !== 'function') return
    this.storageListeners.delete(listener as (event: StorageEvent) => void)
  }

  dispatchStorage(key: string, newValue: string | null): void {
    const event = { key, newValue, storageArea: this.localStorage } as StorageEvent
    for (const listener of this.storageListeners) listener(event)
  }
}

const metadata = { name: 'Test dApp', url: 'https://dapp.example' }

const createLogger = () => ({
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
})

const createClient = (providerHandler?: jest.Mock): TestClient => {
  const events = new EventEmitter()
  const originalSendRequest = jest.fn(async (args) => args.clientRpcId ?? 0)
  const defaultProviderHandler = jest.fn(async (event) => {
    const payload = JSON.parse(event.message)
    const target = engineEvent('session_request', payload.id)
    if ('result' in payload) events.emit(target, { result: payload.result })
    else if ('error' in payload) events.emit(target, { error: payload.error })
  })
  const originalProviderHandler = providerHandler ?? defaultProviderHandler
  const decode = jest.fn(async (_topic: string, message: string) => JSON.parse(message))
  const historyResolve = jest.fn(async () => undefined)
  const historyDelete = jest.fn()
  const ack = jest.fn(async () => undefined)

  return {
    client: {
      engine: {
        events,
        sendRequest: originalSendRequest,
        onProviderMessageEvent: originalProviderHandler,
      },
      core: {
        projectId: 'project-id',
        crypto: { decode },
        history: {
          resolve: historyResolve,
          delete: historyDelete,
        },
        relayer: {
          messages: { ack },
        },
      },
    },
    events,
    originalSendRequest,
    originalProviderHandler,
    decode,
    historyResolve,
    historyDelete,
    ack,
  }
}

const responseEvent = (id: number, payload: Record<string, unknown>) => ({
  topic: 'session-topic',
  message: JSON.stringify({ id, jsonrpc: '2.0', ...payload }),
  transportType: 'relay' as const,
})

const requestArgs = (id: number, expiry: number = 300) => ({
  topic: 'session-topic',
  method: 'wc_sessionRequest',
  clientRpcId: id,
  expiry,
  params: {
    request: { method: 'hedera_signMessage' },
    chainId: 'hedera:testnet',
  },
})

const oncePayload = (events: EventEmitter, event: string): Promise<unknown> =>
  new Promise((resolve) => events.once(event, resolve))

const flushPromises = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
}

const storageKeys = (storage: Storage): string[] =>
  Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(
    (key): key is string => !!key,
  )

const findOwner = (
  storage: Storage,
  requestKey: string,
): { storageKey: string; owner: StoredOwner } => {
  const storageKey = storageKeys(storage).find(
    (key) => key.includes('/owner/') && key.endsWith(requestKey),
  )
  if (!storageKey) throw new Error(`Owner not found for ${requestKey}`)
  return { storageKey, owner: JSON.parse(storage.getItem(storageKey)!) as StoredOwner }
}

const storedResponse = (
  ownerStorageKey: string,
  owner: StoredOwner,
  payload: Record<string, unknown>,
  ttlMs: number = 120_000,
): { storageKey: string; value: string } => {
  const prefix = ownerStorageKey.slice(0, ownerStorageKey.indexOf('/owner/'))
  const storageKey = `${prefix}/response/${owner.ownerInstanceId}/${owner.key}`
  const now = Date.now()
  return {
    storageKey,
    value: JSON.stringify({
      version: 2,
      key: owner.key,
      topic: owner.topic,
      rpcId: owner.rpcId,
      ownerInstanceId: owner.ownerInstanceId,
      receivedByInstanceId: 'foreign-instance',
      createdAt: now,
      expiresAt: now + ttlMs,
      payload: { id: owner.rpcId, jsonrpc: '2.0', ...payload },
    }),
  }
}

describe('WalletConnectMultiTabRouter', () => {
  let originalWindowDescriptor: PropertyDescriptor | undefined
  let storage: MemoryStorage
  let browserWindow: TestWindow
  let routers: WalletConnectMultiTabRouter[]

  const setWindow = (value: unknown): void => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value,
      writable: true,
    })
  }

  const openClient = (
    client: TestClient,
    targetWindow: TestWindow = browserWindow,
    overrides: Record<string, unknown> = {},
  ): WalletConnectMultiTabRouter | undefined => {
    setWindow(targetWindow as unknown as Window)
    const router = installWalletConnectMultiTabRouter(client.client, {
      enabled: true,
      projectId: 'project-id',
      metadata,
      ...overrides,
    })
    if (router) routers.push(router)
    return router
  }

  beforeEach(() => {
    originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    storage = new MemoryStorage()
    browserWindow = new TestWindow(storage)
    routers = []
    setWindow(browserWindow as unknown as Window)
    jest.setSystemTime(new Date('2026-07-14T12:00:00.000Z'))
  })

  afterEach(() => {
    for (const router of routers) router.destroy()
    MockBroadcastChannel.clear()
    jest.clearAllTimers()
    if (originalWindowDescriptor) {
      Object.defineProperty(globalThis, 'window', originalWindowDescriptor)
    } else {
      delete (globalThis as { window?: unknown }).window
    }
    jest.clearAllMocks()
  })

  it('is explicitly opt-in and preserves custom timing options', () => {
    expect(
      resolveWalletConnectMultiTabRouterOptions(undefined, {
        projectId: 'project-id',
        metadata,
      }),
    ).toEqual({
      enabled: false,
      metadata,
      projectId: 'project-id',
      requestGraceMs: undefined,
      responseTtlMs: undefined,
    })
    expect(
      resolveWalletConnectMultiTabRouterOptions(
        { enabled: true, requestGraceMs: 10, responseTtlMs: 20 },
        { projectId: 'project-id', metadata },
      ),
    ).toMatchObject({ enabled: true, requestGraceMs: 10, responseTtlMs: 20 })
  })

  it('does not patch the client when disabled', () => {
    const tab = createClient()
    const sendRequest = tab.client.engine.sendRequest
    const onProviderMessageEvent = tab.client.engine.onProviderMessageEvent

    const router = installWalletConnectMultiTabRouter(tab.client, {
      enabled: false,
      projectId: 'project-id',
      metadata,
    })

    expect(router).toBeUndefined()
    expect(tab.client.engine.sendRequest).toBe(sendRequest)
    expect(tab.client.engine.onProviderMessageEvent).toBe(onProviderMessageEvent)
  })

  it('fails open when the localStorage getter throws', () => {
    const tab = createClient()
    const logger = createLogger()
    const sendRequest = tab.client.engine.sendRequest
    const onProviderMessageEvent = tab.client.engine.onProviderMessageEvent
    const deniedWindow = {
      get localStorage(): Storage {
        throw new DOMException('Storage denied', 'SecurityError')
      },
    }
    setWindow(deniedWindow)

    const router = installWalletConnectMultiTabRouter(tab.client, {
      enabled: true,
      projectId: 'project-id',
      metadata,
      logger,
    })

    expect(router).toBeUndefined()
    expect(tab.client.engine.sendRequest).toBe(sendRequest)
    expect(tab.client.engine.onProviderMessageEvent).toBe(onProviderMessageEvent)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('writable browser localStorage'),
    )
  })

  it('fails open when required private SignClient APIs are absent', () => {
    const tab = createClient()
    const logger = createLogger()
    const sendRequest = tab.client.engine.sendRequest
    const onProviderMessageEvent = tab.client.engine.onProviderMessageEvent
    delete tab.client.core.history.resolve

    const router = openClient(tab, browserWindow, { logger })

    expect(router).toBeUndefined()
    expect(tab.client.engine.sendRequest).toBe(sendRequest)
    expect(tab.client.engine.onProviderMessageEvent).toBe(onProviderMessageEvent)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('incompatible with this SignClient version'),
      expect.objectContaining({ missingApis: ['core.history.resolve'] }),
    )
  })

  it('does not stack on top of an incompatible router patch', () => {
    const tab = createClient()
    const logger = createLogger()
    const sendRequest = tab.client.engine.sendRequest
    const onProviderMessageEvent = tab.client.engine.onProviderMessageEvent
    tab.client.__hederaMultiTabRouter = { destroy: jest.fn() }

    const router = openClient(tab, browserWindow, { logger })

    expect(router).toBeUndefined()
    expect(tab.client.engine.sendRequest).toBe(sendRequest)
    expect(tab.client.engine.onProviderMessageEvent).toBe(onProviderMessageEvent)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('incompatible multi-tab patch'),
    )
  })

  it('normalizes invalid timing options to non-destructive defaults', () => {
    const tab = createClient()
    const logger = createLogger()

    openClient(tab, browserWindow, {
      logger,
      requestGraceMs: Number.NaN,
      responseTtlMs: 0,
    })

    expect(logger.debug).toHaveBeenCalledWith(
      'WalletConnect multi-tab router installed',
      expect.objectContaining({ requestGraceMs: 30_000, responseTtlMs: 120_000 }),
    )
  })

  it('routes a success response between two clients created in the same window', async () => {
    const owner = createClient()
    const wrongClient = createClient()
    openClient(owner)
    openClient(wrongClient)
    const target = engineEvent('session_request', 42)
    const routedPayload = oncePayload(owner.events, target)

    await owner.client.engine.sendRequest(requestArgs(42))
    const result = { transactionId: '0.0.123@1.2' }
    await wrongClient.client.engine.onProviderMessageEvent(responseEvent(42, { result }))

    await expect(routedPayload).resolves.toEqual({ result })
    expect(wrongClient.originalProviderHandler).not.toHaveBeenCalled()
    expect(wrongClient.ack).toHaveBeenCalledTimes(1)
    expect(owner.historyResolve).toHaveBeenCalledWith({ id: 42, jsonrpc: '2.0', result })
    expect(owner.historyResolve).toHaveBeenCalledTimes(1)
    expect(owner.historyDelete).toHaveBeenCalledWith('session-topic', 42)
    expect(storageKeys(storage).some((key) => key.includes('/owner/session-topic:42'))).toBe(
      false,
    )
  })

  it('routes a wallet error response to its owner', async () => {
    const owner = createClient()
    const wrongClient = createClient()
    openClient(owner)
    openClient(wrongClient)
    const target = engineEvent('session_request', 7)
    const routedPayload = oncePayload(owner.events, target)

    await owner.client.engine.sendRequest(requestArgs(7))
    const error = { code: 5000, message: 'User rejected request' }
    await wrongClient.client.engine.onProviderMessageEvent(responseEvent(7, { error }))

    await expect(routedPayload).resolves.toEqual({ error })
    expect(wrongClient.originalProviderHandler).not.toHaveBeenCalled()
    expect(owner.historyResolve).toHaveBeenCalledWith({ id: 7, jsonrpc: '2.0', error })
  })

  it('lets the owning client process its own response and then removes ownership', async () => {
    const owner = createClient()
    openClient(owner)
    const target = engineEvent('session_request', 99)
    const localPayload = oncePayload(owner.events, target)

    await owner.client.engine.sendRequest(requestArgs(99))
    await owner.client.engine.onProviderMessageEvent(responseEvent(99, { result: 'signed' }))

    await expect(localPayload).resolves.toEqual({ result: 'signed' })
    expect(owner.originalProviderHandler).toHaveBeenCalledTimes(1)
    expect(storageKeys(storage).some((key) => key.includes('/owner/session-topic:99'))).toBe(
      false,
    )
  })

  it('retains ownership when the local WalletConnect handler leaves its listener unresolved', async () => {
    const unresolvedHandler = jest.fn(async () => undefined)
    const owner = createClient(unresolvedHandler)
    const wrongClient = createClient()
    const logger = createLogger()
    openClient(owner, browserWindow, { logger })
    openClient(wrongClient)
    const target = engineEvent('session_request', 101)
    const routedPayload = oncePayload(owner.events, target)
    const event = responseEvent(101, { result: 'eventually-routed' })

    await owner.client.engine.sendRequest(requestArgs(101))
    await owner.client.engine.onProviderMessageEvent(event)

    expect(storageKeys(storage).some((key) => key.includes('/owner/session-topic:101'))).toBe(
      true,
    )
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('locally received response unresolved'),
      expect.any(Object),
    )

    await wrongClient.client.engine.onProviderMessageEvent(event)
    await expect(routedPayload).resolves.toEqual({ result: 'eventually-routed' })
  })

  it('deduplicates concurrent local, BroadcastChannel, and storage notifications', async () => {
    let releaseHistory!: () => void
    const historyGate = new Promise<void>((resolve) => {
      releaseHistory = resolve
    })
    const owner = createClient()
    owner.historyResolve.mockImplementation(async () => historyGate)
    const wrongClient = createClient()
    const ownerWindow = new TestWindow(storage)
    const wrongWindow = new TestWindow(storage)
    openClient(owner, ownerWindow)
    openClient(wrongClient, wrongWindow)
    const target = engineEvent('session_request', 102)
    const routedPayload = oncePayload(owner.events, target)

    await owner.client.engine.sendRequest(requestArgs(102))
    await wrongClient.client.engine.onProviderMessageEvent(
      responseEvent(102, { result: 'one-delivery' }),
    )
    const responseKey = storageKeys(storage).find((key) => key.includes('/response/'))!
    ownerWindow.dispatchStorage(responseKey, storage.getItem(responseKey))

    expect(owner.historyResolve).toHaveBeenCalledTimes(1)
    releaseHistory()
    await flushPromises()
    await expect(routedPayload).resolves.toEqual({ result: 'one-delivery' })
    expect(owner.historyResolve).toHaveBeenCalledTimes(1)
  })

  it('delivers to the active request listener even if WalletConnect history resolution fails', async () => {
    const owner = createClient()
    owner.historyResolve.mockRejectedValue(new Error('No matching key'))
    const wrongClient = createClient()
    const logger = createLogger()
    openClient(owner, browserWindow, { logger })
    openClient(wrongClient)
    const target = engineEvent('session_request', 103)
    const routedPayload = oncePayload(owner.events, target)

    await owner.client.engine.sendRequest(requestArgs(103))
    await wrongClient.client.engine.onProviderMessageEvent(
      responseEvent(103, { result: 'history-independent' }),
    )

    await expect(routedPayload).resolves.toEqual({ result: 'history-independent' })
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('history rejected a routed response'),
      expect.objectContaining({ rpcId: 103 }),
    )
    expect(storageKeys(storage).some((key) => key.includes('session-topic:103'))).toBe(false)
  })

  it('falls back to normal client handling when a routed response cannot be persisted', async () => {
    const owner = createClient()
    const wrongClient = createClient()
    openClient(owner)
    openClient(wrongClient)

    await owner.client.engine.sendRequest(requestArgs(104))
    storage.failWrites = true
    const event = responseEvent(104, { result: 'normal-handler' })
    await wrongClient.client.engine.onProviderMessageEvent(event)

    expect(wrongClient.originalProviderHandler).toHaveBeenCalledWith(event)
    expect(wrongClient.ack).not.toHaveBeenCalled()
    storage.failWrites = false
  })

  it('uses a storage event when BroadcastChannel is unavailable', async () => {
    const owner = createClient()
    const ownerWindow = new TestWindow(storage, false)
    openClient(owner, ownerWindow)
    const target = engineEvent('session_request', 105)
    const routedPayload = oncePayload(owner.events, target)

    await owner.client.engine.sendRequest(requestArgs(105))
    const { storageKey: ownerStorageKey, owner: ownerRecord } = findOwner(
      storage,
      'session-topic:105',
    )
    const response = storedResponse(ownerStorageKey, ownerRecord, { result: 'storage-event' })
    storage.setItem(response.storageKey, response.value)
    ownerWindow.dispatchStorage(response.storageKey, response.value)

    await expect(routedPayload).resolves.toEqual({ result: 'storage-event' })
    expect(owner.historyResolve).toHaveBeenCalledTimes(1)
  })

  it('polls durable responses when neither immediate notification path is available', async () => {
    const owner = createClient()
    const ownerWindow = new TestWindow(storage, false)
    openClient(owner, ownerWindow)
    const target = engineEvent('session_request', 106)
    const routedPayload = oncePayload(owner.events, target)

    await owner.client.engine.sendRequest(requestArgs(106))
    const { storageKey: ownerStorageKey, owner: ownerRecord } = findOwner(
      storage,
      'session-topic:106',
    )
    const response = storedResponse(ownerStorageKey, ownerRecord, { result: 'polled' })
    storage.setItem(response.storageKey, response.value)
    jest.advanceTimersByTime(15_000)
    await flushPromises()

    await expect(routedPayload).resolves.toEqual({ result: 'polled' })
  })

  it('expires local pending ownership and restores the no-owner fast path', async () => {
    const owner = createClient()
    openClient(owner, browserWindow, { requestGraceMs: 0 })

    await owner.client.engine.sendRequest(requestArgs(107, 1))
    jest.advanceTimersByTime(15_000)
    await flushPromises()

    expect(storageKeys(storage).some((key) => key.includes('/owner/session-topic:107'))).toBe(
      false,
    )
    owner.decode.mockClear()
    const event = responseEvent(999, { result: 'unowned' })
    await owner.client.engine.onProviderMessageEvent(event)
    expect(owner.decode).not.toHaveBeenCalled()
    expect(owner.originalProviderHandler).toHaveBeenCalledWith(event)
  })

  it('removes ownership when the original send fails', async () => {
    const owner = createClient()
    owner.originalSendRequest.mockRejectedValue(new Error('publish failed'))
    openClient(owner)

    await expect(owner.client.engine.sendRequest(requestArgs(108))).rejects.toThrow(
      'publish failed',
    )
    expect(storageKeys(storage).some((key) => key.includes('session-topic:108'))).toBe(false)
  })

  it('rejects an RPC id collision without replacing the first owner', async () => {
    const firstOwner = createClient()
    const collidingClient = createClient()
    const receiver = createClient()
    openClient(firstOwner)
    openClient(collidingClient)
    openClient(receiver)
    const target = engineEvent('session_request', 109)
    const routedPayload = oncePayload(firstOwner.events, target)

    await firstOwner.client.engine.sendRequest(requestArgs(109))
    await expect(collidingClient.client.engine.sendRequest(requestArgs(109))).rejects.toThrow(
      'request collision',
    )
    expect(collidingClient.originalSendRequest).not.toHaveBeenCalled()

    await receiver.client.engine.onProviderMessageEvent(
      responseEvent(109, { result: 'first-owner' }),
    )
    await expect(routedPayload).resolves.toEqual({ result: 'first-owner' })
  })

  it('cleans a forwarded response when its request listener has already disappeared', async () => {
    const owner = createClient()
    const wrongClient = createClient()
    openClient(owner)
    openClient(wrongClient)

    await owner.client.engine.sendRequest(requestArgs(110))
    await wrongClient.client.engine.onProviderMessageEvent(
      responseEvent(110, { result: 'too-late' }),
    )
    await flushPromises()

    expect(owner.historyResolve).not.toHaveBeenCalled()
    expect(storageKeys(storage).some((key) => key.includes('session-topic:110'))).toBe(false)
  })

  it('restores original methods, removes owned state, and supports a fresh reinstall', async () => {
    const owner = createClient()
    const originalSendRequest = owner.client.engine.sendRequest
    const originalProviderHandler = owner.client.engine.onProviderMessageEvent
    const firstRouter = openClient(owner)!

    expect(owner.client.engine.sendRequest).not.toBe(originalSendRequest)
    expect(owner.client.engine.onProviderMessageEvent).not.toBe(originalProviderHandler)
    await owner.client.engine.sendRequest(requestArgs(111))

    firstRouter.destroy()
    expect(owner.client.engine.sendRequest).toBe(originalSendRequest)
    expect(owner.client.engine.onProviderMessageEvent).toBe(originalProviderHandler)
    expect(storageKeys(storage).some((key) => key.includes('session-topic:111'))).toBe(false)

    const secondRouter = openClient(owner)!
    expect(secondRouter).not.toBe(firstRouter)
    expect(secondRouter.isInstalled()).toBe(true)
    expect(owner.client.engine.sendRequest).not.toBe(originalSendRequest)
  })

  it('does not overwrite a patch installed after the router', () => {
    const owner = createClient()
    const router = openClient(owner)!
    const laterPatch = jest.fn(async () => 123)
    owner.client.engine.sendRequest = laterPatch

    router.destroy()

    expect(owner.client.engine.sendRequest).toBe(laterPatch)
  })
})
