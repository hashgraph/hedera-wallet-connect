import { AccountId, Transaction } from '@hashgraph/sdk'

/**
 * Freezes a transaction if it is not already frozen. Transactions must
 * be frozen before they can be converted to bytes.
 *
 * @param transaction Any instance of a class that extends `Transaction`
 */
export function freezeTransaction<T extends Transaction>(transaction: T): void {
  if (!transaction.isFrozen()) {
    transaction.freeze()
  }
}

/**
 * Sets a default consensus node that a transaction will be submitted to. Node Account ID(s)
 * must be set before a transaction can be frozen. If they have already been set, this
 * function will not modify the transaction. See full list of nodes here:
 * - {@link https://docs.hedera.com/hedera/networks/testnet/testnet-nodes}
 * - {@link https://docs.hedera.com/hedera/networks/mainnet/mainnet-nodes}
 * @param transaction Any instance of a class that extends `Transaction`
 */
export function setDefaultNodeAccountIds<T extends Transaction>(transaction: T): void {
  const isNodeAccountIdNotSet =
    !transaction.nodeAccountIds || transaction.nodeAccountIds.length === 0
  if (!transaction.isFrozen() && isNodeAccountIdNotSet) {
    transaction.setNodeAccountIds([new AccountId(3)])
  }
}

/**
 * Converts a transaction to bytes and then encodes as a base64 string. Will attempt
 * to set default Node Account ID and freeze the transaction before converting.
 * @param transaction Any instance of a class that extends `Transaction`
 * @returns a base64 encoded string
 */
export function transactionToBase64String<T extends Transaction>(transaction: T): string {
  setDefaultNodeAccountIds(transaction)
  freezeTransaction(transaction)
  const transactionBytes = transaction.toBytes()
  return Buffer.from(transactionBytes).toString('base64')
}

/**
 * Recreates a `Transaction` from a base64 encoded string. First decodes the string to a buffer,
 * then passes to `Transaction.fromBytes`. For greater flexibility, this function uses the base
 * `Transaction` class, but takes an optional type parameter if the type of transaction is known,
 * allowing stronger typeing.
 * @param transactionBytes string - a base64 encoded string
 * @returns `Transaction`
 * @example
 * ```js
 * const txn1 = base64StringToTransaction(bytesString)
 * const txn2 = base64StringToTransaction<TransferTransaction>(bytesString)
 * // txn1 type: Transaction
 * // txn2 type: TransferTransaction
 * ```
 */
export function base64StringToTransaction<T extends Transaction>(transactionBytes: string): T {
  const decoded = Buffer.from(transactionBytes, 'base64')
  return Transaction.fromBytes(decoded) as T
}
