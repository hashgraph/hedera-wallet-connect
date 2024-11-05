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

const DOCUSAURUS_STATIC = 'docs/static/demos/typescript'
const DIST = 'dist/demos/typescript'

// Create separate configs for dist and docusaurus builds
const baseConfig = {
  bundle: true,
  minify: false,
  platform: 'browser',
  alias: {
    '@hashgraph/sdk': './node_modules/@hashgraph/sdk/src/index.js',
    '@hashgraph/proto': './node_modules/@hashgraph/proto',
  },
  entryPoints: [
    'demos/typescript/main.ts',
    'demos/typescript/dapp/main.ts', 
    'demos/typescript/wallet/main.ts',
  ],
}

// Config for dist build
const distConfig = {
  ...baseConfig,
  outdir: DIST,
  plugins: [
    copy({
      assets: {
        from: ['demos/typescript/**/*.(html|css|ico|jpg|png)'],
        to: ['.'],
      },
      watch: true,
    }),
  ],
  define: {
    'process.env.dappUrl': '"https://wc.hgraph.app/dapp/index.html"',
    'process.env.walletUrl': '"https://wallet.wc.hgraph.app/wallet/index.html"',
  },
}

// Config for docusaurus build
const docusaurusConfig = {
  ...baseConfig,
  outdir: DOCUSAURUS_STATIC,
  plugins: [
    copy({
      assets: [
        {
          from: ['demos/typescript/main.css'],
          to: ['../..']
        },
        {
          from: ['demos/typescript/**/*.(html|ico|jpg|png)'],
          to: ['.'],
          flatten: false
        }
      ],
      watch: true,
    }),
  ],
  define: {
    'process.env.dappUrl': '"/demos/typescript/dapp/index.html"',
    'process.env.walletUrl': '"/demos/typescript/wallet/index.html"',
  },
}

// Build for dist
await esbuild.build(distConfig)

// Build for Docusaurus
await esbuild.build(docusaurusConfig)
