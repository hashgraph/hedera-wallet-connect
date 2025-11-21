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

import { TopicCreateTransaction, PrivateKey, LedgerId, SignerSignature } from '@hashgraph/sdk'
import { proto } from '@hashgraph/proto'
import {
  transactionListToBase64String,
  extractFirstSignature,
  base64StringToTransactionBody,
  verifyMessageSignature,
  verifySignerSignature,
  CAIPChainIdToLedgerId,
  Uint8ArrayToBase64String,
  transactionToTransactionBody,
  transactionBodyToBase64String,
  addSignatureToTransaction,
  prefixMessageToSign,
} from '../src/lib/shared/utils'
import { prepareTestTransaction } from './_helpers'

describe('utils.ts coverage tests', () => {
  describe('transactionListToBase64String', () => {
    it('should encode a TransactionList to base64 string', () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), { freeze: true })
      const bytes = transaction.toBytes()
      const txList = proto.TransactionList.decode(bytes)

      const result = transactionListToBase64String(txList)

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)

      // Verify we can decode it back
      const decoded = proto.TransactionList.decode(Buffer.from(result, 'base64'))
      expect(decoded.transactionList.length).toBe(txList.transactionList.length)
    })

    it('should handle empty TransactionList', () => {
      const emptyList = proto.TransactionList.create({ transactionList: [] })

      const result = transactionListToBase64String(emptyList)

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })
  })

  describe('extractFirstSignature', () => {
    it('should extract ed25519 signature', () => {
      const signature = new Uint8Array([1, 2, 3, 4, 5])
      const sigMap = proto.SignatureMap.create({
        sigPair: [
          {
            pubKeyPrefix: new Uint8Array([6, 7, 8]),
            ed25519: signature,
          },
        ],
      })

      const result = extractFirstSignature(sigMap)

      expect(result).toEqual(signature)
    })

    it('should extract ECDSASecp256k1 signature', () => {
      const signature = new Uint8Array([1, 2, 3, 4, 5])
      const sigMap = proto.SignatureMap.create({
        sigPair: [
          {
            pubKeyPrefix: new Uint8Array([6, 7, 8]),
            ECDSASecp256k1: signature,
          },
        ],
      })

      const result = extractFirstSignature(sigMap)

      expect(result).toEqual(signature)
    })

    it('should extract ECDSA_384 signature', () => {
      const signature = new Uint8Array([1, 2, 3, 4, 5])
      const sigMap = proto.SignatureMap.create({
        sigPair: [
          {
            pubKeyPrefix: new Uint8Array([6, 7, 8]),
            ECDSA_384: signature,
          },
        ],
      })

      const result = extractFirstSignature(sigMap)

      expect(result).toEqual(signature)
    })

    it('should throw error when no signatures found', () => {
      const sigMap = proto.SignatureMap.create({ sigPair: [] })

      expect(() => extractFirstSignature(sigMap)).toThrow('No signatures found in response')
    })

    it('should throw error when sigPair is undefined', () => {
      const sigMap = proto.SignatureMap.create({})

      expect(() => extractFirstSignature(sigMap)).toThrow('No signatures found in response')
    })

    it('should throw error when signature fields are empty', () => {
      const sigMap = proto.SignatureMap.create({
        sigPair: [
          {
            pubKeyPrefix: new Uint8Array([6, 7, 8]),
            // No signature fields set
          },
        ],
      })

      expect(() => extractFirstSignature(sigMap)).toThrow('No signatures found in response')
    })
  })

  describe('base64StringToTransactionBody', () => {
    it('should decode base64 string to TransactionBody', () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), { freeze: true })
      const transactionBody = transactionToTransactionBody(transaction, transaction.nodeAccountIds?.[0] ?? null)
      const base64String = transactionBodyToBase64String(transactionBody)

      const result = base64StringToTransactionBody(base64String)

      expect(result).toBeDefined()
      expect(result.transactionID).toBeDefined()
    })

    it('should handle transaction body with various fields', () => {
      const txBody = proto.TransactionBody.create({
        transactionID: proto.TransactionID.create({
          accountID: proto.AccountID.create({ accountNum: 12345 }),
          transactionValidStart: proto.Timestamp.create({
            seconds: Math.floor(Date.now() / 1000),
          }),
        }),
        nodeAccountID: proto.AccountID.create({ accountNum: 3 }),
        transactionFee: 100000,
        transactionValidDuration: proto.Duration.create({ seconds: 120 }),
        consensusCreateTopic: {},
      })

      const encoded = proto.TransactionBody.encode(txBody).finish()
      const base64String = Buffer.from(encoded).toString('base64')

      const result = base64StringToTransactionBody(base64String)

      // accountNum is a Long object, not a number
      expect(result.transactionID?.accountID?.accountNum?.toNumber()).toBe(12345)
      expect(result.nodeAccountID?.accountNum?.toNumber()).toBe(3)
    })
  })

  describe('verifyMessageSignature', () => {
    it('should verify valid ed25519 message signature', () => {
      const privateKey = PrivateKey.generateED25519()
      const publicKey = privateKey.publicKey
      const message = 'Test message'
      const prefixedMessage = Buffer.from(prefixMessageToSign(message))

      const signature = privateKey.sign(prefixedMessage)

      const signatureMap = proto.SignatureMap.create({
        sigPair: [
          {
            pubKeyPrefix: publicKey.toBytes(),
            ed25519: signature,
          },
        ],
      })

      const base64SignatureMap = Uint8ArrayToBase64String(
        proto.SignatureMap.encode(signatureMap).finish(),
      )

      const result = verifyMessageSignature(message, base64SignatureMap, publicKey)

      expect(result).toBe(true)
    })

    it('should verify valid ECDSA message signature', () => {
      const privateKey = PrivateKey.generateECDSA()
      const publicKey = privateKey.publicKey
      const message = 'Test ECDSA message'
      const prefixedMessage = Buffer.from(prefixMessageToSign(message))

      const signature = privateKey.sign(prefixedMessage)

      const signatureMap = proto.SignatureMap.create({
        sigPair: [
          {
            pubKeyPrefix: publicKey.toBytes(),
            ECDSASecp256k1: signature,
          },
        ],
      })

      const base64SignatureMap = Uint8ArrayToBase64String(
        proto.SignatureMap.encode(signatureMap).finish(),
      )

      const result = verifyMessageSignature(message, base64SignatureMap, publicKey)

      expect(result).toBe(true)
    })

    it('should return false for invalid signature', () => {
      const privateKey = PrivateKey.generateED25519()
      const publicKey = privateKey.publicKey
      const wrongKey = PrivateKey.generateED25519()
      const message = 'Test message'
      const prefixedMessage = Buffer.from(prefixMessageToSign(message))

      // Sign with wrong key
      const signature = wrongKey.sign(prefixedMessage)

      const signatureMap = proto.SignatureMap.create({
        sigPair: [
          {
            pubKeyPrefix: publicKey.toBytes(),
            ed25519: signature,
          },
        ],
      })

      const base64SignatureMap = Uint8ArrayToBase64String(
        proto.SignatureMap.encode(signatureMap).finish(),
      )

      const result = verifyMessageSignature(message, base64SignatureMap, publicKey)

      expect(result).toBe(false)
    })

    it('should throw error when signature not found in signature map', () => {
      const publicKey = PrivateKey.generateED25519().publicKey

      const signatureMap = proto.SignatureMap.create({
        sigPair: [
          {
            pubKeyPrefix: publicKey.toBytes(),
            // No signature fields
          },
        ],
      })

      const base64SignatureMap = Uint8ArrayToBase64String(
        proto.SignatureMap.encode(signatureMap).finish(),
      )

      expect(() => verifyMessageSignature('test', base64SignatureMap, publicKey)).toThrow(
        'Signature not found in signature map',
      )
    })
  })

  describe('verifySignerSignature', () => {
    it('should verify valid signer signature', () => {
      const privateKey = PrivateKey.generateED25519()
      const publicKey = privateKey.publicKey
      const message = 'Test message for signer'
      const prefixedMessage = Buffer.from(prefixMessageToSign(message))

      const signature = privateKey.sign(prefixedMessage)

      const signerSignature: SignerSignature = {
        publicKey: publicKey.toBytes(),
        signature: signature,
        accountId: null,
      }

      const result = verifySignerSignature(message, signerSignature, publicKey)

      expect(result).toBe(true)
    })

    it('should return false for invalid signer signature', () => {
      const privateKey = PrivateKey.generateED25519()
      const publicKey = privateKey.publicKey
      const wrongKey = PrivateKey.generateED25519()
      const message = 'Test message for signer'
      const prefixedMessage = Buffer.from(prefixMessageToSign(message))

      // Sign with wrong key
      const signature = wrongKey.sign(prefixedMessage)

      const signerSignature: SignerSignature = {
        publicKey: publicKey.toBytes(),
        signature: signature,
        accountId: null,
      }

      const result = verifySignerSignature(message, signerSignature, publicKey)

      expect(result).toBe(false)
    })

    it('should throw error when signature is null', () => {
      const publicKey = PrivateKey.generateED25519().publicKey

      const signerSignature: SignerSignature = {
        publicKey: publicKey.toBytes(),
        signature: null as any,
        accountId: null,
      }

      expect(() => verifySignerSignature('test', signerSignature, publicKey)).toThrow(
        'Signature not found in signature map',
      )
    })

    it('should throw error when signature is undefined', () => {
      const publicKey = PrivateKey.generateED25519().publicKey

      const signerSignature: SignerSignature = {
        publicKey: publicKey.toBytes(),
        signature: undefined as any,
        accountId: null,
      }

      expect(() => verifySignerSignature('test', signerSignature, publicKey)).toThrow(
        'Signature not found in signature map',
      )
    })
  })

  describe('CAIPChainIdToLedgerId', () => {
    it('should return default ledger ID for unknown chain ID', () => {
      const unknownChainId = 'hedera:unknown-network'

      const result = CAIPChainIdToLedgerId(unknownChainId)

      expect(result).toBeDefined()
      expect(result.toString()).toBe(LedgerId.LOCAL_NODE.toString())
    })

    it('should return mainnet for valid mainnet chain ID', () => {
      const mainnetChainId = 'hedera:mainnet'

      const result = CAIPChainIdToLedgerId(mainnetChainId)

      expect(result.toString()).toBe(LedgerId.MAINNET.toString())
    })

    it('should return testnet for valid testnet chain ID', () => {
      const testnetChainId = 'hedera:testnet'

      const result = CAIPChainIdToLedgerId(testnetChainId)

      expect(result.toString()).toBe(LedgerId.TESTNET.toString())
    })
  })

  describe('addSignatureToTransaction', () => {
    it('should add signature to frozen transaction', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), { freeze: true })
      const privateKey = PrivateKey.generateED25519()

      const signedTx = await addSignatureToTransaction(transaction, privateKey)

      expect(signedTx).toBeDefined()
      expect(signedTx.isFrozen()).toBe(true)

      // Verify signature was added
      const bytes = signedTx.toBytes()
      const txList = proto.TransactionList.decode(bytes)
      const signedTransactionProto = proto.SignedTransaction.decode(
        txList.transactionList[0].signedTransactionBytes!,
      )

      expect(signedTransactionProto.sigMap).toBeDefined()
      expect(signedTransactionProto.sigMap!.sigPair!.length).toBeGreaterThan(0)
    })

    it('should handle transaction from bytes and add signature', async () => {
      // Create a frozen transaction, convert to bytes, then back
      const originalTx = prepareTestTransaction(new TopicCreateTransaction(), { freeze: true })
      const bytes = originalTx.toBytes()
      const transaction = TopicCreateTransaction.fromBytes(bytes)

      const privateKey = PrivateKey.generateED25519()

      const signedTx = await addSignatureToTransaction(transaction, privateKey)

      expect(signedTx).toBeDefined()

      // Verify signature was added
      const signedBytes = signedTx.toBytes()
      const txList = proto.TransactionList.decode(signedBytes)

      // Frozen transactions will have signedTransactionBytes
      expect(txList.transactionList[0].signedTransactionBytes).toBeDefined()
      const signedTransactionProto = proto.SignedTransaction.decode(
        txList.transactionList[0].signedTransactionBytes!,
      )
      expect(signedTransactionProto.sigMap!.sigPair!.length).toBeGreaterThan(0)
    })

    it('should merge with existing signatures in frozen transaction', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), { freeze: true })
      const firstKey = PrivateKey.generateED25519()
      const secondKey = PrivateKey.generateED25519()

      // Add first signature
      const firstSignedTx = await addSignatureToTransaction(transaction, firstKey)

      // Add second signature
      const doubleSignedTx = await addSignatureToTransaction(firstSignedTx, secondKey)

      expect(doubleSignedTx).toBeDefined()

      // Verify both signatures are present
      const bytes = doubleSignedTx.toBytes()
      const txList = proto.TransactionList.decode(bytes)
      const signedTransactionProto = proto.SignedTransaction.decode(
        txList.transactionList[0].signedTransactionBytes!,
      )

      expect(signedTransactionProto.sigMap!.sigPair!.length).toBe(2)
    })

    it('should add signature to all transactions in list', async () => {
      const transaction = prepareTestTransaction(new TopicCreateTransaction(), { freeze: true })
      const privateKey = PrivateKey.generateED25519()

      const signedTx = await addSignatureToTransaction(transaction, privateKey)

      const bytes = signedTx.toBytes()
      const txList = proto.TransactionList.decode(bytes)

      // All transactions should have the signature
      for (const tx of txList.transactionList) {
        if (tx.signedTransactionBytes) {
          const signedTransactionProto = proto.SignedTransaction.decode(tx.signedTransactionBytes)
          expect(signedTransactionProto.sigMap!.sigPair!.length).toBeGreaterThan(0)
        } else {
          expect(tx.sigMap!.sigPair!.length).toBeGreaterThan(0)
        }
      }
    })
  })
})
