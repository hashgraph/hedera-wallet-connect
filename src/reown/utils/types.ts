import { SignClientTypes } from '@walletconnect/types'

export interface EthFilter {
  address?: string
  topics?: Array<string | null>
  fromBlock?: string
  toBlock?: string
  blockHash?: string
}

export type WalletRequestEventArgs = Omit<
  SignClientTypes.EventArguments['session_request'],
  'verifyContext'
>
