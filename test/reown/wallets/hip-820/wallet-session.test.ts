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


import { AccountId } from '@hashgraph/sdk'
import { formatJsonRpcResult } from '@walletconnect/jsonrpc-utils'
import { HIP820Wallet, HederaJsonRpcMethod, HederaChainId } from '../../../../src'

describe('HIP820Wallet Session Handling', () => {
  let wallet820: HIP820Wallet
  const dummyWallet: any = {
    getNetwork: jest.fn().mockReturnValue({ '0.0.3': AccountId.fromString('0.0.3') }),
  }

  beforeEach(() => {
    wallet820 = new HIP820Wallet(dummyWallet)
  })

  describe('validateParam', () => {
    it('does not throw for correct types', () => {
      expect(() => wallet820.validateParam('list', [], 'array')).not.toThrow()
      expect(() => wallet820.validateParam('str', 'hello', 'string')).not.toThrow()
    })
    it('throws for incorrect types', () => {
      expect(() => wallet820.validateParam('num', 'not a number', 'number')).toThrowError()
    })
  })

  describe('parseSessionRequest', () => {
    it('parses GetNodeAddresses request', () => {
      const event = {
        id: 10,
        topic: 'topic1',
        params: {
          request: { method: HederaJsonRpcMethod.GetNodeAddresses, params: undefined },
          chainId: HederaChainId.Testnet,
        },
      }
      const result = wallet820.parseSessionRequest(event)
      expect(result).toEqual({
        method: HederaJsonRpcMethod.GetNodeAddresses,
        chainId: HederaChainId.Testnet,
        id: 10,
        topic: 'topic1',
        body: undefined,
        accountId: undefined,
      })
    })

    it('throws on missing params for ExecuteTransaction', () => {
      const event = {
        id: 11,
        topic: 'topic2',
        params: {
          request: {
            method: HederaJsonRpcMethod.ExecuteTransaction,
            params: { transactionList: 123 },
          },
          chainId: HederaChainId.Testnet,
        },
      }
      expect(() => wallet820.parseSessionRequest(event)).toThrowError()
    })

    it('parses SignMessage request', () => {
      const chainPrefixed = `${HederaChainId.Testnet}:0.0.123`
      const message = 'test-msg'
      const event = {
        id: 12,
        topic: 'topic3',
        params: {
          request: {
            method: HederaJsonRpcMethod.SignMessage,
            params: { signerAccountId: chainPrefixed, message },
          },
          chainId: HederaChainId.Testnet,
        },
      }
      const { method, body, accountId } = wallet820.parseSessionRequest(event)
      expect(method).toBe(HederaJsonRpcMethod.SignMessage)
      expect(body).toBe(message)
      expect(accountId!.toString()).toBe('0.0.123')
    })
  })

  describe('approveSessionRequest & rejectSessionRequest', () => {
    it('rejectSessionRequest returns formatted JsonRpcError', () => {
      const err = wallet820.rejectSessionRequest({
        id: 99,
        topic: 'test',
        params: {
          request: {
            method: '',
            params: undefined,
            expiryTimestamp: undefined,
          },
          chainId: '',
        },
      })
      expect(err.id).toBe(99)
      expect(err.error).toBeDefined()
    })

    it('approveSessionRequest calls underlying method and returns its response', async () => {
      const fakeResult = formatJsonRpcResult(20, { foo: 'bar' })
      wallet820['hedera_getNodeAddresses'] = jest.fn().mockResolvedValue(fakeResult)
      const event = {
        id: 20,
        topic: '',
        params: {
          request: { method: HederaJsonRpcMethod.GetNodeAddresses, params: undefined },
          chainId: HederaChainId.Testnet,
        },
      }
      const res = await wallet820.approveSessionRequest(event as any)
      expect(res).toBe(fakeResult)
    })
  })
})
