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
import { Buffer } from 'buffer'
import { proto } from '@hashgraph/proto'
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
} from '@hashgraph/sdk'
import type { ISignClient } from '@walletconnect/types'

import {
  ExecuteTransactionResult,
  HederaJsonRpcMethod,
  SignAndExecuteQueryResult,
  SignAndExecuteTransactionResult,
  SignMessageResult,
  SignTransactionResult,
  base64StringToSignatureMap,
  ledgerIdToCAIPChainId,
  transactionBodyToBase64String,
  transactionToBase64String,
  transactionToTransactionBody,
} from '../shared'

export class DAppSigner implements Signer {
  static signClient: ISignClient
  public signerAccountId: string

  /**
   * These are the node accounts that will be utilized for signing transactions.
   */
  public nodesAccountIds: AccountId[] = []

  constructor(
    private readonly accountId: AccountId,
    public readonly topic: string,
    private readonly ledgerId: LedgerId = LedgerId.MAINNET,
  ) {
    this.signerAccountId = `${ledgerIdToCAIPChainId(ledgerId)}:${accountId.toString()}`
    this.nodesAccountIds = [AccountId.fromString('0.0.3')]
  }

  static initialize(signClient: ISignClient) {
    this.signClient = signClient
  }

  /**
   * Set the nodes to sign transactions that require a single signature.
   *
   * @param {AccountId[]} nodesAccountIds
   */
  setNodes(nodesAccountIds: AccountId[]): void {
    this.nodesAccountIds = nodesAccountIds
  }

  request<T>(request: { method: string; params: any }): Promise<T> {
    return DAppSigner.signClient.request<T>({
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
    throw new Error('Method not implemented.')
  }

  getMirrorNetwork(): string[] {
    throw new Error('Method not implemented.')
  }

  getAccountBalance(): Promise<AccountBalance> {
    throw new Error('Method not implemented.')
  }

  getAccountInfo(): Promise<AccountInfo> {
    throw new Error('Method not implemented.')
  }

  getAccountRecords(): Promise<TransactionRecord[]> {
    throw new Error('Method not implemented.')
  }

  async sign(
    data: Uint8Array[],
    signOptions?: Record<string, any>,
  ): Promise<SignerSignature[]> {
    throw new Error('Method not implemented.')
  }

  async signTransaction<T extends Transaction>(transaction: T) {
    const randomNode =
      this.nodesAccountIds[Math.floor(Math.random() * this.nodesAccountIds.length)]
    const transactionBody = transactionBodyToBase64String(
      transactionToTransactionBody(transaction, randomNode),
    )

    const params = {
      signerAccountId: this.signerAccountId,
      transactionBody,
    }
    const result = await this.request<SignTransactionResult['result']>({
      method: HederaJsonRpcMethod.SignTransaction,
      params,
    })
    const sigMap = base64StringToSignatureMap(result.signatureMap)
    const bodyBytes = Buffer.from(transactionBody, 'base64')
    const bytes = proto.Transaction.encode({ bodyBytes, sigMap }).finish()
    return Transaction.fromBytes(bytes) as T
  }

  async checkTransaction<T extends Transaction>(transaction: T): Promise<T> {
    throw new Error('Method not implemented.')
  }

  async populateTransaction<T extends Transaction>(transaction: T): Promise<T> {
    throw new Error('Method not implemented.')
  }

  async call<RequestT, ResponseT, OutputT>(
    request: Executable<RequestT, ResponseT, OutputT>,
  ): Promise<OutputT> {
    throw new Error('Method not implemented.')
  }

  /*
   *  Extra methods
   */

  async executeTransaction<T extends Transaction>(transaction: T) {
    return this.request<ExecuteTransactionResult['result']>({
      method: HederaJsonRpcMethod.ExecuteTransaction,
      params: { transactionList: transactionToBase64String(transaction) },
    })
  }

  async signMessage(message: string) {
    const params = {
      signerAccountId: this.signerAccountId,
      message,
    }
    return this.request<SignMessageResult['result']>({
      method: HederaJsonRpcMethod.SignMessage,
      params,
    })
  }

  async signAndExecuteQuery(query: string) {
    const params = {
      signerAccountId: this.signerAccountId,
      query,
    }
    return this.request<SignAndExecuteQueryResult['result']>({
      method: HederaJsonRpcMethod.SignAndExecuteQuery,
      params,
    })
  }

  async signAndExecuteTransaction<T extends Transaction>(transaction: T) {
    return this.request<SignAndExecuteTransactionResult['result']>({
      method: HederaJsonRpcMethod.SignAndExecuteTransaction,
      params: {
        signerAccountId: this.signerAccountId,
        transactionList: transactionToBase64String(transaction),
      },
    })
  }
}
