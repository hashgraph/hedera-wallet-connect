/*
 *
 * Hedera Wallet Connect
 *
 * Copyright (C) 2025 Hedera Hashgraph, LLC
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

import { Client, Wallet as HederaWallet, AccountId, PrivateKey } from '@hiero-ledger/sdk'
import { HIP820Wallet, HederaChainId } from '../../../../src'
import Provider from '../../../../src/lib/wallet/provider'
import { testPrivateKeyECDSA, testUserAccountId } from '../../../_helpers'

describe('HIP820Wallet', () => {
  describe('init', () => {
    const chainId = HederaChainId.Testnet
    const accountId = testUserAccountId.toString()
    const privateKey = PrivateKey.fromStringECDSA(testPrivateKeyECDSA)

    it('should initialize with default provider', () => {
      const wallet = HIP820Wallet.init({ chainId, accountId, privateKey })

      expect(wallet).toBeInstanceOf(HIP820Wallet)
      expect(wallet.getHederaWallet()).toBeInstanceOf(HederaWallet)
    })

    it('should initialize with custom provider', () => {
      const client = Client.forTestnet()
      const customProvider = new Provider(client)
      const wallet = HIP820Wallet.init({
        chainId,
        accountId,
        privateKey,
        _provider: customProvider,
      })

      expect(wallet.getHederaWallet().provider).toBe(customProvider)
    })

    it('should create wallet with correct network', () => {
      const testnetWallet = HIP820Wallet.init({
        chainId: HederaChainId.Testnet,
        accountId,
        privateKey,
      })
      const mainnetWallet = HIP820Wallet.init({
        chainId: HederaChainId.Mainnet,
        accountId,
        privateKey,
      })

      expect(testnetWallet.getHederaWallet().provider?.getLedgerId()?.isTestnet()).toBeTruthy()
      expect(mainnetWallet.getHederaWallet().provider?.getLedgerId()?.isMainnet()).toBeTruthy()
    })
  })
})
