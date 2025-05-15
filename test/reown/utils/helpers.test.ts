/*
 *
 * Hedera Wallet Connect
 *
 * Copyright (C) 2025 Hedera Hashgraph, LLC
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

import { ethers } from 'ethers'
import { getSignParamsMessage, getSignTypedDataParamsData } from '../../../src'

describe('Helper Functions', () => {
  const testAddress = '0x1d85568eEAbad713fBB5293B45ea066e552A90De'
  const testMessage = 'Hello World'
  const testHexMessage = ethers.hexlify(ethers.toUtf8Bytes(testMessage))
  const testTypedData = { types: { EIP712Domain: [] }, domain: {}, message: {} }

  describe('getSignParamsMessage', () => {
    it('should extract message from params with address', () => {
      const params = [testAddress, testMessage]
      const result = getSignParamsMessage(params)
      expect(result).toBe(testMessage)
    })

    it('should convert hex to utf8 string', () => {
      const params = [testAddress, testHexMessage]
      const result = getSignParamsMessage(params)
      expect(result).toBe(testMessage)
    })

    it('should return original message if not hex', () => {
      const params = [testAddress, 'non-hex message']
      const result = getSignParamsMessage(params)
      expect(result).toBe('non-hex message')
    })
  })

  describe('getSignTypedDataParamsData', () => {
    it('should parse string data to object', () => {
      const params = [testAddress, JSON.stringify(testTypedData)]
      const result = getSignTypedDataParamsData(params)
      expect(result).toEqual(testTypedData)
    })

    it('should return original data if not string', () => {
      const params = [testAddress, testTypedData]
      const result = getSignTypedDataParamsData(params as any)
      expect(result).toBe(testTypedData)
    })
  })
})
