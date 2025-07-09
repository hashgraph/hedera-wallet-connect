import {
  prefixMessageToSign,
  stringToSignerMessage,
  Uint8ArrayToString,
  signerSignaturesToSignatureMap,
  signatureMapToBase64String,
  base64StringToSignatureMap,
  verifyMessageSignature,
  verifySignerSignature,
  transactionBodyToBase64String,
  base64StringToTransactionBody,
  transactionListToBase64String,
  accountAndLedgerFromSession,
} from '../../src'
import { proto } from '@hashgraph/proto'
import {
  PrivateKey,
  PublicKey,
  SignerSignature,
  AccountId,
} from '@hashgraph/sdk'
import { SessionTypes } from '@walletconnect/types'

describe('additional utils', () => {
  it('prefixMessageToSign and stringToSignerMessage', () => {
    const prefix = prefixMessageToSign('hello')
    expect(prefix).toBe('\x19Hedera Signed Message:\n5hello')
    expect(stringToSignerMessage('hello')).toEqual([Buffer.from(prefix)])
  })

  it('Uint8ArrayToString converts array to string', () => {
    const arr = new Uint8Array([72, 101, 108, 108, 111])
    expect(Uint8ArrayToString(arr)).toBe('Hello')
  })

  it('signature map helpers and verifiers', () => {
    const key = PrivateKey.generateED25519()
    const message = 'verify'
    const signature = key.sign(Buffer.from(prefixMessageToSign(message)))
    const sigMap = proto.SignatureMap.create({
      sigPair: [
        { pubKeyPrefix: key.publicKey.toBytes(), ed25519: signature },
      ],
    })
    const base64 = signatureMapToBase64String(sigMap)
    const decoded = base64StringToSignatureMap(base64)
    expect(decoded.sigPair[0].ed25519.length).toBe(signature.length)
    expect(
      verifyMessageSignature(message, base64, key.publicKey),
    ).toBe(true)

    const signerSig = new SignerSignature({
      accountId: new AccountId(0),
      publicKey: key.publicKey,
      signature,
    })
    expect(verifySignerSignature(message, signerSig, key.publicKey)).toBe(true)

    const mapFromSigner = signerSignaturesToSignatureMap([signerSig])
    expect(mapFromSigner.sigPair.length).toBe(1)
  })

  it('transaction body and list helpers', () => {
    const body = proto.TransactionBody.create({ memo: 'test' })
    const base64 = transactionBodyToBase64String(body)
    const decoded = base64StringToTransactionBody(base64)
    expect(decoded.memo).toBe('test')

    const txn = proto.Transaction.create({ signedTransactionBytes: Buffer.from([1, 2, 3]) })
    const list = proto.TransactionList.create({ transactionList: [txn] })
    const listBase64 = transactionListToBase64String(list)
    const expected = Buffer.from(proto.TransactionList.encode(list).finish()).toString('base64')
    expect(listBase64).toBe(expected)
  })

  it('accountAndLedgerFromSession parses accounts', () => {
    const session: SessionTypes.Struct = {
      topic: 't',
      expiry: 0,
      acknowledged: true,
      relay: { protocol: 'irn' },
      controller: '',
      namespaces: {
        hedera: {
          accounts: ['hedera:testnet:0.0.123'],
          methods: [],
          events: [],
        },
      },
      requiredNamespaces: {},
      optionalNamespaces: {},
      self: { metadata: { name: '' } },
      peer: { metadata: { name: '' } },
    }
    const result = accountAndLedgerFromSession(session)
    expect(result[0].network.toString()).toBe('testnet')
    expect(result[0].account.toString()).toBe('0.0.123')
    expect(() => accountAndLedgerFromSession({ namespaces: {} } as any)).toThrow()
  })
})
