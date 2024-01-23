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

import { Wallet as HederaWallet, LedgerId } from '@hashgraph/sdk'
import { HederaChainId, Wallet } from '../../src'
import {
  defaultAccountNumber,
  projectId,
  testPrivateKeyECDSA,
  walletMetadata,
} from '../_helpers'

describe(Wallet.name, () => {
  describe('create', () => {
    let wallet: Wallet

    beforeAll(async () => {
      wallet = await Wallet.create(projectId, walletMetadata)
    })

    it('should create Wallet instance with a projectId and walletMetadata', async () => {
      expect(wallet).toBeInstanceOf(Wallet)
      expect(wallet.metadata).toBe(walletMetadata)
      expect(wallet.core.projectId).toBe(projectId)
    })

    describe('getHederaWallet', () => {
      // [HederaChainId, accountId, LedgerId]
      const testCases: [HederaChainId, string | number, LedgerId][] = [
        [HederaChainId.Mainnet, defaultAccountNumber, LedgerId.MAINNET],
        [HederaChainId.Previewnet, defaultAccountNumber, LedgerId.PREVIEWNET],
        [HederaChainId.Testnet, defaultAccountNumber, LedgerId.TESTNET],
        [HederaChainId.Mainnet, `0.0.${defaultAccountNumber}`, LedgerId.MAINNET],
        [HederaChainId.Previewnet, `0.0.${defaultAccountNumber}`, LedgerId.PREVIEWNET],
        [HederaChainId.Testnet, `0.0.${defaultAccountNumber}`, LedgerId.TESTNET],
      ]
      test.each(testCases)(
        'it should initialize HederaWallet with %p chainId and %p accountId',
        async (chainId, accountId, ledgerId) => {
          const hederaWallet = wallet!.getHederaWallet(
            chainId,
            accountId.toString(),
            testPrivateKeyECDSA,
          )

          expect(wallet).toBeInstanceOf(Wallet)
          expect(hederaWallet).toBeInstanceOf(HederaWallet)
          expect(hederaWallet.accountId.toString()).toBe(`0.0.${defaultAccountNumber}`)
          expect(hederaWallet.provider!.getLedgerId()).toBe(ledgerId)
        },
      )
    })
  })
})
