/*
 *
 * Hedera Wallet Connect
 *
 * Copyright (C) 2023 Hedera Hashgraph, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import { DefaultLogger, ILogger, LogLevel } from './logger'

/**
 * Represents a pending request tracked across tabs
 */
export interface PendingRequest {
  requestId: string
  tabId: string
  topic: string
  method: string
  timestamp: number
  timeoutMs: number
}

/**
 * Message types for cross-tab communication
 */
export type TabMessage =
  | {
      type: 'REQUEST_REGISTERED'
      request: PendingRequest
    }
  | {
      type: 'RESPONSE_RECEIVED'
      requestId: string
      response: any
      receivedByTabId: string
    }
  | {
      type: 'REQUEST_CLAIM'
      requestId: string
      claimingTabId: string
    }
  | {
      type: 'TAB_HEARTBEAT'
      tabId: string
      timestamp: number
    }
  | {
      type: 'REQUEST_COMPLETED'
      requestId: string
      tabId: string
    }

/**
 * Callback type for response handlers
 */
export type ResponseHandler = (response: any) => void

/**
 * Configuration options for TabCoordinator
 */
export interface TabCoordinatorOptions {
  enabled?: boolean
  requestTimeout?: number
  heartbeatInterval?: number
  cleanupInterval?: number
  logLevel?: LogLevel
}

/**
 * TabCoordinator manages cross-tab communication to ensure WalletConnect responses
 * are routed to the tab that initiated the request, even when the response arrives
 * in a different tab due to WalletConnect v2 relay limitations.
 *
 * Uses BroadcastChannel API with fallback to localStorage for broader compatibility.
 */
export class TabCoordinator {
  private static instance: TabCoordinator | null = null
  private readonly tabId: string
  private channel: BroadcastChannel | null = null
  private useLocalStorage: boolean = false
  private pendingRequests = new Map<string, PendingRequest>()
  private responseHandlers = new Map<string, ResponseHandler>()
  private otherTabsHeartbeat = new Map<string, number>()
  private logger: ILogger
  private enabled: boolean
  private readonly requestTimeout: number
  private readonly heartbeatInterval: number
  private readonly cleanupInterval: number
  private heartbeatTimer: NodeJS.Timeout | null = null
  private cleanupTimer: NodeJS.Timeout | null = null

  private constructor(options: TabCoordinatorOptions = {}) {
    this.tabId = this.generateTabId()
    this.enabled = options.enabled ?? true
    this.requestTimeout = options.requestTimeout ?? 60000 // 60 seconds
    this.heartbeatInterval = options.heartbeatInterval ?? 5000 // 5 seconds
    this.cleanupInterval = options.cleanupInterval ?? 10000 // 10 seconds
    this.logger = new DefaultLogger(options.logLevel ?? 'debug')

    if (this.enabled) {
      this.initializeCommunication()
      this.startHeartbeat()
      this.startCleanup()
      this.setupUnloadHandler()
    }

    this.logger.info(`TabCoordinator initialized with tabId: ${this.tabId}`)
  }

  /**
   * Gets the singleton instance of TabCoordinator
   */
  public static getInstance(options?: TabCoordinatorOptions): TabCoordinator {
    if (!TabCoordinator.instance) {
      TabCoordinator.instance = new TabCoordinator(options)
    }
    return TabCoordinator.instance
  }

  /**
   * Resets the singleton instance (mainly for testing)
   */
  public static reset(): void {
    if (TabCoordinator.instance) {
      TabCoordinator.instance.destroy()
      TabCoordinator.instance = null
    }
  }

  /**
   * Gets the current tab's unique identifier
   */
  public getTabId(): string {
    return this.tabId
  }

  /**
   * Checks if multi-tab coordination is enabled
   */
  public isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Generates a unique tab identifier
   */
  private generateTabId(): string {
    return `tab_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  /**
   * Initializes cross-tab communication channel
   */
  private initializeCommunication(): void {
    try {
      // Try to use BroadcastChannel API (modern browsers)
      if (typeof BroadcastChannel !== 'undefined') {
        this.channel = new BroadcastChannel('hedera-wallet-connect-tabs')
        this.channel.onmessage = (event) => this.handleMessage(event.data)
        this.useLocalStorage = false
        this.logger.debug('Using BroadcastChannel for cross-tab communication')
      } else {
        // Fallback to localStorage events
        this.useLocalStorage = true
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          window.addEventListener('storage', this.handleStorageEvent.bind(this))
          this.logger.debug('Using localStorage for cross-tab communication')
        } else {
          this.logger.warn(
            'No cross-tab communication mechanism available. Multi-tab support disabled.',
          )
          this.enabled = false
        }
      }
    } catch (error) {
      this.logger.error('Error initializing communication:', error)
      this.enabled = false
    }
  }

  /**
   * Handles storage events (fallback communication method)
   */
  private handleStorageEvent(event: StorageEvent): void {
    if (event.key === 'hedera-wc-tab-message' && event.newValue) {
      try {
        const message: TabMessage = JSON.parse(event.newValue)
        this.handleMessage(message)
      } catch (error) {
        this.logger.error('Error parsing storage message:', error)
      }
    }
  }

  /**
   * Broadcasts a message to all other tabs
   */
  private broadcastMessage(message: TabMessage): void {
    if (!this.enabled) return

    try {
      if (this.channel) {
        this.channel.postMessage(message)
      } else if (this.useLocalStorage && typeof localStorage !== 'undefined') {
        // Use localStorage as fallback
        const messageKey = 'hedera-wc-tab-message'
        localStorage.setItem(messageKey, JSON.stringify(message))
        // Clean up immediately to allow re-triggering
        setTimeout(() => localStorage.removeItem(messageKey), 50)
      }
    } catch (error) {
      this.logger.error('Error broadcasting message:', error)
    }
  }

  /**
   * Handles incoming messages from other tabs
   */
  private handleMessage(message: TabMessage): void {
    // Ignore messages from our own tab
    if ('tabId' in message && message.tabId === this.tabId) {
      return
    }

    switch (message.type) {
      case 'REQUEST_REGISTERED':
        this.handleRequestRegistered(message.request)
        break
      case 'RESPONSE_RECEIVED':
        this.handleResponseReceived(
          message.requestId,
          message.response,
          message.receivedByTabId,
        )
        break
      case 'REQUEST_CLAIM':
        this.handleRequestClaim(message.requestId, message.claimingTabId)
        break
      case 'TAB_HEARTBEAT':
        this.handleTabHeartbeat(message.tabId, message.timestamp)
        break
      case 'REQUEST_COMPLETED':
        this.handleRequestCompleted(message.requestId, message.tabId)
        break
    }
  }

  /**
   * Registers a new request that will be sent to the wallet
   * Returns a promise that resolves when the response is received
   */
  public registerRequest(
    topic: string,
    method: string,
    requestId: string,
  ): {
    promise: Promise<any>
    resolve: (value: any) => void
    reject: (reason: any) => void
  } {
    let resolveHandler: (value: any) => void
    let rejectHandler: (reason: any) => void

    const promise = new Promise<any>((resolve, reject) => {
      resolveHandler = resolve
      rejectHandler = reject
    })

    const request: PendingRequest = {
      requestId,
      tabId: this.tabId,
      topic,
      method,
      timestamp: Date.now(),
      timeoutMs: this.requestTimeout,
    }

    this.pendingRequests.set(requestId, request)
    this.responseHandlers.set(requestId, resolveHandler!)

    // Set up timeout
    setTimeout(() => {
      if (this.pendingRequests.has(requestId)) {
        this.logger.warn(`Request ${requestId} timed out after ${this.requestTimeout}ms`)
        this.failRequest(requestId, new Error('Request timeout'))
      }
    }, this.requestTimeout)

    // Broadcast to other tabs that we're sending this request
    if (this.enabled) {
      this.broadcastMessage({
        type: 'REQUEST_REGISTERED',
        request,
      })
    }

    this.logger.debug(`Registered request ${requestId} from tab ${this.tabId}`)

    return {
      promise,
      resolve: resolveHandler!,
      reject: rejectHandler!,
    }
  }

  /**
   * Called when another tab registers a request
   */
  private handleRequestRegistered(request: PendingRequest): void {
    // Store other tabs' requests so we can forward responses if needed
    this.pendingRequests.set(request.requestId, request)
    this.logger.debug(
      `Tab ${this.tabId} aware of request ${request.requestId} from tab ${request.tabId}`,
    )
  }

  /**
   * Checks if this tab should handle a response for the given request
   */
  public shouldHandleResponse(requestId: string): boolean {
    const request = this.pendingRequests.get(requestId)
    return request?.tabId === this.tabId
  }

  /**
   * Called when a response is received (possibly in the wrong tab)
   */
  public handleResponse(requestId: string, response: any): void {
    const request = this.pendingRequests.get(requestId)

    if (!request) {
      this.logger.warn(`Received response for unknown request: ${requestId}`)
      return
    }

    if (request.tabId === this.tabId) {
      // This is our request, complete it locally
      this.completeRequest(requestId, response)
    } else {
      // This response belongs to another tab, forward it
      this.logger.info(`Forwarding response for request ${requestId} to tab ${request.tabId}`)
      this.broadcastMessage({
        type: 'RESPONSE_RECEIVED',
        requestId,
        response,
        receivedByTabId: this.tabId,
      })
    }
  }

  /**
   * Called when another tab forwards a response to us
   */
  private handleResponseReceived(
    requestId: string,
    response: any,
    receivedByTabId: string,
  ): void {
    const handler = this.responseHandlers.get(requestId)
    if (handler) {
      this.logger.info(
        `Received forwarded response for request ${requestId} from tab ${receivedByTabId}`,
      )
      handler(response)
      this.cleanup(requestId)
    }
  }

  /**
   * Completes a request successfully
   */
  public completeRequest(requestId: string, response: any): void {
    const handler = this.responseHandlers.get(requestId)
    if (handler) {
      handler(response)
      this.cleanup(requestId)

      // Notify other tabs that this request is complete
      if (this.enabled) {
        this.broadcastMessage({
          type: 'REQUEST_COMPLETED',
          requestId,
          tabId: this.tabId,
        })
      }
    }
  }

  /**
   * Fails a request with an error
   */
  public failRequest(requestId: string, error: any): void {
    const handler = this.responseHandlers.get(requestId)
    if (handler) {
      // For errors, we'll just clean up locally
      // The error will be thrown by the actual request
      this.cleanup(requestId)
    }
  }

  /**
   * Called when another tab completes a request
   */
  private handleRequestCompleted(requestId: string, tabId: string): void {
    if (tabId !== this.tabId) {
      // Another tab completed this request, we can clean up our tracking
      this.pendingRequests.delete(requestId)
    }
  }

  /**
   * Handles a request claim from another tab (for orphaned requests)
   */
  private handleRequestClaim(requestId: string, claimingTabId: string): void {
    const request = this.pendingRequests.get(requestId)
    if (request && request.tabId !== claimingTabId && request.tabId !== this.tabId) {
      // Update the owner of this request
      request.tabId = claimingTabId
      this.logger.info(`Request ${requestId} claimed by tab ${claimingTabId}`)
    }
  }

  /**
   * Starts sending periodic heartbeats
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.enabled) {
        this.broadcastMessage({
          type: 'TAB_HEARTBEAT',
          tabId: this.tabId,
          timestamp: Date.now(),
        })
      }
    }, this.heartbeatInterval)
  }

  /**
   * Handles heartbeat from another tab
   */
  private handleTabHeartbeat(tabId: string, timestamp: number): void {
    this.otherTabsHeartbeat.set(tabId, timestamp)
  }

  /**
   * Starts periodic cleanup of expired requests and dead tabs
   */
  private startCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    this.cleanupTimer = setInterval(() => {
      this.performCleanup()
    }, this.cleanupInterval)
  }

  /**
   * Performs cleanup of expired requests and detects dead tabs
   */
  private performCleanup(): void {
    const now = Date.now()
    const deadTabThreshold = this.heartbeatInterval * 3 // 3 missed heartbeats

    // Clean up expired requests
    for (const [requestId, request] of this.pendingRequests.entries()) {
      const age = now - request.timestamp
      if (age > request.timeoutMs) {
        this.logger.debug(`Cleaning up expired request: ${requestId}`)
        this.cleanup(requestId)
      }
    }

    // Detect dead tabs
    const deadTabs: string[] = []
    for (const [tabId, lastHeartbeat] of this.otherTabsHeartbeat.entries()) {
      if (now - lastHeartbeat > deadTabThreshold) {
        deadTabs.push(tabId)
      }
    }

    // Handle orphaned requests from dead tabs
    if (deadTabs.length > 0) {
      this.logger.info(`Detected ${deadTabs.length} dead tab(s)`)

      for (const deadTabId of deadTabs) {
        this.otherTabsHeartbeat.delete(deadTabId)

        // Check for orphaned requests
        for (const [requestId, request] of this.pendingRequests.entries()) {
          if (request.tabId === deadTabId) {
            this.logger.info(`Found orphaned request ${requestId} from dead tab ${deadTabId}`)
            // We don't claim it automatically - the response might still arrive
            // and be handled by remaining tabs
          }
        }
      }
    }
  }

  /**
   * Cleans up a completed request
   */
  private cleanup(requestId: string): void {
    this.pendingRequests.delete(requestId)
    this.responseHandlers.delete(requestId)
  }

  /**
   * Sets up handler for tab/window unload
   */
  private setupUnloadHandler(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.destroy()
      })
    }
  }

  /**
   * Cleans up resources when the tab is closing or coordinator is destroyed
   */
  public destroy(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    if (this.channel) {
      this.channel.close()
      this.channel = null
    }

    if (this.useLocalStorage && typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageEvent.bind(this))
    }

    this.pendingRequests.clear()
    this.responseHandlers.clear()
    this.otherTabsHeartbeat.clear()

    this.logger.info(`TabCoordinator destroyed for tab ${this.tabId}`)
  }
}
