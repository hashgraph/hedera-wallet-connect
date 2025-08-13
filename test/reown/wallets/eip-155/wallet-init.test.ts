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

import { EIP155Wallet } from '../../../../src/reown/wallets/EIP155Wallet'
import { testPrivateKeyECDSA } from '../../../_helpers'
import { PrivateKey } from '@hashgraph/sdk'

describe('EIP155Wallet', () => {
  const privateKey = `0x${PrivateKey.fromStringECDSA(testPrivateKeyECDSA).toStringRaw()}`

  describe('init', () => {
    it('should initialize with random private key when none provided', () => {
      const wallet = EIP155Wallet.init({})

      expect(wallet).toBeInstanceOf(EIP155Wallet)
      expect(wallet.getPrivateKey()).toMatch(/^0x[a-fA-F0-9]{64}$/)
    })

    it('should initialize with provided private key', () => {
      const wallet = EIP155Wallet.init({ privateKey })

      expect(wallet.getPrivateKey()).toBe(privateKey)
      expect(wallet.getEvmAddress()).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })

    it('should connect to provider correctly', () => {
      const wallet = EIP155Wallet.init({ privateKey })
      const mockProvider = { _isProvider: true } as any

      const connected = wallet.connect(mockProvider)
      expect(connected.provider).toBe(mockProvider)
    })
  })
})
