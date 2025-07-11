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
  proto,
} from '@hashgraph/proto'
import {
  AccountId,
  PrivateKey,
  PublicKey,
  SignerSignature,
  TopicCreateTransaction,
  LedgerId,
} from '@hashgraph/sdk'
import {
  prefixMessageToSign,
  stringToSignerMessage,
  verifyMessageSignature,
  verifySignerSignature,
  signerSignaturesToSignatureMap,
  signatureMapToBase64String,
  base64StringToSignatureMap,
  transactionToTransactionBody,
  transactionBodyToBase64String,
  base64StringToTransactionBody,
  transactionListToBase64String,
  base64StringToUint8Array,
  accountAndLedgerFromSession,
} from '../src'
import { prepareTestTransaction, useJsonFixture, testUserAccountId } from './_helpers'
import { SessionTypes } from '@walletconnect/types'

describe('additional utils', () => {
  describe(prefixMessageToSign.name, () => {
    it('should prefix message with length', () => {
      const message = 'hello'
      const prefixed = prefixMessageToSign(message)
      expect(prefixed).toBe('\x19Hedera Signed Message:\n5' + message)
    })
  })

  describe(stringToSignerMessage.name, () => {
    it('should convert message to signer message array', () => {
      const msg = 'test'
      const result = stringToSignerMessage(msg)
      expect(result).toEqual([Buffer.from(prefixMessageToSign(msg))])
    })
  })

  describe('verify signatures', () => {
    const message = 'verify me'
    let privateKey: PrivateKey
    let publicKey: PublicKey
    let signature: Uint8Array

    beforeEach(() => {
      privateKey = PrivateKey.generateED25519()
      publicKey = privateKey.publicKey
      signature = privateKey.sign(Buffer.from(prefixMessageToSign(message)))
    })

    it('should verify SignerSignature', () => {
      const signerSignature = new SignerSignature({
        accountId: testUserAccountId,
        publicKey,
        signature,
      })

      expect(verifySignerSignature(message, signerSignature, publicKey)).toBe(true)
    })

    it('should throw when SignerSignature missing signature', () => {
      const signerSignature = { publicKey, accountId: testUserAccountId } as unknown as SignerSignature
      expect(() => verifySignerSignature(message, signerSignature, publicKey)).toThrow(
        'Signature not found in signature map',
      )
    })

    it('should verify SignatureMap string', () => {
      const sigMap = proto.SignatureMap.create({
        sigPair: [
          {
            pubKeyPrefix: publicKey.toBytes(),
            ed25519: signature,
          },
        ],
      })

      const base64 = signatureMapToBase64String(sigMap)
      expect(verifyMessageSignature(message, base64, publicKey)).toBe(true)
    })

    it('should throw when SignatureMap has no signature', () => {
      const sigMap = proto.SignatureMap.create({ sigPair: [{ pubKeyPrefix: publicKey.toBytes() }] })
      const base64 = signatureMapToBase64String(sigMap)
      expect(() => verifyMessageSignature(message, base64, publicKey)).toThrow(
        'Signature not found in signature map',
      )
    })

    it('should round trip signature map encoding', () => {
      const sigMap = proto.SignatureMap.create({
        sigPair: [
          {
            pubKeyPrefix: publicKey.toBytes(),
            ed25519: signature,
          },
        ],
      })
      const base64 = signatureMapToBase64String(sigMap)
      const decoded = base64StringToSignatureMap(base64)
      expect(decoded.sigPair?.length).toBe(1)
      expect(Buffer.from(decoded.sigPair![0].ed25519 as Uint8Array)).toEqual(Buffer.from(signature))
    })
  })

  describe(signerSignaturesToSignatureMap.name, () => {
    it('should convert signer signatures to SignatureMap', () => {
      const key = PrivateKey.generateED25519()
      const sig = key.sign(Buffer.from(prefixMessageToSign('a')))
      const signerSig = new SignerSignature({ accountId: testUserAccountId, publicKey: key.publicKey, signature: sig })
      const sigMap = signerSignaturesToSignatureMap([signerSig])
      expect(sigMap.sigPair?.length).toBe(1)
      expect(Buffer.from(sigMap.sigPair![0].ed25519 as Uint8Array)).toEqual(Buffer.from(sig))
    })
  })

  describe('transaction body helpers', () => {
    it('should encode and decode transaction bodies', () => {
      const txn = prepareTestTransaction(new TopicCreateTransaction())
      const body = transactionToTransactionBody(txn)
      const encoded = transactionBodyToBase64String(body)
      const decoded = base64StringToTransactionBody(encoded)
      expect(transactionBodyToBase64String(decoded)).toBe(encoded)
    })

    it('should encode transaction list to base64', () => {
      const list = proto.TransactionList.create()
      const encoded = transactionListToBase64String(list)
      const bytes = base64StringToUint8Array(encoded)
      const decoded = proto.TransactionList.decode(bytes)
      expect(decoded.transactionList.length).toBe(0)
    })
  })

  describe(accountAndLedgerFromSession.name, () => {
    it('should parse accounts from session', () => {
      const session = useJsonFixture('fakeSession') as SessionTypes.Struct
      const result = accountAndLedgerFromSession(session)
      expect(result[0].network).toBe(LedgerId.TESTNET)
      expect(result[0].account.toString()).toBe('0.0.5841839')
    })
  })
})
