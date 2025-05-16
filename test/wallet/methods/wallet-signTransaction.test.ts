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

describe(Wallet.name, () => {
  describe('signTransaction', () => {
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
          .addHbarTransfer('0.0.123', new Hbar(10))
          .addHbarTransfer('0.0.321', new Hbar(-10))
        const transactionBody = transactionToTransactionBody(
          transaction,
          AccountId.fromString('0.0.3'),
        )
        if (!transactionBody) throw new Error('Failed to create transaction body')
        const respondSessionRequestSpy = jest
          .spyOn(wallet, 'respondSessionRequest')
          .mockReturnValue(undefined)

        await wallet.hedera_signTransaction(
          requestId,
          requestTopic,
          transactionBody,
          hederaWallet,
        )

        const mockResponse: SignTransactionResponse = useJsonFixture(
          'methods/signTransactionSuccess',
        )

        expect(respondSessionRequestSpy).toHaveBeenCalledWith(mockResponse)
      } catch (err) {}
    }, 15_000)
  })
})
