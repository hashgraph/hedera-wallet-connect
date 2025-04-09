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
  TransactionReceiptQuery,
  TransactionReceipt,
  TransactionRecordQuery,
} from '@hashgraph/sdk'
import { proto } from '@hashgraph/proto'
import type { CoreTypes, ISignClient } from '@walletconnect/types'

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
  extensionOpen,
  Uint8ArrayToBase64String,
  Uint8ArrayToString,
  getAccountInfo,
} from '../shared'
import { DefaultLogger, ILogger, LogLevel } from '../shared/logger'
import { SessionNotFoundError } from './SessionNotFoundError'

const clients: Record<string, Client | null> = {}

export class DAppSigner implements Signer {
  private logger: ILogger
  private publicKey: Key | null

  constructor(
    private readonly accountId: AccountId,
    private readonly signClient: ISignClient,
    public readonly topic: string,
    private readonly ledgerId: LedgerId = LedgerId.MAINNET,
    public readonly extensionId?: string,
    logLevel: LogLevel = 'debug',
  ) {
    this.logger = new DefaultLogger(logLevel)
    this.publicKey = null
    // cache public key from mirror node
    this.getAccountKeyAsync()
      .then((key: Key | null) => (this.publicKey = key))
      .catch((error: Error) =>
        this.logger.error('Error when receiving a public key:', error.message),
      )
  }

  /**
   * Sets the logging level for the DAppSigner
   * @param level - The logging level to set
   */
  public setLogLevel(level: LogLevel): void {
    if (this.logger instanceof DefaultLogger) {
      this.logger.setLogLevel(level)
    }
  }

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

  request<T>(request: { method: string; params: any }): Promise<T> {
    // Avoid a wallet call if the session is no longer valid
    if (!this?.signClient?.session?.get(this.topic)) {
      this.logger.error(
        'Session no longer exists, signer will be removed. Please reconnect to the wallet.',
      )
      // Notify DAppConnector to remove this signer
      this.signClient.emit({
        topic: this.topic,
        event: {
          name: 'session_delete',
          data: { topic: this.topic },
        },
        chainId: ledgerIdToCAIPChainId(this.ledgerId),
      })
      throw new SessionNotFoundError(
        'Session no longer exists. Please reconnect to the wallet.',
      )
    }

    if (this.extensionId) extensionOpen(this.extensionId)
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
    if (this.publicKey == null) {
      throw new Error('No key was received from the mirror node')
    }
    return this.publicKey
  }

  async getAccountKeyAsync(): Promise<Key | null> {
    const accountInfo = await getAccountInfo(this.ledgerId, this.accountId.toString())
    if (!accountInfo?.key) return null
    return PublicKey.fromString(accountInfo.key.key)
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

  getMetadata(): CoreTypes.Metadata {
    return this.signClient.metadata
  }

  async sign(
    data: Uint8Array[],
    signOptions: {
      encoding?: 'utf-8' | 'base64'
    } = {
      encoding: 'utf-8',
    },
  ): Promise<SignerSignature[]> {
    try {
      const messageToSign =
        signOptions.encoding === 'base64'
          ? Uint8ArrayToBase64String(data[0])
          : Uint8ArrayToString(data[0])

      const { signatureMap } = await this.request<SignTransactionResult['result']>({
        method: HederaJsonRpcMethod.SignMessage,
        params: {
          signerAccountId: this._signerAccountId,
          message: messageToSign,
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

      this.logger.debug('Data signed successfully')
      return [signerSignature]
    } catch (error) {
      this.logger.error('Error signing data:', error)
      throw error
    }
  }

  async checkTransaction<T extends Transaction>(transaction: T): Promise<T> {
    throw new Error('Method not implemented.')
  }

  async populateTransaction<T extends Transaction>(transaction: T): Promise<T> {
    return transaction
      .setTransactionId(TransactionId.generate(this.getAccountId()))
  }

  /**
   * Prepares a transaction object for signing using a single node account id.
   * If the transaction object does not already have a node account id,
   * generate a random node account id using the Hedera SDK client
   *
   * @param transaction - Any instance of a class that extends `Transaction`
   * @returns transaction - `Transaction` object with signature
   */
  async signTransaction<T extends Transaction>(transaction: T): Promise<T> {
    const transactionBody = transactionToTransactionBody(transaction)
    if (!transactionBody) throw new Error('Failed to serialize transaction body')
    const transactionBodyBase64 = transactionBodyToBase64String(transactionBody)

    const { signatureMap } = await this.request<SignTransactionResult['result']>({
      method: HederaJsonRpcMethod.SignTransaction,
      params: {
        signerAccountId: this._signerAccountId,
        transactionBody: transactionBodyBase64,
      },
    })

    const sigMap = base64StringToSignatureMap(signatureMap)
    const bodyBytes = base64StringToUint8Array(transactionBodyBase64)
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
      const requestToBytes = request.toBytes()
      this.logger.debug('Creating transaction from bytes', requestToBytes, request)

      const transaction = Transaction.fromBytes(requestToBytes)
      this.logger.debug('Executing transaction request', transaction)

      const result = await this.request<SignAndExecuteTransactionResult['result']>({
        method: HederaJsonRpcMethod.SignAndExecuteTransaction,
        params: {
          signerAccountId: this._signerAccountId,
          transactionList: transactionToBase64String(transaction),
        },
      })

      this.logger.debug('Transaction request completed successfully')
      return { result: TransactionResponse.fromJSON(result) as OutputT }
    } catch (error) {
      this.logger.error('Error executing transaction request:', error)

      return { error }
    }
  }

  private async _parseQueryResponse(
    query: Query<any>,
    base64EncodedQueryResponse: string,
  ): Promise<any> {
    if (query instanceof AccountRecordsQuery) {
      const base64EncodedQueryResponseSplit = base64EncodedQueryResponse.split(',')
      const data = base64EncodedQueryResponseSplit.map((o) => base64StringToUint8Array(o))
      return data.map((o) => TransactionRecord.fromBytes(o))
    }

    const data = base64StringToUint8Array(base64EncodedQueryResponse)
    if (query instanceof AccountBalanceQuery) {
      return AccountBalance.fromBytes(data)
    } else if (query instanceof AccountInfoQuery) {
      return AccountInfo.fromBytes(data)
    } else if (query instanceof TransactionReceiptQuery) {
      return TransactionReceipt.fromBytes(data)
    } else if (query instanceof TransactionRecordQuery) {
      return TransactionRecord.fromBytes(data)
    } else {
      throw new Error('Unsupported query type')
    }
  }

  /**
   * Executes a free receipt query without signing a transaction.
   * Enables the DApp to fetch the receipt of a transaction without making a new request
   * to the wallet.
   * @param request - The query to execute
   * @returns The result of the query
   */
  private async executeReceiptQueryFromRequest(request: Executable<any, any, any>) {
    try {
      const isMainnet = this.ledgerId === LedgerId.MAINNET
      const client = isMainnet ? Client.forMainnet() : Client.forTestnet()

      const receipt = TransactionReceiptQuery.fromBytes(request.toBytes())
      const result = await receipt.execute(client)
      return { result }
    } catch (error) {
      return { error }
    }
  }

  private async _tryExecuteQueryRequest<RequestT, ResponseT, OutputT>(
    request: Executable<RequestT, ResponseT, OutputT>,
  ): Promise<{
    result?: OutputT
    error?: any
  }> {
    try {
      const isReceiptQuery = request instanceof TransactionReceiptQuery

      if (isReceiptQuery) {
        this.logger.debug('Attempting to execute free receipt query', request)
        const result = await this.executeReceiptQueryFromRequest(request)
        if (!result?.error) {
          return { result: result.result as OutputT }
        }
        this.logger.error(
          'Error executing free receipt query. Sending to wallet.',
          result.error,
        )
      }

      /**
       * Note, should we be converting these to specific query types?
       * Left alone to avoid changing the API for other requests.
       */
      const query = isReceiptQuery
        ? TransactionReceiptQuery.fromBytes(request.toBytes())
        : Query.fromBytes(request.toBytes())

      this.logger.debug(
        'Executing query request',
        query,
        queryToBase64String(query),
        isReceiptQuery,
      )

      const result = await this.request<SignAndExecuteQueryResult['result']>({
        method: HederaJsonRpcMethod.SignAndExecuteQuery,
        params: {
          signerAccountId: this._signerAccountId,
          query: queryToBase64String(query),
        },
      })

      this.logger.debug('Query request completed successfully', result)

      return { result: this._parseQueryResponse(query, result.response) as OutputT }
    } catch (error) {
      this.logger.error('Error executing query request:', error)
      return { error }
    }
  }

  async call<RequestT, ResponseT, OutputT>(
    request: Executable<RequestT, ResponseT, OutputT>,
  ): Promise<OutputT> {
    const isReceiptQuery = request instanceof TransactionReceiptQuery

    let txResult: { result?: OutputT; error?: any } | undefined = undefined

    // a receipt query is a free query and we should not execute a transaction.
    if (!isReceiptQuery) {
      txResult = await this._tryExecuteTransactionRequest(request)
      if (txResult.result) {
        return txResult.result
      }
    }

    const queryResult = await this._tryExecuteQueryRequest(request)
    if (queryResult.result) {
      return queryResult.result
    }

    if (isReceiptQuery) {
      throw new Error(
        'Error executing receipt query: \n' +
          JSON.stringify({
            queryError: {
              name: queryResult.error?.name,
              message: queryResult.error?.message,
              stack: queryResult.error?.stack,
            },
          }),
      )
    }

    throw new Error(
      'Error executing transaction or query: \n' +
        JSON.stringify(
          {
            txError: {
              name: txResult?.error?.name,
              message: txResult?.error?.message,
              stack: txResult?.error?.stack,
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
