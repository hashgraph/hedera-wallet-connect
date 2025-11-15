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

import type { ISignClient } from '@walletconnect/types'
import { TabCoordinator } from '../shared'
import { ILogger } from './logger'

/**
 * Wraps a WalletConnect SignClient to intercept all responses and coordinate
 * them across multiple browser tabs.
 *
 * This solves the issue where WalletConnect v2 only delivers responses to the
 * most recently connected tab, not the tab that initiated the request.
 */
export class MultiTabSignClientWrapper {
  private tabCoordinator: TabCoordinator
  private logger: ILogger
  private originalRequest: ISignClient['request']

  constructor(
    private signClient: ISignClient,
    tabCoordinator: TabCoordinator,
    logger: ILogger,
  ) {
    this.tabCoordinator = tabCoordinator
    this.logger = logger
    this.originalRequest = signClient.request.bind(signClient)

    // Only wrap if multi-tab support is enabled
    if (this.tabCoordinator.isEnabled()) {
      this.wrapRequestMethod()
    }
  }

  /**
   * Wraps the SignClient's request method to add multi-tab coordination
   */
  private wrapRequestMethod(): void {
    const self = this

    // Override the request method
    this.signClient.request = async function <T>(
      args: Parameters<ISignClient['request']>[0],
    ): Promise<T> {
      const { topic, request, chainId } = args
      const requestId = self.generateRequestId(topic, request.method, request.params)

      self.logger.debug(`Wrapping request ${requestId} for multi-tab coordination`)

      // Register with tab coordinator
      const { promise: coordinatorPromise } = self.tabCoordinator.registerRequest(
        topic,
        request.method,
        requestId,
      )

      try {
        // Make the actual WalletConnect request using the original method
        const response = await self.originalRequest<T>({ topic, request, chainId })

        self.logger.debug(`Response received for ${requestId}`)

        // Handle the response through the coordinator
        self.tabCoordinator.handleResponse(requestId, response)

        // If this tab owns the request, return the response directly
        if (self.tabCoordinator.shouldHandleResponse(requestId)) {
          return response
        } else {
          // This response belongs to another tab
          // Wait for it to be forwarded to us (should not happen often)
          self.logger.info(
            `Response for ${requestId} received in non-owning tab, waiting for coordinator...`,
          )
          return await coordinatorPromise
        }
      } catch (error) {
        // Error occurred, notify coordinator
        self.tabCoordinator.failRequest(requestId, error)
        throw error
      }
    }

    this.logger.info('SignClient request method wrapped for multi-tab support')
  }

  /**
   * Generates a unique request ID
   */
  private generateRequestId(topic: string, method: string, params: any): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 11)
    const topicPrefix = topic.substring(0, 8)
    return `${topicPrefix}_${method}_${timestamp}_${random}`
  }

  /**
   * Gets the wrapped SignClient
   */
  public getClient(): ISignClient {
    return this.signClient
  }
}
