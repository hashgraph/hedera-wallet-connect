export const RPC_URL = 'https://rpc.walletconnect.org/v1/'

export const GENERIC_SUBPROVIDER_NAME = 'generic'

export const BUNDLER_URL = `${RPC_URL}bundler`

export const PROVIDER_EVENTS = {
  DEFAULT_CHAIN_CHANGED: 'default_chain_changed',
}

// EIP-155 Wallet Methods
export enum Eip155JsonRpcMethod {
  PersonalSign = 'personal_sign',
  Sign = 'eth_sign',
  SignTransaction = 'eth_signTransaction',
  SignTypedData = 'eth_signTypedData',
  SignTypedDataV3 = 'eth_signTypedData_v3',
  SignTypedDataV4 = 'eth_signTypedData_v4',
  SendRawTransaction = 'eth_sendRawTransaction',
  SendTransaction = 'eth_sendTransaction',
}
