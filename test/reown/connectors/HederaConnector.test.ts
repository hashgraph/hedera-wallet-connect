/*
 *
 * Hedera Wallet Connect
 *
 * Copyright (C) 2025 Hedera Hashgraph, LLC
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

import { CaipNetwork } from '@reown/appkit-common'
import { createNamespaces, HederaChainDefinition } from '../../../src'
import { HederaConnector } from '../../../src/reown/connectors'

const mockProvider = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  session: null,
  client: {
    core: {
      crypto: {
        getClientId: jest.fn(),
      },
    },
  },
}

const testNetworks = [HederaChainDefinition.Native.Mainnet] as CaipNetwork[]

describe('HederaConnector', () => {
  let connector: HederaConnector

  beforeEach(() => {
    connector = new HederaConnector({
      provider: mockProvider as any,
      caipNetworks: testNetworks,
      namespace: 'hedera',
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('connectWalletConnect', () => {
    it('should connect with correct namespaces', async () => {
      await connector.connectWalletConnect()
      expect(mockProvider.connect).toHaveBeenCalledWith({
        optionalNamespaces: createNamespaces(testNetworks),
      })
    })

    it('should skip connection when already authenticated', async () => {
      jest.spyOn(connector, 'authenticate').mockResolvedValue(true)
      ;(mockProvider.client.core.crypto.getClientId as jest.Mock).mockResolvedValue('id')
      mockProvider.session = { topic: 't' } as any

      const result = await connector.connectWalletConnect()

      expect(mockProvider.connect).not.toHaveBeenCalled()
      expect(result).toEqual({ clientId: 'id', session: mockProvider.session })
    })
  })

  describe('disconnect', () => {
    it('should call provider disconnect', async () => {
      await connector.disconnect()
      expect(mockProvider.disconnect).toHaveBeenCalled()
    })
  })

  describe('Properties', () => {
    it('should return correct chain namespace', () => {
      expect(connector.chain).toBe('hedera')
    })

    it('should return configured networks', () => {
      expect(connector.chains).toEqual(testNetworks)
    })
  })
})
