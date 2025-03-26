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

import { AccountInfo, AccountInfoQuery } from '@hashgraph/sdk'
import {
  HederaChainId,
  SignAndExecuteTransactionResponse,
  Wallet,
  base64StringToUint8Array,
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
  describe('signAndExecuteQuery', () => {
    it('should sign and execute query, returning the query response', async () => {
      const wallet = await Wallet.create(projectId, walletMetadata)

      const hederaWallet = wallet!.getHederaWallet(
        HederaChainId.Testnet,
        testUserAccountId.toString(),
        testPrivateKeyECDSA,
      )
      const query = new AccountInfoQuery().setAccountId(testUserAccountId)
      const respondSessionRequestSpy = jest.spyOn(wallet, 'respondSessionRequest')

      const signerCallMock = jest.spyOn(query, 'executeWithSigner')
      const toBytes = () => base64StringToUint8Array(btoa('Hello World!'))
      signerCallMock.mockImplementation(async () => ({ toBytes }) as AccountInfo)

      try {
        await wallet.hedera_signAndExecuteQuery(requestId, requestTopic, query, hederaWallet)
      } catch (err) {}

      const mockResponse: SignAndExecuteTransactionResponse = useJsonFixture(
        'methods/signAndExecuteQuerySuccess',
      )

      expect(respondSessionRequestSpy).toHaveBeenCalledWith(mockResponse)
    }, 15_000)
  })
})
