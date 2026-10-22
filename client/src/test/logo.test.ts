import { describe, expect, it } from 'vitest';
import { initials } from '../components/CompanyLogo';

describe('company initials', () => {
  it.each([
    ['Halden & Moore', 'HM'],
    ['Ocho', 'O'],
    ['MCS Group', 'MC'],
    ['Digital Catapult Ltd', 'DC'],
    ['eFinancialCareers', 'E'],
  ])('%s → %s', (company, expected) => {
    expect(initials(company)).toBe(expected);
  });
});
