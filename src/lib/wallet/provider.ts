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
  Client,
  AccountBalanceQuery,
  AccountInfoQuery,
  AccountRecordsQuery,
  TransactionReceiptQuery,
  type AccountId,
  type Executable,
  type Provider as HederaWalletProvider,
  type TransactionId,
  type TransactionResponse,
  type TransactionReceipt,
} from '@hashgraph/sdk'

export default class Provider implements HederaWalletProvider {
  constructor(private client: Client) {}

  static fromClient(client: Client) {
    return new Provider(client)
  }

  getLedgerId() {
    return this.client.ledgerId
  }

  getNetwork() {
    return this.client.network
  }

  getMirrorNetwork() {
    return this.client.mirrorNetwork
  }

  getAccountBalance(accountId: AccountId | string) {
    return new AccountBalanceQuery().setAccountId(accountId).execute(this.client)
  }

  getAccountInfo(accountId: AccountId | string) {
    return new AccountInfoQuery().setAccountId(accountId).execute(this.client)
  }

  getAccountRecords(accountId: string | AccountId) {
    return new AccountRecordsQuery().setAccountId(accountId).execute(this.client)
  }

  getTransactionReceipt(transactionId: TransactionId | string) {
    return new TransactionReceiptQuery().setTransactionId(transactionId).execute(this.client)
  }

  waitForReceipt(response: TransactionResponse): Promise<TransactionReceipt> {
    return new TransactionReceiptQuery()
      .setNodeAccountIds([response.nodeId])
      .setTransactionId(response.transactionId)
      .execute(this.client)
  }

  call<Request, Response, Output>(
    request: Executable<Request, Response, Output>,
  ): Promise<Output> {
    return request.execute(this.client)
  }
}
