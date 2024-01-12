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

/**
 * Enum representing different JSON-RPC methods related to Hedera.
 * The methods are ordered alphabetically for ease of use and readability.
 */
export enum HederaJsonRpcMethod {
  GetNodeAddresses = 'hedera_getNodeAddresses', // 1
  ExecuteTransaction = 'hedera_executeTransaction', // 2
  SignMessage = 'hedera_signMessage', // 3
  SignAndExecuteQuery = 'hedera_signAndExecuteQuery', // 4
  SignAndExecuteTransaction = 'hedera_signAndExecuteTransaction', // 5
  SignTransaction = 'hedera_signTransaction', // 6
}
