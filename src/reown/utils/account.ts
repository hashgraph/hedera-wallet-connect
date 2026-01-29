import {
  AccountBalance,
  AccountBalanceQuery,
  AccountId,
  Client,
  LedgerId,
} from '@hiero-ledger/sdk'
import { createLogger } from '../../lib/shared/logger'

const logger = createLogger('AccountUtils')

export async function getAccountBalance(
  ledgerId: LedgerId,
  address: string,
): Promise<AccountBalance | null> {
  const client = ledgerId === LedgerId.TESTNET ? Client.forTestnet() : Client.forMainnet()
  let accountId: AccountId

  try {
    // First try to parse as a Hedera account ID (e.g., "0.0.12345")
    accountId = AccountId.fromString(address)
  } catch (e) {
    // If it's an EVM address (starts with 0x), try to get the associated account
    if (address.startsWith('0x')) {
      try {
        accountId = AccountId.fromEvmAddress(0, 0, address)
        // Try to populate the account number from the mirror node
        // This will fail if the EVM address doesn't have an associated Hedera account
        if (accountId.num.isZero() && accountId.evmAddress != null) {
          await accountId.populateAccountNum(client)
        }
      } catch (populateError) {
        // If we can't find a Hedera account for this EVM address, return null
        logger.debug('No Hedera account found for EVM address:', address)
        return null
      }
    } else {
      // Not a valid account ID or EVM address
      logger.debug('Invalid address format:', address)
      return null
    }
  }

  try {
    return await new AccountBalanceQuery().setAccountId(accountId).execute(client)
  } catch (e) {
    logger.debug('Failed to get account balance:', e)
    return null
  }
}
