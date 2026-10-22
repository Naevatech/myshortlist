import { describe, expect, it } from 'vitest';
import { isReservedAddress } from '../src/services/email/index.js';

describe('reserved test addresses', () => {
  it.each([
    ['sam.carter@example.com', true],
    ['careers@northfield-labs.example', true],
    ['a@b.test', true],
    ['someone@gmail.com', false],
    ['jobs@example-company.co.uk', false],
  ])('%s → %s', (address, reserved) => {
    expect(isReservedAddress(address)).toBe(reserved);
  });
});
