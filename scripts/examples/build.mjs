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
import copy from 'esbuild-plugin-copy'

export const config = {
  bundle: true,
  minify: false,
  platform: 'browser',
  // format: 'esm',
  alias: {
    '@hashgraph/sdk': './node_modules/@hashgraph/sdk/src/index.js',
    '@hashgraph/proto': './node_modules/@hashgraph/proto',
  },
  plugins: [
    copy({
      assets: {
        from: ['src/examples/typescript/**/*.(html|css|ico|jpg|png)'],
        to: ['./'],
      },
      watch: true, // for ../dev.mjs
    }),
  ],
  outdir: 'dist/examples/typescript',
  entryPoints: [
    'src/examples/typescript/main.ts',
    'src/examples/typescript/dapp/main.ts',
    'src/examples/typescript/wallet/main.ts',
  ],
  define: {
    'process.env.dappUrl': '"https://wc.hgraph.app/dapp/index.html"',
    'process.env.walletUrl': '"https://wallet.wc.hgraph.app/wallet/index.html"',
  },
}

esbuild.build(config)
