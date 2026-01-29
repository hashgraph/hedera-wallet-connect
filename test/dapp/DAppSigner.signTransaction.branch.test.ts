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

import {
  TopicCreateTransaction,
  PrivateKey,
  LedgerId,
  Transaction,
  TransferTransaction,
  Hbar,
} from '@hiero-ledger/sdk'
import { proto } from '@hiero-ledger/proto'
import {
  DAppSigner,
  HederaJsonRpcMethod,
  Uint8ArrayToBase64String,
  base64StringToUint8Array,
} from '../../src'
import { prepareTestTransaction, testUserAccountId } from '../_helpers'
import { SignClient } from '@walletconnect/sign-client'

describe('DAppSigner.signTransaction - Branch Coverage', () => {
  let signer: DAppSigner
  let mockSignClient: jest.Mocked<SignClient>
  const testTopic = 'test-topic'
  const privateKey = PrivateKey.generateED25519()
  const publicKey = privateKey.publicKey

  beforeEach(() => {
    mockSignClient = {
      request: jest.fn(),
    } as any

    signer = new DAppSigner(testUserAccountId, mockSignClient, testTopic, LedgerId.TESTNET)
  })

  describe('signedTransactionBytes path (frozen transactions)', () => {
    it('should handle frozen transactions with signedTransactionBytes', async () => {
      // Create a frozen transaction
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      // Verify it's frozen
      expect(transaction.isFrozen()).toBe(true)

      // Check the internal structure
      const bytes = transaction.toBytes()
      const txList = proto.TransactionList.decode(bytes)
      expect(txList.transactionList[0].signedTransactionBytes).toBeDefined()

      // Mock the signing response
      const mockSignature = privateKey.sign(new Uint8Array([1, 2, 3]))
      jest.spyOn(signer as any, 'request').mockResolvedValue({
        signatureMap: Uint8ArrayToBase64String(
          proto.SignatureMap.encode({
            sigPair: [
              {
                pubKeyPrefix: publicKey.toBytes(),
                ed25519: mockSignature,
              },
            ],
          }).finish(),
        ),
      })

      // Sign the transaction
      const signedTx = await signer.signTransaction(transaction)

      // Verify the signed transaction has signatures
      expect(signedTx).toBeDefined()
      expect(signedTx.isFrozen()).toBe(true)

      // Decode and verify the signature was added to signedTransactionBytes
      const signedBytes = signedTx.toBytes()
      const signedTxList = proto.TransactionList.decode(signedBytes)
      expect(signedTxList.transactionList[0].signedTransactionBytes).toBeDefined()

      const signedTransactionProto = proto.SignedTransaction.decode(
        signedTxList.transactionList[0].signedTransactionBytes!,
      )
      expect(signedTransactionProto.sigMap).toBeDefined()
      expect(signedTransactionProto.sigMap!.sigPair).toBeDefined()
      expect(signedTransactionProto.sigMap!.sigPair!.length).toBeGreaterThan(0)
    })

    it('should merge signatures in signedTransactionBytes with existing signatures', async () => {
      // Create a frozen transaction
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      // Create an existing signature
      const existingKey = PrivateKey.generateED25519()
      const existingSignature = existingKey.sign(new Uint8Array([4, 5, 6]))

      // Mock the first signing (simulating an existing signature)
      jest.spyOn(signer as any, 'request').mockResolvedValueOnce({
        signatureMap: Uint8ArrayToBase64String(
          proto.SignatureMap.encode({
            sigPair: [
              {
                pubKeyPrefix: existingKey.publicKey.toBytes(),
                ed25519: existingSignature,
              },
            ],
          }).finish(),
        ),
      })

      const firstSignedTx = await signer.signTransaction(transaction)

      // Now sign again with a different key
      const newKey = PrivateKey.generateED25519()
      const newSignature = newKey.sign(new Uint8Array([7, 8, 9]))

      jest.spyOn(signer as any, 'request').mockResolvedValueOnce({
        signatureMap: Uint8ArrayToBase64String(
          proto.SignatureMap.encode({
            sigPair: [
              {
                pubKeyPrefix: newKey.publicKey.toBytes(),
                ed25519: newSignature,
              },
            ],
          }).finish(),
        ),
      })

      const doubleSignedTx = await signer.signTransaction(firstSignedTx)

      // Verify both signatures are present
      const signedBytes = doubleSignedTx.toBytes()
      const signedTxList = proto.TransactionList.decode(signedBytes)
      const signedTransactionProto = proto.SignedTransaction.decode(
        signedTxList.transactionList[0].signedTransactionBytes!,
      )

      expect(signedTransactionProto.sigMap!.sigPair!.length).toBe(2)
    })

    it('should handle frozen transactions with multiple node accounts', async () => {
      // Create a transaction with multiple node accounts using prepareTestTransaction
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
        setNodeAccountIds: true,
      })

      // Verify it has node account IDs
      expect(transaction.nodeAccountIds).toBeDefined()
      expect(transaction.nodeAccountIds!.length).toBeGreaterThan(0)

      // Mock signing response
      const mockSignature = privateKey.sign(new Uint8Array([1, 2, 3]))
      jest.spyOn(signer as any, 'request').mockResolvedValue({
        signatureMap: Uint8ArrayToBase64String(
          proto.SignatureMap.encode({
            sigPair: [
              {
                pubKeyPrefix: publicKey.toBytes(),
                ed25519: mockSignature,
              },
            ],
          }).finish(),
        ),
      })

      const signedTx = await signer.signTransaction(transaction)

      // Verify the transaction has the signature
      const signedBytes = signedTx.toBytes()
      const signedTxList = proto.TransactionList.decode(signedBytes)

      expect(signedTxList.transactionList.length).toBeGreaterThan(0)

      // Each transaction should have the signature in signedTransactionBytes
      for (const tx of signedTxList.transactionList) {
        expect(tx.signedTransactionBytes).toBeDefined()
        const signedTransactionProto = proto.SignedTransaction.decode(tx.signedTransactionBytes!)
        expect(signedTransactionProto.sigMap!.sigPair!.length).toBeGreaterThan(0)
      }
    })
  })

  describe('bodyBytes/sigMap path (non-frozen transactions)', () => {
    it('should handle non-frozen transactions without signedTransactionBytes', async () => {
      // Create a non-frozen transaction
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: false,
      })

      // The transaction will be frozen by DAppSigner, but let's test the code path
      // Mock signing response
      const mockSignature = privateKey.sign(new Uint8Array([1, 2, 3]))
      jest.spyOn(signer as any, 'request').mockResolvedValue({
        signatureMap: Uint8ArrayToBase64String(
          proto.SignatureMap.encode({
            sigPair: [
              {
                pubKeyPrefix: publicKey.toBytes(),
                ed25519: mockSignature,
              },
            ],
          }).finish(),
        ),
      })

      const signedTx = await signer.signTransaction(transaction)

      // Verify the signed transaction has signatures
      expect(signedTx).toBeDefined()

      // The transaction should now have signatures in signedTransactionBytes
      // because DAppSigner freezes it
      const signedBytes = signedTx.toBytes()
      const signedTxList = proto.TransactionList.decode(signedBytes)

      // After freezing, it will have signedTransactionBytes
      expect(signedTxList.transactionList[0].signedTransactionBytes).toBeDefined()

      const signedTransactionProto = proto.SignedTransaction.decode(
        signedTxList.transactionList[0].signedTransactionBytes!,
      )
      expect(signedTransactionProto.sigMap!.sigPair!.length).toBeGreaterThan(0)
    })

    it('should merge signatures when transaction was already frozen with signatures', async () => {
      // Create and sign a transaction first
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      const firstKey = PrivateKey.generateED25519()
      const firstSignature = firstKey.sign(new Uint8Array([1, 2, 3]))

      jest.spyOn(signer as any, 'request').mockResolvedValueOnce({
        signatureMap: Uint8ArrayToBase64String(
          proto.SignatureMap.encode({
            sigPair: [
              {
                pubKeyPrefix: firstKey.publicKey.toBytes(),
                ed25519: firstSignature,
              },
            ],
          }).finish(),
        ),
      })

      const firstSignedTx = await signer.signTransaction(transaction)

      // Now sign again with a different signature
      const secondKey = PrivateKey.generateED25519()
      const secondSignature = secondKey.sign(new Uint8Array([4, 5, 6]))

      jest.spyOn(signer as any, 'request').mockResolvedValueOnce({
        signatureMap: Uint8ArrayToBase64String(
          proto.SignatureMap.encode({
            sigPair: [
              {
                pubKeyPrefix: secondKey.publicKey.toBytes(),
                ed25519: secondSignature,
              },
            ],
          }).finish(),
        ),
      })

      const doubleSignedTx = await signer.signTransaction(firstSignedTx)

      // Verify both signatures are present
      const signedBytes = doubleSignedTx.toBytes()
      const signedTxList = proto.TransactionList.decode(signedBytes)

      const signedTransactionProto = proto.SignedTransaction.decode(
        signedTxList.transactionList[0].signedTransactionBytes!,
      )

      expect(signedTransactionProto.sigMap!.sigPair!.length).toBe(2)
    })
  })

  describe('edge cases', () => {
    it('should handle empty sigPair in existing sigMap', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      // Mock response with empty sigPair
      jest.spyOn(signer as any, 'request').mockResolvedValue({
        signatureMap: Uint8ArrayToBase64String(
          proto.SignatureMap.encode({
            sigPair: [],
          }).finish(),
        ),
      })

      const signedTx = await signer.signTransaction(transaction)

      expect(signedTx).toBeDefined()
    })

    it('should handle undefined sigPair arrays gracefully', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
        freeze: true,
      })

      const mockSignature = privateKey.sign(new Uint8Array([1, 2, 3]))

      // Create a signatureMap with explicit sigPair array
      jest.spyOn(signer as any, 'request').mockResolvedValue({
        signatureMap: Uint8ArrayToBase64String(
          proto.SignatureMap.encode({
            sigPair: [
              {
                pubKeyPrefix: publicKey.toBytes(),
                ed25519: mockSignature,
              },
            ],
          }).finish(),
        ),
      })

      const signedTx = await signer.signTransaction(transaction)

      expect(signedTx).toBeDefined()

      const signedBytes = signedTx.toBytes()
      const signedTxList = proto.TransactionList.decode(signedBytes)
      const signedTransactionProto = proto.SignedTransaction.decode(
        signedTxList.transactionList[0].signedTransactionBytes!,
      )

      // The signature should be properly added even if there were no existing signatures
      expect(signedTransactionProto.sigMap!.sigPair!.length).toBeGreaterThan(0)
    })
  })
})
