export interface AccountInfo {
  account: string
  alias: string
  auto_renew_period: number
  balance: Balance
  created_timestamp: string
  decline_reward: boolean
  deleted: boolean
  ethereum_nonce: number
  evm_address: string
  expiry_timestamp: string
  key: Key | null
  max_automatic_token_associations: number
  memo: string
  pending_reward: number
  receiver_sig_required: boolean
}

export interface Balance {
  balance: number
  timestamp: string
  tokens: Token[]
}

export interface Token {
  token_id: string
  balance: number
}

export interface Key {
  _type: string
  key: string
}
