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

import * as esbuild from 'esbuild'
import { config } from './build.mjs'

const devConfig = {
  ...config,
  define: {
    'process.env.dappUrl': '"http://localhost:8080/dapp/index.html"',
    'process.env.walletUrl': '"http://localhost:8081/wallet/index.html"',
  },
}

let ctx8080 = await esbuild.context(devConfig)
let ctx8081 = await esbuild.context(devConfig)

/*
 * watches for file changes and serves most recent files
 */
async function main() {
  const server1 = await ctx8080.serve({
    servedir: 'dist/examples/typescript',
    host: 'localhost',
    port: 8080,
  })
  const server2 = await ctx8081.serve({
    servedir: 'dist/examples/typescript',
    host: 'localhost',
    port: 8081,
  })

  console.log(`Server 1 is up ${server1.host}:${server1.port}`)
  console.log(`Server 2 is up ${server2.host}:${server2.port}`)
}

await main()
