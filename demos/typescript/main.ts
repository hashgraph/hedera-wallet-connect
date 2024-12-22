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

const MAX_RETRIES = 3
const INITIAL_DELAY = 20000 // 20 seconds

async function setIframeSrcWithRetry() {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const iframe = document.querySelectorAll('iframe')
      const dapp = iframe[0]
      const wallet = iframe[1]

      await new Promise((resolve) => setTimeout(resolve, INITIAL_DELAY * Math.pow(2, attempt)))

      dapp.src = process.env.dappUrl!
      wallet.src = process.env.walletUrl!
      console.log('demo iframes are loaded')

      // If we get here, it worked
      return
    } catch (error) {
      if (attempt === MAX_RETRIES - 1) {
        console.error('Failed to set iframe sources after maximum retries:', error)
        // throw error
      }
      console.warn(`Attempt ${attempt + 1} failed, retrying...`)
    }
  }
}

setIframeSrcWithRetry()
