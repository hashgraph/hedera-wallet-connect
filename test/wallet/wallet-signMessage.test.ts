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
