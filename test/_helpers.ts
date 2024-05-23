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

import fs from 'fs'
import path from 'path'
import { AccountId, Query, Transaction, TransactionId } from '@hashgraph/sdk'

export const projectId = 'ce06497abf4102004138a10edd29c921'
export const walletMetadata = {
  name: 'Wallet Test',
  url: 'https://dapp.hedera.app',
  description: 'Hedera Hashgraph Wallet Example.',
  icons: [
    'https://cdn-assets-cloud.frontify.com/s3/frontify-cloud-files-us/eyJwYXRoIjoiZnJvbnRpZnlcL2FjY291bnRzXC8xNFwvMTQzMTI3XC9wcm9qZWN0c1wvMTgwMjE1XC9hc3NldHNcL2M3XC8zNDU0ODY3XC85ZjM1NDliYmE5MGQ2NDA0OGU0NzlhZTNiMzkyYzY4Yy0xNTY2NTkxOTQ4LmpwZyJ9:frontify:v_zJvQTCjtNploUvnSpk8S5NJB4R5eei6f7ERL2KSeQ?width=800',
  ],
}
export const dAppMetadata = {
  name: 'dApp Test',
  url: 'https://dapp.hedera.app',
  description: 'Hedera Hashgraph dApp Example.',
  icons: [
    'https://cdn-assets-cloud.frontify.com/s3/frontify-cloud-files-us/eyJwYXRoIjoiZnJvbnRpZnlcL2FjY291bnRzXC8xNFwvMTQzMTI3XC9wcm9qZWN0c1wvMTgwMjE1XC9hc3NldHNcL2M3XC8zNDU0ODY3XC85ZjM1NDliYmE5MGQ2NDA0OGU0NzlhZTNiMzkyYzY4Yy0xNTY2NTkxOTQ4LmpwZyJ9:frontify:v_zJvQTCjtNploUvnSpk8S5NJB4R5eei6f7ERL2KSeQ?width=800',
  ],
}
export const requestId = 1
export const requestTopic = 'test-topic'
export const defaultAccountNumber = 12345
export const defaultNodeId = 3
export const testUserAccountId = new AccountId(defaultAccountNumber)
export const testNodeAccountId = new AccountId(defaultNodeId)
/** Fixed to a specific timestamp */
export const testTransactionId = TransactionId.fromString(
  `0.0.${defaultAccountNumber}@1691705630.325343432`,
)

type TransactionOptions = {
  setNodeAccountIds?: boolean
  setTransactionId?: boolean
  freeze?: boolean
  operatorAccountId?: number
}
export function prepareTestTransaction<T extends Transaction = Transaction>(
  transaction: T,
  options?: TransactionOptions,
): T {
  const selectedOptions: TransactionOptions = {
    // defaults
    freeze: false,
    setNodeAccountIds: true,
    setTransactionId: true,
    operatorAccountId: defaultAccountNumber,
    // overrides
    ...options,
  }
  if (selectedOptions.setNodeAccountIds) {
    transaction.setNodeAccountIds([testNodeAccountId])
  }
  if (selectedOptions.setTransactionId) {
    let transactionId = testTransactionId
    if (
      selectedOptions.operatorAccountId &&
      selectedOptions.operatorAccountId !== defaultAccountNumber
    ) {
      transactionId = TransactionId.generate(new AccountId(selectedOptions.operatorAccountId))
    }
    transaction.setTransactionId(transactionId)
  }
  if (selectedOptions.freeze) {
    transaction.freeze()
  }
  return transaction
}

type QueryOptions = {
  setNodeAccountIds?: boolean
}
export function prepareTestQuery<Q extends Query<OutputT>, OutputT>(
  query: Q,
  options?: QueryOptions,
): Q {
  const selectedOptions: QueryOptions = {
    // defaults
    setNodeAccountIds: true,
    // overrides
    ...options,
  }
  if (selectedOptions.setNodeAccountIds) {
    query.setNodeAccountIds([testNodeAccountId])
  }
  return query
}

// from PrivateKey.generateECDSA().toStringDer()
export const testPrivateKeyECDSA =
  '3030020100300706052b8104000a042204203ce31ffad30d6db47c315bbea08232aad2266d8800a12aa3d8a812486e782759'
// from PrivateKey.generateED25519().toStringDer()
export const testPrivateKeyED25519 =
  '302e020100300506032b657004220420133eefea772add1f995c96bccf42b08b76daf67665f0c4c5ae308fae9275c142'

/** JSON fixture helpers */
const FIXTURES_PATH = 'test/_fixtures'

const filenameWithJsonExtension = (filename: string) => {
  const file = /\.json$/.test(filename) ? filename : filename + '.json'
  return path.join(FIXTURES_PATH, file)
}

export function useJsonFixture(filename: string) {
  const filepath = filenameWithJsonExtension(filename)
  const data = fs.readFileSync(filepath).toString()
  return JSON.parse(data)
}

export function writeJsonFixture(filename: string, data: any) {
  const filepath = filenameWithJsonExtension(filename)
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
}
