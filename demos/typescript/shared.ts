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

/*
 * Simple helpers to persist state in the browser for development purposes
 */
export function loadState() {
  const state = JSON.parse(localStorage.getItem('hedera-wc-example-saved-state') || '{}')
  for (const [key, value] of Object.entries(state))
    document
      .querySelector<HTMLInputElement>(`[name="${key}"]`)
      ?.setAttribute('value', value as string)
  // disable form inputs until wc is initialized
  document
    .querySelectorAll('.toggle input,.toggle button, .toggle select')
    .forEach((element) => ((element as HTMLInputElement).disabled = true))
}

export function saveState(e: Event): { [key: string]: string } {
  e.preventDefault()
  const form = new FormData(e.target as HTMLFormElement)
  const state = JSON.parse(localStorage.getItem('hedera-wc-example-saved-state') || '{}')
  for (const [key, value] of form.entries()) state[key] = value
  // delete state['private-key'] // don't save the private key

  localStorage.setItem('hedera-wc-example-saved-state', JSON.stringify(state))
  return state
}

export function getState(key: string) {
  const state = JSON.parse(localStorage.getItem('hedera-wc-example-saved-state') || '{}')
  return state[key]
}
