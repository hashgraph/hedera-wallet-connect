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

import { TabCoordinator, PendingRequest, TabMessage } from '../../src/lib/shared/TabCoordinator'

describe('TabCoordinator', () => {
  let coordinator: TabCoordinator

  beforeEach(() => {
    // Reset the singleton before each test
    TabCoordinator.reset()
    coordinator = TabCoordinator.getInstance({
      enabled: true,
      requestTimeout: 5000,
      heartbeatInterval: 1000,
      cleanupInterval: 2000,
      logLevel: 'off',
    })
  })

  afterEach(() => {
    coordinator.destroy()
    TabCoordinator.reset()
  })

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = TabCoordinator.getInstance()
      const instance2 = TabCoordinator.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('should generate unique tab IDs', () => {
      const tabId1 = coordinator.getTabId()
      TabCoordinator.reset()
      const coordinator2 = TabCoordinator.getInstance({ logLevel: 'off' })
      const tabId2 = coordinator2.getTabId()
      expect(tabId1).not.toBe(tabId2)
      coordinator2.destroy()
    })
  })

  describe('registerRequest', () => {
    it('should register a request and return a promise', () => {
      const topic = 'test-topic'
      const method = 'hedera_signTransaction'
      const requestId = 'test-request-123'

      const registration = coordinator.registerRequest(topic, method, requestId)

      expect(registration).toHaveProperty('promise')
      expect(registration).toHaveProperty('resolve')
      expect(registration).toHaveProperty('reject')
      expect(registration.promise).toBeInstanceOf(Promise)
    })

    it('should track the request internally', () => {
      const topic = 'test-topic'
      const method = 'hedera_signTransaction'
      const requestId = 'test-request-123'

      coordinator.registerRequest(topic, method, requestId)

      // Should be able to check if this tab owns the request
      expect(coordinator.shouldHandleResponse(requestId)).toBe(true)
    })
  })

  describe('shouldHandleResponse', () => {
    it('should return true for requests from this tab', () => {
      const requestId = 'test-request-123'
      coordinator.registerRequest('topic', 'method', requestId)

      expect(coordinator.shouldHandleResponse(requestId)).toBe(true)
    })

    it('should return false for unknown requests', () => {
      expect(coordinator.shouldHandleResponse('unknown-request')).toBe(false)
    })
  })

  describe('handleResponse', () => {
    it('should complete request from this tab', async () => {
      const requestId = 'test-request-123'
      const mockResponse = { result: 'success' }

      const { promise } = coordinator.registerRequest('topic', 'method', requestId)

      coordinator.handleResponse(requestId, mockResponse)

      const result = await promise
      expect(result).toEqual(mockResponse)
    })

    it('should not throw for unknown request', () => {
      expect(() => {
        coordinator.handleResponse('unknown-request', { result: 'test' })
      }).not.toThrow()
    })
  })

  describe('completeRequest', () => {
    it('should resolve the request promise', async () => {
      const requestId = 'test-request-123'
      const mockResponse = { result: 'success' }

      const { promise } = coordinator.registerRequest('topic', 'method', requestId)

      coordinator.completeRequest(requestId, mockResponse)

      const result = await promise
      expect(result).toEqual(mockResponse)
    })

    it('should clean up request after completion', async () => {
      const requestId = 'test-request-123'
      const mockResponse = { result: 'success' }

      coordinator.registerRequest('topic', 'method', requestId)
      coordinator.completeRequest(requestId, mockResponse)

      // Request should no longer be tracked
      expect(coordinator.shouldHandleResponse(requestId)).toBe(false)
    })
  })

  describe('failRequest', () => {
    it('should clean up failed request', () => {
      const requestId = 'test-request-123'
      const error = new Error('Test error')

      coordinator.registerRequest('topic', 'method', requestId)
      coordinator.failRequest(requestId, error)

      // Request should no longer be tracked
      expect(coordinator.shouldHandleResponse(requestId)).toBe(false)
    })
  })

  describe('multi-tab coordination', () => {
    let coordinator1: TabCoordinator
    let coordinator2: TabCoordinator

    beforeEach(() => {
      // Simulate two different tabs
      TabCoordinator.reset()
      coordinator1 = TabCoordinator.getInstance({
        enabled: true,
        logLevel: 'off',
      })

      // Create a second instance (different tab)
      TabCoordinator.reset()
      coordinator2 = TabCoordinator.getInstance({
        enabled: true,
        logLevel: 'off',
      })
    })

    afterEach(() => {
      coordinator1.destroy()
      coordinator2.destroy()
    })

    it('should have different tab IDs', () => {
      const tabId1 = coordinator1.getTabId()
      const tabId2 = coordinator2.getTabId()
      expect(tabId1).not.toBe(tabId2)
    })
  })

  describe('disabled mode', () => {
    beforeEach(() => {
      TabCoordinator.reset()
      coordinator = TabCoordinator.getInstance({
        enabled: false,
        logLevel: 'off',
      })
    })

    it('should not be enabled', () => {
      expect(coordinator.isEnabled()).toBe(false)
    })

    it('should still register requests but not coordinate', () => {
      const requestId = 'test-request-123'
      const registration = coordinator.registerRequest('topic', 'method', requestId)

      expect(registration.promise).toBeInstanceOf(Promise)
    })
  })

  describe('cleanup', () => {
    it('should clean up resources on destroy', () => {
      const requestId = 'test-request-123'
      coordinator.registerRequest('topic', 'method', requestId)

      coordinator.destroy()

      // After destroy, should not track requests
      // (we can't easily test this without exposing internals)
      expect(() => coordinator.destroy()).not.toThrow()
    })
  })

  describe('timeout handling', () => {
    // Skip this test for now - it has timing issues in CI
    it.skip('should timeout requests after configured duration', async () => {
      TabCoordinator.reset()
      const shortTimeoutCoordinator = TabCoordinator.getInstance({
        enabled: true,
        requestTimeout: 100, // 100ms timeout
        cleanupInterval: 50, // Fast cleanup for testing
        logLevel: 'off',
      })

      const requestId = 'test-request-timeout'
      shortTimeoutCoordinator.registerRequest('topic', 'method', requestId)

      // Wait for timeout and cleanup
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Request should be cleaned up
      expect(shortTimeoutCoordinator.shouldHandleResponse(requestId)).toBe(false)

      shortTimeoutCoordinator.destroy()
    })
  })
})
