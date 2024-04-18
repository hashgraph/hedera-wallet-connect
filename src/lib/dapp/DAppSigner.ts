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
  Signer,
  AccountBalance,
  AccountId,
  AccountInfo,
  Executable,
  Key,
  LedgerId,
  SignerSignature,
  Transaction,
  TransactionRecord,
  Client,
  PublicKey,
  TransactionId,
  TransactionResponse,
  Query,
  AccountRecordsQuery,
  AccountInfoQuery,
  AccountBalanceQuery,
} from '@hashgraph/sdk'
import { proto } from '@hashgraph/proto'
import type { ISignClient } from '@walletconnect/types'

import {
  HederaJsonRpcMethod,
  SignAndExecuteQueryResult,
  SignAndExecuteTransactionResult,
  SignTransactionResult,
  base64StringToSignatureMap,
  base64StringToUint8Array,
  ledgerIdToCAIPChainId,
  queryToBase64String,
  transactionBodyToBase64String,
  transactionToBase64String,
  transactionToTransactionBody,
} from '../shared'

const clients: Record<string, Client | null> = {}

export class DAppSigner implements Signer {
  constructor(
    private readonly accountId: AccountId,
    private readonly signClient: ISignClient,
    public readonly topic: string,
    private readonly ledgerId: LedgerId = LedgerId.MAINNET,
  ) {}

  private _getHederaClient() {
    const ledgerIdString = this.ledgerId.toString()
    if (!clients[ledgerIdString]) {
      clients[ledgerIdString] = Client.forName(ledgerIdString)
    }

    return clients[ledgerIdString]!
  }

  private get _signerAccountId() {
    return `${ledgerIdToCAIPChainId(this.ledgerId)}:${this.accountId.toString()}`
  }

  private _getRandomNodes(numberOfNodes: number) {
    const allNodes = Object.values(this._getHederaClient().network).map((o) =>
      typeof o === 'string' ? AccountId.fromString(o) : o,
    )

    // shuffle nodes
    for (let i = allNodes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[allNodes[i], allNodes[j]] = [allNodes[j], allNodes[i]]
    }

    return allNodes.slice(0, numberOfNodes)
  }

  request<T>(request: { method: string; params: any }): Promise<T> {
    return this.signClient.request<T>({
      topic: this.topic,
      request,
      chainId: ledgerIdToCAIPChainId(this.ledgerId),
    })
  }

  getAccountId(): AccountId {
    return this.accountId
  }

  getAccountKey(): Key {
    throw new Error('Method not implemented.')
  }

  getLedgerId(): LedgerId {
    return this.ledgerId
  }

  getNetwork(): { [key: string]: string | AccountId } {
    return this._getHederaClient().network
  }

  getMirrorNetwork(): string[] {
    return this._getHederaClient().mirrorNetwork
  }

  getAccountBalance(): Promise<AccountBalance> {
    return this.call(new AccountBalanceQuery().setAccountId(this.accountId))
  }

  getAccountInfo(): Promise<AccountInfo> {
    return this.call(new AccountInfoQuery().setAccountId(this.accountId))
  }

  getAccountRecords(): Promise<TransactionRecord[]> {
    return this.call(new AccountRecordsQuery().setAccountId(this.accountId))
  }

  async sign(
    data: Uint8Array[],
    signOptions?: Record<string, any>,
  ): Promise<SignerSignature[]> {
    const { signatureMap } = await this.request<SignTransactionResult['result']>({
      method: HederaJsonRpcMethod.SignMessage,
      params: {
        signerAccountId: this._signerAccountId,
        message: Buffer.from(data[0]).toString(),
      },
    })

    const sigmap = base64StringToSignatureMap(signatureMap)

    const signerSignature = new SignerSignature({
      accountId: this.getAccountId(),
      publicKey: PublicKey.fromBytes(sigmap.sigPair[0].pubKeyPrefix as Uint8Array),
      signature:
        (sigmap.sigPair[0].ed25519 as Uint8Array) ||
        (sigmap.sigPair[0].ECDSASecp256k1 as Uint8Array),
    })

    return [signerSignature]
  }

  async checkTransaction<T extends Transaction>(transaction: T): Promise<T> {
    throw new Error('Method not implemented.')
  }

  async populateTransaction<T extends Transaction>(transaction: T): Promise<T> {
    return transaction
      .setNodeAccountIds(this._getRandomNodes(10)) // allow retrying on up to 10 nodes
      .setTransactionId(TransactionId.generate(this.getAccountId()))
  }

  async signTransaction<T extends Transaction>(transaction: T): Promise<T> {
    const transactionBody = transactionToTransactionBody(
      transaction,
      this._getRandomNodes(1)[0],
    )
    const transactionBodyBase64 = transactionBodyToBase64String(transactionBody)

    const { signatureMap } = await this.request<SignTransactionResult['result']>({
      method: HederaJsonRpcMethod.SignTransaction,
      params: {
        signerAccountId: this._signerAccountId,
        transactionBody: transactionBodyBase64,
      },
    })

    const sigMap = base64StringToSignatureMap(signatureMap)
    const bodyBytes = Buffer.from(transactionBody, 'base64')
    const bytes = proto.Transaction.encode({ bodyBytes, sigMap }).finish()
    return Transaction.fromBytes(bytes) as T
  }

  private async _tryExecuteTransactionRequest<RequestT, ResponseT, OutputT>(
    request: Executable<RequestT, ResponseT, OutputT>,
  ): Promise<{
    result?: OutputT
    error?: any
  }> {
    try {
      const transaction = Transaction.fromBytes(request.toBytes())
      const result = await this.request<SignAndExecuteTransactionResult['result']>({
        method: HederaJsonRpcMethod.SignAndExecuteTransaction,
        params: {
          signerAccountId: this._signerAccountId,
          transactionList: transactionToBase64String(transaction),
        },
      })

      return { result: TransactionResponse.fromJSON(result) as OutputT }
    } catch (error) {
      return { error }
    }
  }

  private async _parseQueryResponse(
    query: Query<any>,
    base64EncodedQueryResponse: string,
  ): Promise<any> {
    const data = base64StringToUint8Array(base64EncodedQueryResponse)
    if (query instanceof AccountBalanceQuery) {
      return proto.CryptoGetAccountBalanceQuery.decode(data)
    } else if (query instanceof AccountInfoQuery) {
      return proto.CryptoGetInfoQuery.decode(data)
    } else if (query instanceof AccountRecordsQuery) {
      return proto.CryptoGetAccountRecordsResponse.decode(data)
    } else {
      throw new Error('Unsupported query type')
    }
  }

  private async _tryExecuteQueryRequest<RequestT, ResponseT, OutputT>(
    request: Executable<RequestT, ResponseT, OutputT>,
  ): Promise<{
    result?: OutputT
    error?: any
  }> {
    try {
      const query = Query.fromBytes(request.toBytes())

      const result = await this.request<SignAndExecuteQueryResult['result']>({
        method: HederaJsonRpcMethod.SignAndExecuteQuery,
        params: {
          signerAccountId: this._signerAccountId,
          query: queryToBase64String(query),
        },
      })

      return { result: this._parseQueryResponse(query, result.response) as OutputT }
    } catch (error) {
      return { error }
    }
  }

  async call<RequestT, ResponseT, OutputT>(
    request: Executable<RequestT, ResponseT, OutputT>,
  ): Promise<OutputT> {
    const txResult = await this._tryExecuteTransactionRequest(request)
    if (txResult.result) {
      return txResult.result
    }

    const queryResult = await this._tryExecuteQueryRequest(request)
    if (queryResult.result) {
      return queryResult.result
    }

    // TODO: make this error more usable
    throw new Error(
      'Error executing transaction or query: \n' +
        JSON.stringify(
          {
            txError: {
              name: txResult.error?.name,
              message: txResult.error?.message,
              stack: txResult.error?.stack,
            },
            queryError: {
              name: queryResult.error?.name,
              message: queryResult.error?.message,
              stack: queryResult.error?.stack,
            },
          },
          null,
          2,
        ),
    )
  }
}
