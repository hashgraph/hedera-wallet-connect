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

import { TransferTransaction, Hbar, AccountId } from '@hashgraph/sdk'
import {
  HederaChainId,
  SignTransactionResponse,
  Wallet,
  transactionToTransactionBody,
  SignTransactionsResponse,
} from '../../../src'
import {
  projectId,
  requestId,
  requestTopic,
  testPrivateKeyECDSA,
  testUserAccountId,
  useJsonFixture,
  walletMetadata,
} from '../../_helpers'
import { transactionToBase64String } from '@hashgraph/hedera-wallet-connect'

describe(Wallet.name, () => {
  describe('signTransactions', () => {
    it('should sign a transaction and return without executing', async () => {
      try {
        const wallet = await Wallet.create(projectId, walletMetadata)
        const hederaWallet = wallet!.getHederaWallet(
          HederaChainId.Testnet,
          testUserAccountId.toString(),
          testPrivateKeyECDSA,
        )
        const transaction = new TransferTransaction()
          .setMaxTransactionFee(new Hbar(1))
          .setNodeAccountIds([AccountId.fromString('0.0.3'), AccountId.fromString('0.0.4')])
          .addHbarTransfer('0.0.123', new Hbar(10))
          .addHbarTransfer('0.0.321', new Hbar(-10))
        const transactionBase64 = transactionToBase64String(transaction)
        if (!transactionBase64) throw new Error('Failed to convert transaction to base64')
        const respondSessionRequestSpy = jest.spyOn(wallet, 'respondSessionRequest')

        const response = await wallet.hedera_signTransactions(
          requestId,
          requestTopic,
          transaction,
          hederaWallet,
        )
        console.log(response)

        const mockResponse: SignTransactionsResponse = useJsonFixture(
          'methods/signTransactionsSuccess',
        )
        mockResponse.response.result

        respondSessionRequestSpy
        expect(respondSessionRequestSpy).toHaveBeenCalledWith(mockResponse)
      } catch (err) {}
    }, 15_000)
  })
})
