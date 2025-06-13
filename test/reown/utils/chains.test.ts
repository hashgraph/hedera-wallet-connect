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

import {
  HederaChainDefinition,
  createNamespaces,
  getChainsFromApprovedSession,
  getChainId,
  mergeRequiredOptionalNamespaces,
} from '../../../src/reown/utils/chains'
import { CaipNetwork } from '@reown/appkit-common'

describe('Chain Utilities', () => {
  const testAccount = 'hedera:mainnet:0.0.1234'
  const chainId = 'hedera:mainnet'

  describe('createNamespaces', () => {
    it('should create Hedera namespace config', () => {
      const networks = [HederaChainDefinition.Native.Mainnet]
      const result = createNamespaces(networks as CaipNetwork[])

      expect(result.hedera).toMatchObject({
        methods: expect.arrayContaining(['hedera_signAndExecuteTransaction']),
        chains: ['hedera:mainnet'],
        rpcMap: { mainnet: 'https://mainnet.hashio.io/api' },
      })
    })

    it('should create EVM namespace config', () => {
      const networks = [HederaChainDefinition.EVM.Testnet]
      const result = createNamespaces(networks as CaipNetwork[])

      expect(result.eip155).toMatchObject({
        methods: expect.arrayContaining(['eth_sendTransaction']),
        chains: ['eip155:296'],
        rpcMap: { '296': 'https://testnet.hashio.io/api' },
      })
    })
  })

  describe('getChainsFromApprovedSession', () => {
    it('should extract chains from accounts', () => {
      const accounts = [testAccount, 'eip155:1:0x...']
      const result = getChainsFromApprovedSession(accounts)
      expect(result).toEqual(['hedera:mainnet', 'eip155:1'])
    })
  })

  describe('getChainId', () => {
    it('should extract chainId from CAIP string', () => {
      expect(getChainId(chainId)).toBe('mainnet')
    })

    it('should return original value if no namespace', () => {
      expect(getChainId('mainnet')).toBe('mainnet')
    })
  })

  describe('mergeRequiredOptionalNamespaces', () => {
    it('should merge namespaces with priority to required', () => {
      const required = {
        hedera: {
          methods: ['method1'],
          chains: [chainId],
          events: ['event1'],
        },
      }

      const optional = {
        hedera: {
          methods: ['method2'],
          chains: ['hedera:testnet'],
          events: ['event1', 'event2'],
        },
      }

      const result = mergeRequiredOptionalNamespaces(required, optional)

      expect(result.hedera).toMatchObject({
        methods: ['method2', 'method1'],
        chains: ['hedera:testnet', chainId],
        events: ['event1', 'event2'],
      })
    })
  })
})
