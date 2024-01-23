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

// https://esbuild.github.io/api/#main-fields-for-package-authors
export const common = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  metafile: true,
  loader: {
    '.json': 'text',
  },
  // exports field in @hashgraph/sdk overwrites browser field
  // https://github.com/evanw/esbuild/issues/1275
  alias: {
    '@hashgraph/sdk': './node_modules/@hashgraph/sdk/src/index.js',
    '@hashgraph/proto': './node_modules/@hashgraph/proto',
  },
  // external: ['./node_modules/@hashgraph/sdk/src/index.js'],
}

export const nodeCjs = {
  ...common,
  format: 'cjs',
  platform: 'node',
  target: ['node18'],
  outfile: 'dist/node-cjs.js',
}

export const nodeEsm = {
  ...common,
  format: 'esm',
  platform: 'node',
  target: ['node18'],
  outfile: 'dist/node-esm.js',
}

export const browserEsm = {
  ...common,
  format: 'esm',
  platform: 'browser',
  target: ['chrome58', 'firefox57', 'safari11', 'edge88'],
  outfile: 'dist/browser-esm.js',
}

export const browserCjs = {
  ...common,
  format: 'cjs',
  platform: 'browser',
  target: ['chrome58', 'firefox57', 'safari11', 'edge88'],
  outfile: 'dist/browser-cjs.js',
}
