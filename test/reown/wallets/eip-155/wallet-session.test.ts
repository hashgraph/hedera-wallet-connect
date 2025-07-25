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

import { EIP155Wallet } from '../../../../src/reown/wallets/EIP155Wallet'
import { getSdkError } from '@walletconnect/utils'
import { formatJsonRpcError, formatJsonRpcResult } from '@walletconnect/jsonrpc-utils'

import { testPrivateKeyECDSA, requestId, requestTopic } from '../../../_helpers'
import {
  HederaChainDefinition,
  Eip155JsonRpcMethod,
  WalletRequestEventArgs,
} from '../../../../src/reown/utils'
import { PrivateKey } from '@hashgraph/sdk'

describe('EIP155Wallet Session Management', () => {
  let wallet: EIP155Wallet
  const privateKey = `0x${PrivateKey.fromStringECDSA(testPrivateKeyECDSA).toStringRaw()}`
  const chainId = HederaChainDefinition.EVM.Testnet.caipNetworkId
  const mockTxHash = '0x4f5d7e87c3b045b72b6aab87a5aa5d9d8955e3d14a82e45f590fdf0d4e58e3c1'
  const mockSignature = '0xtestsig'

  const createEvent = (method: Eip155JsonRpcMethod, params: any[]): WalletRequestEventArgs => ({
    id: requestId,
    topic: requestTopic,
    params: {
      request: { method, params },
      chainId,
    },
  })

  beforeEach(() => {
    wallet = EIP155Wallet.init({ privateKey })
  })

  describe('approveSessionRequest', () => {
    it('should handle eth_sign request', async () => {
      const event = createEvent(Eip155JsonRpcMethod.Sign, ['0x...', 'test message'])
      jest.spyOn(wallet, 'eth_sign').mockResolvedValue(mockSignature)

      const result = await wallet.approveSessionRequest(event)
      expect(result).toEqual(formatJsonRpcResult(requestId, mockSignature))
    })

    it('should handle personal_sign request', async () => {
      const event = createEvent(Eip155JsonRpcMethod.PersonalSign, ['test message', '0x...'])
      jest.spyOn(wallet, 'eth_sign').mockResolvedValue(mockSignature)

      const result = await wallet.approveSessionRequest(event)
      expect(result).toEqual(formatJsonRpcResult(requestId, mockSignature))
    })

    it.each([
      Eip155JsonRpcMethod.SignTypedData,
      Eip155JsonRpcMethod.SignTypedDataV3,
      Eip155JsonRpcMethod.SignTypedDataV4,
    ])('should handle %s request', async (method) => {
      const event = createEvent(method, [
        {
          domain: { name: 'Test' },
          types: { TestType: [{ name: 'test', type: 'string' }], EIP712Domain: [] },
          message: { test: 'value' },
        },
      ])

      jest.spyOn(wallet, 'eth_signTypedData').mockResolvedValue(mockSignature)

      const result = await wallet.approveSessionRequest(event)
      expect(result).toEqual(formatJsonRpcResult(requestId, mockSignature))
    })

    it('should handle eth_sendTransaction', async () => {
      const event = createEvent(Eip155JsonRpcMethod.SendTransaction, [
        { to: '0x...', value: '0x1' },
      ])
      jest
        .spyOn(wallet, 'eth_sendTransaction')
        .mockResolvedValue({ hash: mockTxHash, wait: async () => {} } as any)

      const result = await wallet.approveSessionRequest(event)
      expect(result).toEqual(formatJsonRpcResult(requestId, mockTxHash))
    })

    it('should handle eth_sendRawTransaction', async () => {
      const event = createEvent(Eip155JsonRpcMethod.SendRawTransaction, ['0xfakerawtx'])
      jest
        .spyOn(wallet, 'eth_sendRawTransaction')
        .mockResolvedValue({ hash: mockTxHash } as any)

      const result = await wallet.approveSessionRequest(event)
      expect(result).toEqual(formatJsonRpcResult(requestId, mockTxHash))
    })

    it('should handle eth_signTransaction', async () => {
      const event = createEvent(Eip155JsonRpcMethod.SignTransaction, [
        { to: '0x...', value: '0x1' },
      ])
      jest.spyOn(wallet, 'eth_signTransaction').mockResolvedValue(mockSignature)

      const result = await wallet.approveSessionRequest(event)
      expect(result).toEqual(formatJsonRpcResult(requestId, mockSignature))
    })

    it('should reject unsupported network', async () => {
      const event = createEvent(Eip155JsonRpcMethod.Sign, ['0x...', 'test message'])
      event.params.chainId = 'unsupported:chain'

      const result = await wallet.approveSessionRequest(event)
      expect(result).toEqual(formatJsonRpcError(requestId, 'Unsupported network'))
    })

    it('should return error if sign method throws non-Error', async () => {
      const event = createEvent(Eip155JsonRpcMethod.Sign, ['0x...', 'test'])
      jest.spyOn(wallet, 'eth_sign').mockRejectedValue('non-error')

      const result = await wallet.approveSessionRequest(event)
      expect(result).toEqual(formatJsonRpcError(requestId, 'Failed to sign message'))
    })

    it('should return error if typed data sign throws non-Error', async () => {
      const event = createEvent(Eip155JsonRpcMethod.SignTypedData, [{}])
      jest.spyOn(wallet, 'eth_signTypedData').mockImplementation(() => {
        throw 'non-error'
      })

      const result = await wallet.approveSessionRequest(event)
      expect(result).toEqual(
        formatJsonRpcError(requestId, 'Cannot convert undefined or null to object'),
      )
    })

    it('should return error if sendTransaction throws non-Error', async () => {
      const event = createEvent(Eip155JsonRpcMethod.SendTransaction, [
        { to: '0x...', value: '0x1' },
      ])
      jest.spyOn(wallet, 'eth_sendTransaction').mockRejectedValue('non-error')

      const result = await wallet.approveSessionRequest(event)
      expect(result).toEqual(formatJsonRpcError(requestId, 'Failed to send transaction'))
    })

    it('should return error if signTransaction throws non-Error', async () => {
      const event = createEvent(Eip155JsonRpcMethod.SignTransaction, [
        { to: '0x...', value: '0x1' },
      ])
      jest.spyOn(wallet, 'eth_signTransaction').mockImplementation(() => {
        throw 'non-error'
      })

      const result = await wallet.approveSessionRequest(event)
      expect(result).toEqual(formatJsonRpcError(requestId, 'Failed to sign transaction'))
    })

    it('should throw error for unsupported method', async () => {
      const event = createEvent('eth_unsupportedMethod' as Eip155JsonRpcMethod, [])

      await expect(wallet.approveSessionRequest(event)).rejects.toThrow(
        getSdkError('INVALID_METHOD').message,
      )
    })
  })

  describe('rejectSessionRequest', () => {
    it('should return USER_REJECTED error', () => {
      const event = createEvent(Eip155JsonRpcMethod.Sign, [])
      const result = wallet.rejectSessionRequest(event)

      expect(result).toEqual(
        formatJsonRpcError(requestId, getSdkError('USER_REJECTED').message),
      )
    })
  })
})
