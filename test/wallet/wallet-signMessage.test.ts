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

import { HederaWallet } from '../../src'
import { defaultAccountNumber, testPrivateKeyECDSA, testPrivateKeyED25519 } from '../_helpers'

describe(HederaWallet.name, () => {
  describe('signMessage', () => {
    // [private key type, private key, expected value]
    const testCases = [
      [
        'ECDSA',
        testPrivateKeyECDSA,
        '3wZ4lWhegOFJ+Wkzzeta1Zdg36GGIBzYTJ/dfzJrMS9dgiW47Q4fi/kbSaAz8Ti4stFHGnffwnIlrn20PGgbiA==',
      ],
      [
        'ED25519',
        testPrivateKeyED25519,
        'yU9PESjUTIHsust5Pm+KNWAAKKsHjzLBWEQhfzWVBQTDExdwc6YEnHbbBCbm2HZLtg+CuKD9uwnkrMm29XE5Dg==',
      ],
    ]
    test.each(testCases)(
      'should decode message bytes and sign with: %p',
      (_, privateKey, expected) => {
        const wallet = HederaWallet.init({
          network: 'testnet',
          accountId: defaultAccountNumber,
          privateKey,
        })
        const messageBytes = Buffer.from('Hello world').toString('base64')
        const result = wallet.signMessage(messageBytes)
        expect(result.signature).toEqual(expected)
      },
    )
  })
})
