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
  getAccountInfo,
  HederaAdapter,
  HederaChainDefinition,
  hederaNamespace,
} from '../../src'
import { testUserAccountId } from '../_helpers'

jest.mock('../../src/lib/shared/mirrorNode')

describe('HederaAdapter', () => {
  let adapter: HederaAdapter
  let mockUniversalProvider: HederaAdapter['provider']
  let mockSend = jest.fn().mockResolvedValue('0x123')
  let mockSign = jest.fn().mockResolvedValue({ signatureMap: 'test' })

  beforeEach(() => {
    mockUniversalProvider = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      hedera_signMessage: mockSign,
      eth_sendTransaction: mockSend,
      session: {
        namespaces: {
          hedera: {
            accounts: [`hedera:mainnet:${testUserAccountId.toString()}`],
          },
        },
      },
    } as unknown as HederaAdapter['provider']

    adapter = new HederaAdapter({
      namespace: hederaNamespace,
      networks: [HederaChainDefinition.Native.Mainnet],
    })
    adapter['provider'] = mockUniversalProvider as any
  })

  describe('Constructor', () => {
    it('should throw for invalid namespace', () => {
      expect(() => new HederaAdapter({ namespace: 'invalid' as any })).toThrow()
    })
  })

  describe('connect', () => {
    it('should return connection data', async () => {
      const result = await adapter.connect({ chainId: 'hedera:mainnet', id: '', type: '' })
      expect(result.type).toBe('WALLET_CONNECT')
    })
  })

  describe('getAccounts', () => {
    it('should extract addresses from session', async () => {
      const prov = adapter['provider']
      const result = await adapter.getAccounts({ namespace: hederaNamespace, id: '' })
      expect(result.accounts[0].address).toBe(testUserAccountId.toString())
    })
  })

  describe('getBalance', () => {
    it('should return formatted balance', async () => {
      const mockBalance = { balance: { balance: 100_000_000 } }
      ;(getAccountInfo as jest.Mock).mockResolvedValue(mockBalance)

      const result = await adapter.getBalance({
        address: testUserAccountId.toString(),
        caipNetwork: HederaChainDefinition.Native.Mainnet,
        chainId: 'hedera:mainnet',
      })

      expect(result.balance).toBe('1.0')
    })
    it('should return zero balance', async () => {
      const result = await adapter.getBalance({
        address: testUserAccountId.toString(),
        chainId: 'hedera:mainnet',
      })

      expect(result.balance).toBe('0')
    })
  })

  describe('signMessage', () => {
    it('should use hedera signing', async () => {
      await adapter.signMessage({
        provider: mockUniversalProvider as any,
        message: 'test',
        address: testUserAccountId.toString(),
      })

      expect(mockSign).toHaveBeenCalled()
    })
  })

  describe('EVM Methods', () => {
    let evmAdapter: HederaAdapter

    beforeEach(() => {
      evmAdapter = new HederaAdapter({
        namespace: 'eip155',
        networks: [HederaChainDefinition.EVM.Testnet],
      })
    })

    it('should send transaction', async () => {
      const result = await evmAdapter.sendTransaction({
        provider: mockUniversalProvider as any,
        to: '0x...',
        value: BigInt(1),
        data: '0x',
        gas: BigInt(21000),
        gasPrice: BigInt(100),
        address: '0x...',
        caipNetwork: {} as any,
      })

      expect(result.hash).toBe('0x123')
    })
  })
})
