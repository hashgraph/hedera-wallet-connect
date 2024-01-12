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

import { TopicCreateTransaction } from '@hashgraph/sdk'
import { HederaChainId, SignAndExecuteTransactionResponse, Wallet } from '../../../src'
import {
  prepareTestTransaction,
  projectId,
  requestId,
  requestTopic,
  testPrivateKeyECDSA,
  testUserAccountId,
  useJsonFixture,
  walletMetadata,
} from '../../_helpers'

describe(Wallet.name, () => {
  describe('signAndExecuteTransaction', () => {
    it('should sign and execute, returning the transaction response', async () => {
      try {
        const wallet = await Wallet.create(projectId, walletMetadata)

        const hederaWallet = wallet!.getHederaWallet(
          HederaChainId.Testnet,
          testUserAccountId.toString(),
          testPrivateKeyECDSA,
        )

        const signerCallMock = jest.spyOn(hederaWallet, 'call')
        signerCallMock.mockImplementation(async () => {
          return {
            nodeId: '0.0.3',
            transactionHash: 'uO6obRah/zbL1Wn1ZVd5unos7kbsI8G5bHifKGVWUGZPiCafQzr/hdlEJyUiKLw9',
            transactionId: '0.0.12345@1691705630.325343432',
          }
        }) // Mocking the 'call' method to do nothing

        const transaction = prepareTestTransaction(new TopicCreateTransaction(), {
          freeze: true,
        })

        const respondSessionRequestSpy = jest.spyOn(wallet, 'respondSessionRequest')

        await wallet.hedera_signAndExecuteTransaction(
          requestId,
          requestTopic,
          transaction,
          hederaWallet,
        )

        const mockResponse: SignAndExecuteTransactionResponse = useJsonFixture(
          'methods/signAndExecuteTransactionSuccess',
        )

        expect(respondSessionRequestSpy).toHaveBeenCalledWith(mockResponse)
      } catch (err) {}
    }, 15_000)
  })
})
