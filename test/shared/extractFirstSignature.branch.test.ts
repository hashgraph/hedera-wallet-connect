import { proto } from '@hashgraph/proto'
import { extractFirstSignature } from '../../src'

describe('extractFirstSignature branch coverage', () => {
  it('returns ed25519 signature when present', () => {
    const map = proto.SignatureMap.create({ sigPair: [{ ed25519: new Uint8Array([1]) }] })
    expect(extractFirstSignature(map)).toEqual(new Uint8Array([1]))
  })

  it('returns ECDSASecp256k1 signature when ed25519 missing', () => {
    const map = proto.SignatureMap.create({ sigPair: [{ ECDSASecp256k1: new Uint8Array([2]) }] })
    expect(extractFirstSignature(map)).toEqual(new Uint8Array([2]))
  })

  it('returns ECDSA_384 signature when others missing', () => {
    const map = proto.SignatureMap.create({ sigPair: [{ ECDSA_384: new Uint8Array([3]) }] })
    expect(extractFirstSignature(map)).toEqual(new Uint8Array([3]))
  })

  it('prefers ed25519 over other types', () => {
    const map = proto.SignatureMap.create({ sigPair: [{ ed25519: new Uint8Array([4]), ECDSASecp256k1: new Uint8Array([5]), ECDSA_384: new Uint8Array([6]) }] })
    expect(extractFirstSignature(map)).toEqual(new Uint8Array([4]))
  })

  it('throws when signature fields missing', () => {
    const map = proto.SignatureMap.create({ sigPair: [{ pubKeyPrefix: new Uint8Array([0]) }] })
    expect(() => extractFirstSignature(map)).toThrow('No signatures found')
  })

  it('throws when sigPair is undefined', () => {
    expect(() => extractFirstSignature({} as proto.ISignatureMap)).toThrow('No signatures found')
  })

  it('throws when argument is null', () => {
    expect(() => extractFirstSignature(null as any)).toThrow('No signatures found')
  })
})
