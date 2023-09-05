export const HEDERA_CRYPTO_NAME = 'Hedera HBAR'
export const HEDERA_CRYPTO_SYMBOL = 'HBAR'
export const HEDERA_HBAR_SIGN = 'ℏ'
/**
 * BIP-0044 defines a logical hierarchy for deterministic wallets.
 * Level 2 of the hierarchy describes a coin type in use.
 * {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki}
 * {@link https://github.com/satoshilabs/slips/blob/master/slip-0044.md}
 */
export const HEDERA_SLIP0044_COIN_TYPE = 3030
export const HEDERA_BIP0044_CONSTANT = 0x80000bd6
export enum HederaJsonRpcMethods {
  SIGN_AND_EXECUTE_TRANSACTION = 'hedera_signAndExecuteTransaction',
  SIGN_AND_RETURN_TRANSACTION = 'hedera_signAndReturnTransaction',
  SIGN_MESSAGE = 'hedera_signMessage',
}
