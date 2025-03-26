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

import { GetNodeAddresesResponse, HederaChainId, Wallet } from '../../../src'
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
  describe('getNodeAddresses', () => {
    it('should return array of nodes addresses', async () => {
      const wallet = await Wallet.create(projectId, walletMetadata)

      const hederaWallet = wallet!.getHederaWallet(
        HederaChainId.Testnet,
        testUserAccountId.toString(),
        testPrivateKeyECDSA,
      )

      const respondSessionRequestSpy = jest.spyOn(wallet, 'respondSessionRequest')

      try {
        await wallet.hedera_getNodeAddresses(requestId, requestTopic, null, hederaWallet)
      } catch (err) {}

      const mockResponse: GetNodeAddresesResponse = useJsonFixture(
        'methods/getNodeAddressesSuccess',
      )

      const callArguments = respondSessionRequestSpy.mock.calls[0][0]
      const response = callArguments as GetNodeAddresesResponse

      response.response.result.nodes.sort()
      mockResponse.response.result.nodes.sort()

      expect(response).toEqual(mockResponse)
    }, 15_000)
  })
})
