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


import { Client, AccountId, PrivateKey } from '@hashgraph/sdk'

import { HederaChainId, HIP820Wallet } from '../../../../src'
import Provider from '../../../../src/lib/wallet/provider'

describe('HIP820Wallet.init', () => {
  const accountId = '0.0.123'
  const privateKey = PrivateKey.generate().toString()

  it('should create HIP820Wallet instance with proper HederaWallet', () => {
    const wallet820 = HIP820Wallet.init({
      chainId: HederaChainId.Testnet,
      accountId,
      privateKey,
    })
    expect(wallet820).toBeInstanceOf(HIP820Wallet)
    const hederaWallet = wallet820.getHederaWallet()
    expect(hederaWallet.accountId.toString()).toBe(accountId)
    expect(hederaWallet.provider).toBeDefined()
  })

  it('should use provided provider when _provider arg is passed', () => {
    const customProvider = new Provider(Client.forName('testnet'))
    const wallet820 = HIP820Wallet.init({
      chainId: HederaChainId.Testnet,
      accountId,
      privateKey,
      _provider: customProvider,
    })
    const hederaWallet = wallet820.getHederaWallet()
    expect(hederaWallet.provider).toBe(customProvider)
  })
})
