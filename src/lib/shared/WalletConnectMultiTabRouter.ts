/*
 * Hedera Wallet Connect
 * Copyright (C) 2023 Hedera Hashgraph, LLC
 * Licensed under the Apache License, Version 2.0
 */

import { TRANSPORT_TYPES } from '@walletconnect/core'
import {
  isJsonRpcError,
  isJsonRpcPayload,
  isJsonRpcResponse,
  isJsonRpcResult,
} from '@walletconnect/jsonrpc-utils'
import type { JsonRpcPayload, JsonRpcResponse } from '@walletconnect/jsonrpc-types'
import { BASE64, BASE64URL, engineEvent } from '@walletconnect/utils'
import type { ILogger } from './logger'

type JsonRpcResponsePayload = JsonRpcResponse<unknown>

type SendRequestArgs = {
  topic: string
  method: string
  params?: {
    request?: {
      method?: string
    }
    chainId?: string
  }
  expiry?: number
  clientRpcId?: number
  [key: string]: unknown
}

type EngineEvents = {
  emit(event: string, payload: unknown): boolean
  listenerCount(event: string): number
}

type PatchedEngine = {
  events?: EngineEvents
  sendRequest?: (args: SendRequestArgs) => Promise<number>
  onProviderMessageEvent?: (event: WalletConnectMessageEvent) => Promise<void>
}

type WalletConnectMessageEvent = {
  topic: string
  message: string
  publishedAt?: number
  attestation?: string
  transportType?: 'relay' | 'link_mode'
}

type WalletConnectMetadata = {
  name?: string
  url?: string
}

type PatchedSignClient = {
  __hederaMultiTabRouter?: WalletConnectMultiTabRouter
  engine?: PatchedEngine
  core?: {
    projectId?: string
    crypto?: {
      decode?(
        topic: string,
        encoded: string,
        opts?: { encoding?: typeof BASE64 | typeof BASE64URL },
      ): Promise<JsonRpcPayload>
    }
    history?: {
      resolve?(response: JsonRpcResponsePayload): Promise<void>
      delete?(topic: string, id?: number): void
    }
    relayer?: {
      messages?: {
        ack?(topic: string, message: string): Promise<void>
      }
    }
  }
}

export type WalletConnectMultiTabRouterOptions = {
  enabled?: boolean
  projectId?: string
  metadata?: WalletConnectMetadata
  logger?: ILogger
  requestGraceMs?: number
  responseTtlMs?: number
}

export type WalletConnectMultiTabConfig =
  | boolean
  | {
      enabled?: boolean
      requestGraceMs?: number
      responseTtlMs?: number
    }

type OwnerRecord = {
  version: 2
  key: string
  topic: string
  rpcId: number
  ownerInstanceId: string
  method: string
  chainId?: string
  createdAt: number
  expiresAt: number
}

type RoutedResponse = {
  version: 2
  key: string
  topic: string
  rpcId: number
  ownerInstanceId: string
  receivedByInstanceId: string
  createdAt: number
  expiresAt: number
  payload: JsonRpcResponsePayload
}

type ResponseNotification = {
  type: 'wc-response'
  scope: string
  key: string
  ownerInstanceId: string
}

type BrowserEnvironment = {
  browserWindow: Window
  storage: Storage
}

type OwnedResponseContext = {
  key: string
  target: string
  listenerCount: number
}

const DEFAULT_REQUEST_TTL_SECONDS = 300
const DEFAULT_REQUEST_GRACE_MS = 30_000
const DEFAULT_RESPONSE_TTL_MS = 120_000
const SWEEP_INTERVAL_MS = 15_000

const localRouters = new Map<string, Set<WalletConnectMultiTabRouter>>()

const randomId = (): string => {
  try {
    const cryptoObject = globalThis.crypto
    if (cryptoObject?.randomUUID) return cryptoObject.randomUUID()
  } catch {
    // Fall through to a non-cryptographic identifier. This value is not a secret.
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const hashScope = (value: string): string => {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return (hash >>> 0).toString(36)
}

const durationOrDefault = (
  value: number | undefined,
  fallback: number,
  allowZero: boolean,
): number => {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    (!allowZero && value === 0)
  ) {
    return fallback
  }
  return value
}

const getBrowserEnvironment = (): BrowserEnvironment | undefined => {
  let storage: Storage | undefined
  let probeKey: string | undefined

  try {
    const browserWindow = globalThis.window
    if (!browserWindow) return undefined

    storage = browserWindow.localStorage
    probeKey = `@hashgraph/hedera-wallet-connect/wc-multitab/probe/${randomId()}`
    storage.setItem(probeKey, '1')
    storage.removeItem(probeKey)
    return { browserWindow, storage }
  } catch {
    if (storage && probeKey) {
      try {
        storage.removeItem(probeKey)
      } catch {
        // Storage is unavailable; installation will fail open below.
      }
    }
    return undefined
  }
}

const logInstallWarning = (
  options: WalletConnectMultiTabRouterOptions,
  message: string,
  value?: unknown,
): void => {
  try {
    if (typeof value === 'undefined') options.logger?.warn(message)
    else options.logger?.warn(message, value)
  } catch {
    // Logging must never make optional router installation fatal.
  }
}

export function installWalletConnectMultiTabRouter(
  signClient: unknown,
  options: WalletConnectMultiTabRouterOptions = {},
): WalletConnectMultiTabRouter | undefined {
  if (!options.enabled) return undefined

  const environment = getBrowserEnvironment()
  if (!environment) {
    logInstallWarning(
      options,
      'WalletConnect multi-tab routing requires writable browser localStorage; continuing without it',
    )
    return undefined
  }

  try {
    const client = signClient as PatchedSignClient
    const existing = client.__hederaMultiTabRouter
    if (existing) {
      if (typeof existing.isInstalled !== 'function') {
        logInstallWarning(
          options,
          'WalletConnect client already has an incompatible multi-tab patch; continuing without replacing it',
        )
        return undefined
      }
      if (existing.isInstalled()) return existing
      existing.destroy()
    }

    const router = new WalletConnectMultiTabRouter(client, options, environment)
    if (!router.install()) return undefined

    try {
      Object.defineProperty(client, '__hederaMultiTabRouter', {
        configurable: true,
        value: router,
        writable: true,
      })
    } catch (error) {
      router.destroy()
      logInstallWarning(
        options,
        'WalletConnect multi-tab routing could not retain its client lifecycle handle; continuing without it',
        error,
      )
      return undefined
    }

    return router
  } catch (error) {
    logInstallWarning(
      options,
      'WalletConnect multi-tab router installation failed; continuing with the unmodified client',
      error,
    )
    return undefined
  }
}

export function resolveWalletConnectMultiTabRouterOptions(
  config: WalletConnectMultiTabConfig | undefined,
  options: Omit<
    WalletConnectMultiTabRouterOptions,
    'enabled' | 'requestGraceMs' | 'responseTtlMs'
  >,
): WalletConnectMultiTabRouterOptions {
  const configOptions = typeof config === 'object' ? config : undefined
  const enabled = typeof config === 'boolean' ? config : (configOptions?.enabled ?? false)

  return {
    ...options,
    enabled,
    requestGraceMs: configOptions?.requestGraceMs,
    responseTtlMs: configOptions?.responseTtlMs,
  }
}

export class WalletConnectMultiTabRouter {
  private readonly instanceId = randomId()
  private readonly scope: string
  private readonly storagePrefix: string
  private readonly requestGraceMs: number
  private readonly responseTtlMs: number
  private readonly localPending = new Set<string>()
  private readonly resolving = new Set<string>()
  private channel?: BroadcastChannel
  private cleanupTimer?: ReturnType<typeof setInterval>
  private storageListenerInstalled = false
  private installed = false
  private originalSendRequest?: PatchedEngine['sendRequest']
  private originalProviderMessageHandler?: PatchedEngine['onProviderMessageEvent']
  private patchedSendRequest?: PatchedEngine['sendRequest']
  private patchedProviderMessageHandler?: PatchedEngine['onProviderMessageEvent']

  constructor(
    private readonly signClient: PatchedSignClient,
    private readonly options: WalletConnectMultiTabRouterOptions,
    private readonly environment: BrowserEnvironment,
  ) {
    this.requestGraceMs = durationOrDefault(
      options.requestGraceMs,
      DEFAULT_REQUEST_GRACE_MS,
      true,
    )
    this.responseTtlMs = durationOrDefault(
      options.responseTtlMs,
      DEFAULT_RESPONSE_TTL_MS,
      false,
    )
    this.scope = this.createScope(options)
    this.storagePrefix = `@hashgraph/hedera-wallet-connect/wc-multitab/v2/${this.scope}`
  }

  public install(): boolean {
    if (this.installed) return true

    const missingApis = this.getMissingPrivateApis()
    if (missingApis.length > 0) {
      this.log(
        'warn',
        'WalletConnect multi-tab routing is incompatible with this SignClient version; continuing without it',
        { missingApis },
      )
      return false
    }

    const engine = this.signClient.engine!
    const originalSendRequest = engine.sendRequest!
    const originalProviderMessageHandler = engine.onProviderMessageEvent!
    const patchedSendRequest = async (args: SendRequestArgs): Promise<number> =>
      this.handleSendRequest(engine, originalSendRequest, args)
    const patchedProviderMessageHandler = async (
      event: WalletConnectMessageEvent,
    ): Promise<void> =>
      this.handleProviderMessage(engine, originalProviderMessageHandler, event)

    this.originalSendRequest = originalSendRequest
    this.originalProviderMessageHandler = originalProviderMessageHandler
    this.patchedSendRequest = patchedSendRequest
    this.patchedProviderMessageHandler = patchedProviderMessageHandler

    try {
      engine.sendRequest = patchedSendRequest
      engine.onProviderMessageEvent = patchedProviderMessageHandler
      this.openNotificationChannel()
      this.addStorageListener()
      this.cleanupTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS)
      this.installed = true
      this.registerLocalRouter()
      this.log('debug', 'WalletConnect multi-tab router installed', {
        scope: this.scope,
        instance: this.describeInstance(this.instanceId),
        hasBroadcastChannel: !!this.channel,
        requestGraceMs: this.requestGraceMs,
        responseTtlMs: this.responseTtlMs,
        sweepIntervalMs: SWEEP_INTERVAL_MS,
      })
      return true
    } catch (error) {
      this.restorePatchedMethods()
      this.closeResources()
      this.log(
        'warn',
        'WalletConnect multi-tab router installation failed; restored original client methods',
        error,
      )
      return false
    }
  }

  public isInstalled(): boolean {
    return this.installed
  }

  public destroy(): void {
    this.removeOwnedState()
    this.unregisterLocalRouter()
    this.restorePatchedMethods()
    this.closeResources()
    this.localPending.clear()
    this.resolving.clear()
    this.installed = false

    try {
      if (this.signClient.__hederaMultiTabRouter === this) {
        delete this.signClient.__hederaMultiTabRouter
      }
    } catch (error) {
      this.log('debug', 'Failed to release WalletConnect multi-tab lifecycle handle', error)
    }
  }

  private getMissingPrivateApis(): string[] {
    const engine = this.signClient.engine
    const core = this.signClient.core
    const missing: string[] = []

    if (typeof engine?.sendRequest !== 'function') missing.push('engine.sendRequest')
    if (typeof engine?.onProviderMessageEvent !== 'function') {
      missing.push('engine.onProviderMessageEvent')
    }
    if (typeof engine?.events?.emit !== 'function') missing.push('engine.events.emit')
    if (typeof engine?.events?.listenerCount !== 'function') {
      missing.push('engine.events.listenerCount')
    }
    if (typeof core?.crypto?.decode !== 'function') missing.push('core.crypto.decode')
    if (typeof core?.history?.resolve !== 'function') missing.push('core.history.resolve')
    if (typeof core?.history?.delete !== 'function') missing.push('core.history.delete')
    if (typeof core?.relayer?.messages?.ack !== 'function') {
      missing.push('core.relayer.messages.ack')
    }

    return missing
  }

  private async handleSendRequest(
    engine: PatchedEngine,
    original: NonNullable<PatchedEngine['sendRequest']>,
    args: SendRequestArgs,
  ): Promise<number> {
    let owner: OwnerRecord | undefined

    if (args.method === 'wc_sessionRequest' && typeof args.clientRpcId === 'number') {
      owner = this.registerOwner(args)
    }

    try {
      return await original.call(engine, args)
    } catch (error) {
      if (owner) this.completeLocalRequest(owner.key)
      throw error
    }
  }

  private async handleProviderMessage(
    engine: PatchedEngine,
    original: NonNullable<PatchedEngine['onProviderMessageEvent']>,
    event: WalletConnectMessageEvent,
  ): Promise<void> {
    if (!this.hasAnyOwnerRecords()) {
      await original.call(engine, event)
      return
    }

    const payload = await this.decode(event).catch(() => undefined)
    const ownedResponse = this.getOwnedResponseContext(event, payload)

    if (await this.routeForeignResponse(event, payload)) return

    await original.call(engine, event)

    if (!ownedResponse) return
    const listenerCount = this.getListenerCount(ownedResponse.target)
    if (listenerCount < ownedResponse.listenerCount) {
      this.completeLocalRequest(ownedResponse.key)
      return
    }

    this.log(
      'warn',
      'WalletConnect left a locally received response unresolved; ownership retained',
      {
        topic: this.describeTopic(event.topic),
        rpcId: this.rpcIdFromKey(ownedResponse.key),
        listenerCountBefore: ownedResponse.listenerCount,
        listenerCountAfter: listenerCount,
      },
    )
  }

  private registerOwner(args: SendRequestArgs): OwnerRecord | undefined {
    const rpcId = args.clientRpcId!
    const topic = args.topic
    const key = this.key(topic, rpcId)
    const now = Date.now()
    const existing = this.getOwner(key)

    if (existing && existing.expiresAt > now) {
      const details = {
        existingOwner: this.describeOwner(existing),
        attemptedByInstance: this.describeInstance(this.instanceId),
      }
      this.log('error', 'WalletConnect multi-tab RPC id collision detected', details)
      throw new Error(
        `WalletConnect multi-tab request collision for RPC id ${rpcId}; retry the request`,
      )
    }

    if (existing) this.expireOwner(existing)

    const configuredTtl = args.expiry
    const ttlSeconds =
      typeof configuredTtl === 'number' && Number.isFinite(configuredTtl) && configuredTtl > 0
        ? configuredTtl
        : DEFAULT_REQUEST_TTL_SECONDS
    const owner: OwnerRecord = {
      version: 2,
      key,
      topic,
      rpcId,
      ownerInstanceId: this.instanceId,
      method: args.params?.request?.method ?? 'unknown',
      chainId: args.params?.chainId,
      createdAt: now,
      expiresAt: now + ttlSeconds * 1_000 + this.requestGraceMs,
    }

    this.removeResponse(key, this.instanceId)
    if (!this.setJson(this.ownerKey(key), owner)) {
      this.log(
        'warn',
        'WalletConnect multi-tab request ownership could not be persisted; using normal single-client routing',
        { topic: this.describeTopic(topic), rpcId },
      )
      return undefined
    }

    const storedOwner = this.getOwner(key)
    if (storedOwner?.ownerInstanceId !== this.instanceId) {
      this.log('error', 'WalletConnect multi-tab request ownership was replaced concurrently', {
        topic: this.describeTopic(topic),
        rpcId,
      })
      throw new Error(
        `WalletConnect multi-tab request collision for RPC id ${rpcId}; retry the request`,
      )
    }

    this.localPending.add(key)
    return owner
  }

  private async routeForeignResponse(
    event: WalletConnectMessageEvent,
    payload: JsonRpcPayload | undefined,
  ): Promise<boolean> {
    if (!this.isJsonRpcResponsePayload(payload)) return false

    const responsePayload = payload as JsonRpcResponsePayload
    const key = this.key(event.topic, responsePayload.id)
    const owner = this.getOwner(key)
    if (!owner) return false

    if (owner.expiresAt <= Date.now()) {
      this.expireOwner(owner)
      return false
    }

    if (owner.ownerInstanceId === this.instanceId) {
      if (!this.localPending.has(key)) {
        this.log(
          'warn',
          'WalletConnect found stale ownership in the receiving client instance',
          {
            owner: this.describeOwner(owner),
          },
        )
        this.removeOwner(key, this.instanceId)
        this.removeResponse(key, this.instanceId)
      }
      return false
    }

    const now = Date.now()
    const response: RoutedResponse = {
      version: 2,
      key,
      topic: event.topic,
      rpcId: responsePayload.id,
      ownerInstanceId: owner.ownerInstanceId,
      receivedByInstanceId: this.instanceId,
      createdAt: now,
      expiresAt: Math.min(now + this.responseTtlMs, owner.expiresAt),
      payload: responsePayload,
    }

    if (!this.setJson(this.responseKey(key, owner.ownerInstanceId), response)) {
      this.log(
        'warn',
        'WalletConnect multi-tab response could not be persisted; leaving it for normal client handling',
        { owner: this.describeOwner(owner) },
      )
      return false
    }

    const currentOwner = this.getOwner(key)
    if (currentOwner?.ownerInstanceId !== owner.ownerInstanceId) {
      this.removeResponse(key, owner.ownerInstanceId)
      return false
    }

    this.notifyResponse(response)
    this.log('debug', 'WalletConnect multi-tab routed response to owner instance', {
      owner: this.describeOwner(owner),
      receivedByInstance: this.describeInstance(this.instanceId),
    })
    await this.ack(event)
    return true
  }

  private async resolveForwardedResponse(response: RoutedResponse): Promise<void> {
    if (response.expiresAt <= Date.now()) {
      this.removeResponse(response.key, response.ownerInstanceId)
      return
    }
    if (response.ownerInstanceId !== this.instanceId) return
    if (!this.localPending.has(response.key) || this.resolving.has(response.key)) return

    const owner = this.getOwner(response.key)
    if (!owner || owner.ownerInstanceId !== this.instanceId) return
    if (owner.expiresAt <= Date.now()) {
      this.expireOwner(owner)
      return
    }

    this.resolving.add(response.key)
    try {
      const engine = this.signClient.engine
      const events = engine?.events
      const history = this.signClient.core?.history
      const target = engineEvent('session_request', response.rpcId)
      const listenerCount = events?.listenerCount(target) ?? 0

      this.log('debug', 'WalletConnect multi-tab resolving forwarded response', {
        topic: this.describeTopic(response.topic),
        rpcId: response.rpcId,
        receivedByInstance: this.describeInstance(response.receivedByInstanceId),
        listenerCount,
      })

      if (!events || !history?.resolve || listenerCount === 0) {
        this.log(
          'warn',
          'WalletConnect multi-tab cannot resolve forwarded response without its request listener',
          {
            topic: this.describeTopic(response.topic),
            rpcId: response.rpcId,
            hasEvents: !!events,
            listenerCount,
          },
        )
        this.completeLocalRequest(response.key)
        return
      }

      try {
        await history.resolve(response.payload)
      } catch (error) {
        this.log(
          'warn',
          'WalletConnect history rejected a routed response; delivering it to the active request listener',
          {
            topic: this.describeTopic(response.topic),
            rpcId: response.rpcId,
            error,
          },
        )
      }

      let emitted = false
      try {
        if (isJsonRpcResult(response.payload)) {
          emitted = events.emit(target, { result: response.payload.result })
        } else if (isJsonRpcError(response.payload)) {
          emitted = events.emit(target, { error: response.payload.error })
        }
      } catch (error) {
        const listenerCountAfter = events.listenerCount(target)
        this.log('error', 'WalletConnect routed response listener threw', {
          topic: this.describeTopic(response.topic),
          rpcId: response.rpcId,
          listenerCountAfter,
          error,
        })
        if (listenerCountAfter >= listenerCount) return
        emitted = true
      }

      if (!emitted) {
        this.log('warn', 'WalletConnect routed response had no active request listener', {
          topic: this.describeTopic(response.topic),
          rpcId: response.rpcId,
        })
      }

      try {
        history.delete?.(response.topic, response.rpcId)
      } catch (error) {
        this.log('debug', 'Failed to delete routed response from WalletConnect history', error)
      }
      this.completeLocalRequest(response.key)
    } finally {
      this.resolving.delete(response.key)
    }
  }

  private getOwnedResponseContext(
    event: WalletConnectMessageEvent,
    payload: JsonRpcPayload | undefined,
  ): OwnedResponseContext | undefined {
    if (!this.isJsonRpcResponsePayload(payload)) return undefined

    const key = this.key(event.topic, payload.id)
    const owner = this.getOwner(key)
    if (owner?.ownerInstanceId !== this.instanceId || !this.localPending.has(key)) {
      return undefined
    }

    const target = engineEvent('session_request', payload.id)
    return { key, target, listenerCount: this.getListenerCount(target) }
  }

  private completeLocalRequest(key: string): void {
    this.localPending.delete(key)
    this.removeOwner(key, this.instanceId)
    this.removeResponse(key, this.instanceId)
  }

  private expireOwner(owner: OwnerRecord): void {
    if (owner.ownerInstanceId === this.instanceId) this.localPending.delete(owner.key)
    this.removeOwner(owner.key, owner.ownerInstanceId)
    this.removeResponse(owner.key, owner.ownerInstanceId)
  }

  private isJsonRpcResponsePayload(payload: unknown): payload is JsonRpcResponsePayload {
    return isJsonRpcPayload(payload) && isJsonRpcResponse(payload)
  }

  private async decode(event: WalletConnectMessageEvent): Promise<JsonRpcPayload> {
    const decode = this.signClient.core!.crypto!.decode!
    return decode.call(this.signClient.core!.crypto, event.topic, event.message, {
      encoding: event.transportType === TRANSPORT_TYPES.link_mode ? BASE64URL : BASE64,
    })
  }

  private async ack(event: WalletConnectMessageEvent): Promise<void> {
    const messages = this.signClient.core?.relayer?.messages
    try {
      await messages?.ack?.call(messages, event.topic, event.message)
    } catch (error) {
      this.log('debug', 'Failed to ack routed WalletConnect message', error)
    }
  }

  private notifyResponse(response: RoutedResponse): void {
    for (const router of localRouters.get(this.scope) ?? []) {
      if (router !== this) router.receiveResponse(response)
    }

    const notification: ResponseNotification = {
      type: 'wc-response',
      scope: this.scope,
      key: response.key,
      ownerInstanceId: response.ownerInstanceId,
    }
    try {
      this.channel?.postMessage(notification)
    } catch (error) {
      this.log('debug', 'Failed to broadcast routed WalletConnect response', error)
    }
  }

  private receiveResponse(response: RoutedResponse): void {
    void this.resolveForwardedResponse(response).catch((error) => {
      this.log('error', 'Failed to resolve forwarded WalletConnect response', error)
    })
  }

  private handleNotification(message: unknown): void {
    if (!this.isResponseNotification(message) || message.scope !== this.scope) return
    const response = this.getResponse(message.key, message.ownerInstanceId)
    if (response) this.receiveResponse(response)
  }

  private handleStorageEvent = (event: StorageEvent): void => {
    if (event.storageArea && event.storageArea !== this.environment.storage) return
    if (!event.key?.startsWith(`${this.storagePrefix}/response/`) || !event.newValue) return

    const response = this.parseRoutedResponse(event.newValue)
    if (response) this.receiveResponse(response)
  }

  private sweep(): void {
    const now = Date.now()

    for (const storageKey of this.storageKeys()) {
      if (storageKey.startsWith(`${this.storagePrefix}/owner/`)) {
        const owner = this.parseOwnerRecord(this.getItem(storageKey))
        if (!owner) {
          this.removeItem(storageKey)
          continue
        }
        if (owner.expiresAt <= now) this.expireOwner(owner)
        continue
      }

      if (storageKey.startsWith(`${this.storagePrefix}/response/`)) {
        const response = this.parseRoutedResponse(this.getItem(storageKey))
        if (!response) {
          this.removeItem(storageKey)
          continue
        }
        if (response.expiresAt <= now) {
          this.removeItem(storageKey)
          continue
        }
        this.receiveResponse(response)
      }
    }

    for (const key of this.localPending) {
      const owner = this.getOwner(key)
      if (!owner || owner.ownerInstanceId !== this.instanceId || owner.expiresAt <= now) {
        this.localPending.delete(key)
      }
    }
  }

  private hasAnyOwnerRecords(): boolean {
    const now = Date.now()

    for (const storageKey of this.storageKeys()) {
      if (!storageKey.startsWith(`${this.storagePrefix}/owner/`)) continue

      const owner = this.parseOwnerRecord(this.getItem(storageKey))
      if (!owner) {
        this.removeItem(storageKey)
        continue
      }
      if (owner.expiresAt <= now) {
        this.expireOwner(owner)
        continue
      }
      return true
    }

    for (const key of this.localPending) this.localPending.delete(key)
    return false
  }

  private getOwner(key: string): OwnerRecord | undefined {
    const storageKey = this.ownerKey(key)
    const owner = this.parseOwnerRecord(this.getItem(storageKey))
    if (!owner || owner.key !== key) {
      if (this.getItem(storageKey) !== null) this.removeItem(storageKey)
      return undefined
    }
    return owner
  }

  private getResponse(key: string, ownerInstanceId: string): RoutedResponse | undefined {
    const storageKey = this.responseKey(key, ownerInstanceId)
    const response = this.parseRoutedResponse(this.getItem(storageKey))
    if (!response || response.key !== key || response.ownerInstanceId !== ownerInstanceId) {
      if (this.getItem(storageKey) !== null) this.removeItem(storageKey)
      return undefined
    }
    return response
  }

  private parseOwnerRecord(value: string | null): OwnerRecord | undefined {
    const parsed = this.parseJson(value)
    if (!parsed || typeof parsed !== 'object') return undefined
    const owner = parsed as Partial<OwnerRecord>
    if (
      owner.version !== 2 ||
      typeof owner.key !== 'string' ||
      typeof owner.topic !== 'string' ||
      typeof owner.rpcId !== 'number' ||
      typeof owner.ownerInstanceId !== 'string' ||
      typeof owner.method !== 'string' ||
      (typeof owner.chainId !== 'undefined' && typeof owner.chainId !== 'string') ||
      typeof owner.createdAt !== 'number' ||
      !Number.isFinite(owner.createdAt) ||
      typeof owner.expiresAt !== 'number' ||
      !Number.isFinite(owner.expiresAt) ||
      owner.key !== this.key(owner.topic, owner.rpcId)
    ) {
      return undefined
    }
    return owner as OwnerRecord
  }

  private parseRoutedResponse(value: string | null): RoutedResponse | undefined {
    const parsed = this.parseJson(value)
    if (!parsed || typeof parsed !== 'object') return undefined
    const response = parsed as Partial<RoutedResponse>
    if (
      response.version !== 2 ||
      typeof response.key !== 'string' ||
      typeof response.topic !== 'string' ||
      typeof response.rpcId !== 'number' ||
      typeof response.ownerInstanceId !== 'string' ||
      typeof response.receivedByInstanceId !== 'string' ||
      typeof response.createdAt !== 'number' ||
      !Number.isFinite(response.createdAt) ||
      typeof response.expiresAt !== 'number' ||
      !Number.isFinite(response.expiresAt) ||
      !this.isJsonRpcResponsePayload(response.payload) ||
      response.payload.id !== response.rpcId ||
      response.key !== this.key(response.topic, response.rpcId)
    ) {
      return undefined
    }
    return response as RoutedResponse
  }

  private isResponseNotification(value: unknown): value is ResponseNotification {
    if (!value || typeof value !== 'object') return false
    const notification = value as Partial<ResponseNotification>
    return (
      notification.type === 'wc-response' &&
      typeof notification.scope === 'string' &&
      typeof notification.key === 'string' &&
      typeof notification.ownerInstanceId === 'string'
    )
  }

  private parseJson(value: string | null): unknown {
    if (!value) return undefined
    try {
      return JSON.parse(value) as unknown
    } catch {
      return undefined
    }
  }

  private ownerKey(key: string): string {
    return `${this.storagePrefix}/owner/${key}`
  }

  private responseKey(key: string, ownerInstanceId: string): string {
    return `${this.storagePrefix}/response/${ownerInstanceId}/${key}`
  }

  private key(topic: string, rpcId: number): string {
    return `${topic}:${rpcId}`
  }

  private rpcIdFromKey(key: string): number | undefined {
    const value = Number(key.slice(key.lastIndexOf(':') + 1))
    return Number.isFinite(value) ? value : undefined
  }

  private setJson(key: string, value: unknown): boolean {
    try {
      this.environment.storage.setItem(key, JSON.stringify(value))
      return true
    } catch (error) {
      this.log('warn', 'Failed to write WalletConnect multi-tab state', error)
      return false
    }
  }

  private getItem(key: string): string | null {
    try {
      return this.environment.storage.getItem(key)
    } catch (error) {
      this.log('warn', 'Failed to read WalletConnect multi-tab state', error)
      return null
    }
  }

  private removeItem(key: string): void {
    try {
      this.environment.storage.removeItem(key)
    } catch (error) {
      this.log('debug', 'Failed to remove WalletConnect multi-tab state', error)
    }
  }

  private storageKeys(): string[] {
    const keys: string[] = []
    try {
      for (let i = 0; i < this.environment.storage.length; i += 1) {
        const key = this.environment.storage.key(i)
        if (key) keys.push(key)
      }
    } catch (error) {
      this.log('warn', 'Failed to inspect WalletConnect multi-tab state', error)
    }
    return keys
  }

  private removeOwner(key: string, expectedOwnerInstanceId: string): void {
    const owner = this.getOwner(key)
    if (!owner || owner.ownerInstanceId === expectedOwnerInstanceId) {
      this.removeItem(this.ownerKey(key))
    }
  }

  private removeResponse(key: string, ownerInstanceId: string): void {
    this.removeItem(this.responseKey(key, ownerInstanceId))
  }

  private removeOwnedState(): void {
    for (const storageKey of this.storageKeys()) {
      if (!storageKey.startsWith(`${this.storagePrefix}/owner/`)) continue
      const owner = this.parseOwnerRecord(this.getItem(storageKey))
      if (owner?.ownerInstanceId === this.instanceId) this.expireOwner(owner)
    }
  }

  private getListenerCount(target: string): number {
    return this.signClient.engine?.events?.listenerCount(target) ?? 0
  }

  private openNotificationChannel(): void {
    try {
      const BroadcastChannelConstructor = (
        this.environment.browserWindow as Window & {
          BroadcastChannel?: typeof BroadcastChannel
        }
      ).BroadcastChannel
      if (!BroadcastChannelConstructor) return
      const channel = new BroadcastChannelConstructor(`${this.storagePrefix}/notifications`)
      channel.onmessage = (event: MessageEvent<unknown>) => this.handleNotification(event.data)
      this.channel = channel
    } catch (error) {
      this.channel = undefined
      this.log(
        'debug',
        'BroadcastChannel unavailable; WalletConnect multi-tab routing will use storage events',
        error,
      )
    }
  }

  private addStorageListener(): void {
    try {
      this.environment.browserWindow.addEventListener('storage', this.handleStorageEvent)
      this.storageListenerInstalled = true
    } catch (error) {
      this.log(
        'debug',
        'Storage event listener unavailable; WalletConnect multi-tab routing will use polling',
        error,
      )
    }
  }

  private closeResources(): void {
    if (this.storageListenerInstalled) {
      try {
        this.environment.browserWindow.removeEventListener('storage', this.handleStorageEvent)
      } catch (error) {
        this.log('debug', 'Failed to remove WalletConnect multi-tab storage listener', error)
      }
      this.storageListenerInstalled = false
    }

    if (this.channel) {
      try {
        this.channel.onmessage = null
        this.channel.close()
      } catch (error) {
        this.log('debug', 'Failed to close WalletConnect multi-tab notification channel', error)
      }
      this.channel = undefined
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
  }

  private restorePatchedMethods(): void {
    const engine = this.signClient.engine
    if (engine && engine.sendRequest === this.patchedSendRequest && this.originalSendRequest) {
      engine.sendRequest = this.originalSendRequest
    }
    if (
      engine &&
      engine.onProviderMessageEvent === this.patchedProviderMessageHandler &&
      this.originalProviderMessageHandler
    ) {
      engine.onProviderMessageEvent = this.originalProviderMessageHandler
    }

    this.originalSendRequest = undefined
    this.originalProviderMessageHandler = undefined
    this.patchedSendRequest = undefined
    this.patchedProviderMessageHandler = undefined
  }

  private registerLocalRouter(): void {
    const routers = localRouters.get(this.scope) ?? new Set<WalletConnectMultiTabRouter>()
    routers.add(this)
    localRouters.set(this.scope, routers)
  }

  private unregisterLocalRouter(): void {
    const routers = localRouters.get(this.scope)
    routers?.delete(this)
    if (routers?.size === 0) localRouters.delete(this.scope)
  }

  private createScope(options: WalletConnectMultiTabRouterOptions): string {
    const metadata = options.metadata
    const projectId = options.projectId ?? this.signClient.core?.projectId ?? ''
    const name = metadata?.name ?? ''
    const url = metadata?.url ?? ''
    return hashScope(`${projectId}|${name}|${url}`)
  }

  private describeOwner(owner: OwnerRecord): Record<string, unknown> {
    return {
      topic: this.describeTopic(owner.topic),
      rpcId: owner.rpcId,
      ownerInstance: this.describeInstance(owner.ownerInstanceId),
      isThisInstance: owner.ownerInstanceId === this.instanceId,
      method: owner.method,
      chainId: owner.chainId,
      expiresInMs: owner.expiresAt - Date.now(),
      localPending: this.localPending.has(owner.key),
    }
  }

  private describeTopic(topic: string): Record<string, unknown> {
    return {
      suffix: topic.slice(-8),
      hash: hashScope(topic),
    }
  }

  private describeInstance(instanceId: string): Record<string, unknown> {
    return {
      suffix: instanceId.slice(-8),
      isThisInstance: instanceId === this.instanceId,
    }
  }

  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    value?: unknown,
  ): void {
    const logger = this.options.logger
    if (!logger) return
    try {
      if (typeof value === 'undefined') logger[level](message)
      else logger[level](message, value)
    } catch {
      // Router diagnostics must not interfere with WalletConnect delivery.
    }
  }
}
