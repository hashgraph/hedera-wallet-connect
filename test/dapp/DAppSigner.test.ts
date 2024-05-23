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
  AccountBalanceQuery,
  AccountCreateTransaction,
  AccountId,
  AccountInfoQuery,
  AccountRecordsQuery,
  AccountUpdateTransaction,
  LedgerId,
  PrivateKey,
  TokenAssociateTransaction,
  TokenCreateTransaction,
  TopicCreateTransaction,
  TransactionId,
} from '@hashgraph/sdk'
import { proto } from '@hashgraph/proto'
import {
  DAppConnector,
  HederaJsonRpcMethod,
  SignAndExecuteTransactionParams,
  transactionToBase64String,
  DAppSigner,
  SignAndExecuteTransactionResult,
  ExecuteTransactionResult,
  SignAndExecuteQueryResult,
  SignAndExecuteQueryParams,
  Uint8ArrayToBase64String,
  base64StringToQuery,
} from '../../src'
import {
  projectId,
  dAppMetadata,
  useJsonFixture,
  prepareTestTransaction,
  prepareTestQuery,
} from '../_helpers'
import { SessionTypes } from '@walletconnect/types'

describe('DAppSigner', () => {
  let connector: DAppConnector
  const fakeSession = useJsonFixture('fakeSession') as SessionTypes.Struct

  beforeEach(() => {
    connector = new DAppConnector(dAppMetadata, LedgerId.TESTNET, projectId)
  })

  afterEach(() => {
    global.gc && global.gc()
  })

  describe(DAppSigner.prototype.call, () => {
    let signerRequestSpy: jest.SpyInstance
    let signer: DAppSigner

    beforeEach(async () => {
      // @ts-ignore
      connector.signers = connector.createSigners(fakeSession)
      signer = connector.signers[0]

      signerRequestSpy = jest.spyOn(signer, 'request')
      signerRequestSpy.mockImplementation((request: { method: string; params: any }) => {
        const { method } = request
        if (method === HederaJsonRpcMethod.SignAndExecuteTransaction) {
          const response: SignAndExecuteTransactionResult['result'] = {
            transactionId: TransactionId.generate('0.0.999').toString(),
            nodeId: '0.0.3',
            transactionHash: '0x',
          }
          return Promise.resolve(response)
        } else if (method === HederaJsonRpcMethod.ExecuteTransaction) {
          const response: ExecuteTransactionResult['result'] = {
            transactionId: TransactionId.generate('0.0.999').toString(),
            nodeId: '0.0.3',
            transactionHash: '0x',
          }
          return Promise.resolve(response)
        } else if (method === HederaJsonRpcMethod.SignAndExecuteQuery) {
          const query = base64StringToQuery(request.params.query)
          let queryResponse = 'ERROR: Unsupported query type'
          if (query instanceof AccountBalanceQuery) {
            queryResponse = Uint8ArrayToBase64String(
              proto.CryptoGetAccountBalanceResponse.encode({
                balance: 0,
              }).finish(),
            )
          } else if (query instanceof AccountInfoQuery) {
            queryResponse = Uint8ArrayToBase64String(
              proto.CryptoGetInfoResponse.AccountInfo.encode({
                accountID: {
                  shardNum: 0,
                  realmNum: 0,
                  accountNum: 3,
                },
                contractAccountID: AccountId.fromString('0.0.3').toSolidityAddress(),
                key: {
                  ed25519: PrivateKey.generate().publicKey.toBytes(),
                },
                expirationTime: { seconds: 0, nanos: 0 },
              }).finish(),
            )
          } else if (query instanceof AccountRecordsQuery) {
            queryResponse = Uint8ArrayToBase64String(
              proto.TransactionGetRecordResponse.encode({
                transactionRecord: {
                  alias: proto.Key.encode(
                    PrivateKey.generate().publicKey._toProtobufKey(),
                  ).finish(),
                  receipt: {
                    status: proto.ResponseCodeEnum.OK,
                    accountID: {
                      shardNum: 0,
                      realmNum: 0,
                      accountNum: 3,
                    },
                  },
                  consensusTimestamp: { seconds: 0, nanos: 0 },
                  transactionID: {
                    accountID: {
                      shardNum: 0,
                      realmNum: 0,
                      accountNum: 3,
                    },
                    transactionValidStart: { seconds: 0, nanos: 0 },
                    nonce: 0,
                  },
                },
              }).finish(),
            )
          }
          const response: SignAndExecuteQueryResult['result'] = {
            response: queryResponse,
          }
          return Promise.resolve(response)
        }
      })
    })

    afterEach(() => {
      signerRequestSpy.mockRestore()
    })

    it.each([
      { name: AccountCreateTransaction.name, ExecutableType: AccountCreateTransaction },
      { name: AccountUpdateTransaction.name, ExecutableType: AccountUpdateTransaction },
      { name: TopicCreateTransaction.name, ExecutableType: TopicCreateTransaction },
      { name: TokenAssociateTransaction.name, ExecutableType: TokenAssociateTransaction },
      { name: TokenCreateTransaction.name, ExecutableType: TokenCreateTransaction },
    ])('can execute $name transaction', async ({ name, ExecutableType }) => {
      const transaction = prepareTestTransaction(new ExecutableType(), { freeze: true })

      const params: SignAndExecuteTransactionParams = {
        signerAccountId: 'hedera:testnet:' + signer.getAccountId().toString(),
        transactionList: transactionToBase64String(transaction),
      }
      await signer.call(transaction)

      expect(signerRequestSpy).toHaveBeenCalled()
      expect(signerRequestSpy).toHaveBeenCalledTimes(1)
      expect(signerRequestSpy).toHaveBeenCalledWith({
        method: HederaJsonRpcMethod.SignAndExecuteTransaction,
        params,
      })
    })

    it.each([
      { name: AccountBalanceQuery.name, ExecutableType: AccountBalanceQuery },
      { name: AccountInfoQuery.name, ExecutableType: AccountInfoQuery },
      { name: AccountRecordsQuery.name, ExecutableType: AccountRecordsQuery },
    ])('can execute $name query', async ({ name, ExecutableType }) => {
      const query = prepareTestQuery<any, any>(new ExecutableType())

      const params: SignAndExecuteQueryParams = {
        signerAccountId: 'hedera:testnet:' + signer.getAccountId().toString(),
        query: Uint8ArrayToBase64String(query.toBytes()),
      }
      await signer.call(query)

      expect(signerRequestSpy).toHaveBeenCalled()
      expect(signerRequestSpy).toHaveBeenCalledTimes(1)
      expect(signerRequestSpy).toHaveBeenCalledWith({
        method: HederaJsonRpcMethod.SignAndExecuteQuery,
        params,
      })
    })
  })
})
