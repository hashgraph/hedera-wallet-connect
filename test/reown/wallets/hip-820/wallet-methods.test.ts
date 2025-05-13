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

import { AccountId, PrecheckStatusError, Status, TransactionId } from '@hashgraph/sdk'
import { proto } from '@hashgraph/proto'
import { formatJsonRpcError, formatJsonRpcResult } from '@walletconnect/jsonrpc-utils'
import { HIP820Wallet } from '../../../../src'



describe('HIP820Wallet JSON-RPC Methods', () => {
  let wallet820: HIP820Wallet
  const mockWallet: any = {
    getNetwork: jest.fn().mockReturnValue({ '0.0.3': { toString: () => '0.0.3' } }),
    sign: jest.fn(),
  }

  beforeEach(() => {
    wallet820 = new HIP820Wallet(mockWallet)
  })

  it('hedera_getNodeAddresses returns node list', async () => {
    const res = await wallet820.hedera_getNodeAddresses(1, null)
    expect(res).toEqual(formatJsonRpcResult(1, { nodes: ['0.0.3'] }))
  })

  describe('hedera_executeTransaction', () => {
    it('returns result on success', async () => {
      const fakeResp = { toJSON: () => ({ tx: true }) }
      const tx: any = { executeWithSigner: jest.fn().mockResolvedValue(fakeResp) }
      const res = await wallet820.hedera_executeTransaction(2, tx)
      expect(res).toEqual(formatJsonRpcResult(2, { tx: true }))
    })

    it('formats PrecheckStatusError correctly', async () => {
      const transactionId = TransactionId.generate(new AccountId(1))
      const status = Status.InvalidTransaction;
      const statusCode = status._code.toString();
      const err = new PrecheckStatusError({
        status,
        transactionId,
        nodeId: new AccountId(3),
        contractFunctionResult: null,
      })
      err.message = 'precheck failed'
      const tx: any = { executeWithSigner: jest.fn().mockRejectedValue(err) }
      const res = await wallet820.hedera_executeTransaction(3, tx)
      const json = err.toJSON()
      expect(res).toEqual(
        formatJsonRpcError(3, { code: 9000, message: json.message, data: statusCode }),
      )
    })

    it('returns generic error for unknown exceptions', async () => {
      const tx: any = { executeWithSigner: jest.fn().mockRejectedValue(new Error('oops')) }
      const res = await wallet820.hedera_executeTransaction(4, tx)
      expect(res).toEqual(formatJsonRpcError(4, { code: 9000, message: 'Unknown Error' }))
    })
  })

  it('hedera_signMessage returns base64 signatureMap', async () => {
    mockWallet.sign.mockResolvedValue([
      { pubKeyPrefix: new Uint8Array([1]), signature: new Uint8Array([2]) },
    ])
    const res = await wallet820.hedera_signMessage(5, 'hello')
    const decoded = proto.SignatureMap.decode(Buffer.from(res.result.signatureMap, 'base64'))
    expect(decoded.sigPair.length).toBe(1)
  })

  describe('hedera_signAndExecuteQuery', () => {
    it('returns response on success', async () => {
      const qr = { toBytes: () => new Uint8Array([1, 2, 3]) }
      const query: any = { executeWithSigner: jest.fn().mockResolvedValue(qr) }
      const res = await wallet820.hedera_signAndExecuteQuery(6, query)
      expect(res).toEqual(
        formatJsonRpcResult(6, { response: Buffer.from(qr.toBytes()).toString('base64') }),
      )
    })

    it('formats PrecheckStatusError for query', async () => {
      const transactionId = TransactionId.generate(new AccountId(1))
      const status = Status.InvalidQueryHeader
      const statusCode = status._code.toString()
      const err = new PrecheckStatusError({
        status,
        transactionId,
        nodeId: new AccountId(3),
        contractFunctionResult: null,
      })
      err.message = 'query failed'
      const query: any = { executeWithSigner: jest.fn().mockRejectedValue(err) }
      const res = await wallet820.hedera_signAndExecuteQuery(7, query)
      const json = err.toJSON()
      expect(res).toEqual(
        formatJsonRpcError(7, { code: 9000, message: json.message, data: statusCode }),
      )
    })
  })

  describe('hedera_signAndExecuteTransaction', () => {
    it('signs, executes and returns result when not frozen', async () => {
      const execResult = { toJSON: () => ({ done: true }) }
      const signed = { executeWithSigner: jest.fn().mockResolvedValue(execResult) }
      const tx: any = {
        isFrozen: () => false,
        freezeWithSigner: jest.fn(),
        signWithSigner: jest.fn().mockResolvedValue(signed),
      }
      const res = await wallet820.hedera_signAndExecuteTransaction(8, tx)
      expect(tx.freezeWithSigner).toHaveBeenCalled()
      expect(res).toEqual(formatJsonRpcResult(8, { done: true }))
    })

    it('formats PrecheckStatusError on execution', async () => {
      const transactionId = TransactionId.generate(new AccountId(1))
      const status = Status.InvalidQueryHeader
      const statusCode = status._code.toString()
      const err = new PrecheckStatusError({
        status,
        transactionId,
        nodeId: new AccountId(3),
        contractFunctionResult: null,
      })
      err.message = 'exec fail'
      const signed = { executeWithSigner: jest.fn().mockRejectedValue(err) }
      const tx: any = {
        isFrozen: () => true,
        freezeWithSigner: jest.fn(),
        signWithSigner: jest.fn().mockResolvedValue(signed),
      }
      const res = await wallet820.hedera_signAndExecuteTransaction(9, tx)
      const json = err.toJSON()
      expect(res).toEqual(
        formatJsonRpcError(9, { code: 9000, message: json.message, data: statusCode }),
      )
    })
  })

  it('hedera_signTransaction returns base64 signatureMap', async () => {
    mockWallet.sign.mockResolvedValue([
      { pubKeyPrefix: new Uint8Array([3]), signature: new Uint8Array([4]) },
    ])
    const data = new Uint8Array([10, 20])
    const res = await wallet820.hedera_signTransaction(10, data)
    const decoded = proto.SignatureMap.decode(Buffer.from(res.result.signatureMap, 'base64'))
    expect(decoded.sigPair.length).toBe(1)
  })
})
