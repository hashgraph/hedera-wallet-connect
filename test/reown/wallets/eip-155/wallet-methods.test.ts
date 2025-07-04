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

import { JsonRpcProvider, TransactionResponse } from 'ethers'
import { EIP155Wallet } from '../../../../src'
import { testPrivateKeyECDSA } from '../../../_helpers'
import { PrivateKey } from '@hashgraph/sdk'

describe('EIP155Wallet Methods', () => {
  let eip155wallet: EIP155Wallet

  const privateKey = `0x${PrivateKey.fromStringECDSA(testPrivateKeyECDSA).toStringRaw()}`
  const mockProvider = new JsonRpcProvider()
  const mockTo = '0x9De4Efe3636E5578406f4a81d91A6Bb5EBa8828c'
  const mockTxHash = '0xc168ac969428eb39611aedb9d180963444ed196524509fc1c2c6f34e81480461'
  const mockSignature = '0xtestsig'

  beforeEach(() => {
    eip155wallet = EIP155Wallet.init({ privateKey })
  })

  describe('Signing Methods', () => {
    it('eth_sign should sign message', async () => {
      const message = 'test message'
      jest.spyOn(eip155wallet['wallet'], 'signMessage').mockResolvedValue(mockSignature)

      const result = await eip155wallet.eth_sign(message)
      expect(result).toBe(mockSignature)
    })

    it('personal_sign should sign message', async () => {
      const message = 'test message'
      jest.spyOn(eip155wallet['wallet'], 'signMessage').mockResolvedValue(mockSignature)

      const result = await eip155wallet.personal_sign(message)
      expect(result).toBe(mockSignature)
    })

    it('signTypedData should handle EIP712', async () => {
      const domain = { name: 'Test', version: '1', chainId: 1 }
      const types = { Person: [{ name: 'name', type: 'string' }] }
      const data = { name: 'Alice' }

      jest.spyOn(eip155wallet['wallet'], 'signTypedData').mockResolvedValue(mockSignature)

      const resultDefault = await eip155wallet.eth_signTypedData(domain, types, data)
      const resultV3 = await eip155wallet.eth_signTypedData_v3(domain, types, data)
      const resultV4 = await eip155wallet.eth_signTypedData_v4(domain, types, data)
      expect(resultDefault).toBe(mockSignature)
      expect(resultV3).toBe(mockSignature)
      expect(resultV4).toBe(mockSignature)
    })
  })

  describe('Transaction Methods', () => {
    const mockTx = { to: mockTo, value: '0x1' }

    it('eth_signTransaction should sign tx', async () => {
      jest
        .spyOn(eip155wallet, 'connect')
        .mockReturnValue({ populateTransaction: async () => mockTx } as any)
      jest.spyOn(eip155wallet['wallet'], 'signTransaction').mockResolvedValue(mockSignature)

      const result = await eip155wallet.eth_signTransaction(mockTx, mockProvider)
      expect(result).toBe(mockSignature)
    })

    it('eth_sendTransaction should broadcast tx', async () => {
      const mockResponse = { hash: mockTxHash } as TransactionResponse
      jest
        .spyOn(eip155wallet, 'connect')
        .mockReturnValue({ sendTransaction: async () => mockResponse } as any)

      const result = await eip155wallet.eth_sendTransaction(mockTx, mockProvider)
      expect(result.hash).toBe(mockTxHash)
    })

    it('eth_sendRawTransaction should broadcast raw tx', async () => {
      const rawTx =
        '0x02f87001808302904084a196dc9082627094e96bdd7fa2af09e267ba2ffdaf63c6efb63b4d7f87145cef4942972c80c001a063963bc805519def8de51805bacd89b89b773d430f87ff202f6b10aaebf9f062a04fffcc1c33271c1f17a0f0bc2ffe429141e7a7eb46425e7ca711a0f580b118c3'
      const mockResponse = { hash: mockTxHash } as TransactionResponse
      jest.spyOn(mockProvider, 'broadcastTransaction').mockResolvedValue(mockResponse)

      const result = await eip155wallet.eth_sendRawTransaction(rawTx, mockProvider)
      expect(result.hash).toBe(mockTxHash)
    })
  })
})
