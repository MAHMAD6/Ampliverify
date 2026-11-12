'use client';

import { useState } from 'react';
import { Landmark } from 'lucide-react';
import { RedirectButton } from '@/components/ui/actions';

/** Bank-account countries offered for Stripe Connect payouts. Non-US sellers use cross-border payouts. */
const COUNTRIES: [string, string][] = [
  ['US', 'United States'],
  ['AU', 'Australia'],
  ['AT', 'Austria'],
  ['BE', 'Belgium'],
  ['BR', 'Brazil'],
  ['BG', 'Bulgaria'],
  ['CA', 'Canada'],
  ['HR', 'Croatia'],
  ['CY', 'Cyprus'],
  ['CZ', 'Czech Republic'],
  ['DK', 'Denmark'],
  ['EE', 'Estonia'],
  ['FI', 'Finland'],
  ['FR', 'France'],
  ['DE', 'Germany'],
  ['GR', 'Greece'],
  ['HK', 'Hong Kong'],
  ['HU', 'Hungary'],
  ['IN', 'India'],
  ['ID', 'Indonesia'],
  ['IE', 'Ireland'],
  ['IL', 'Israel'],
  ['IT', 'Italy'],
  ['JP', 'Japan'],
  ['LV', 'Latvia'],
  ['LT', 'Lithuania'],
  ['LU', 'Luxembourg'],
  ['MY', 'Malaysia'],
  ['MT', 'Malta'],
  ['MX', 'Mexico'],
  ['NL', 'Netherlands'],
  ['NZ', 'New Zealand'],
  ['NO', 'Norway'],
  ['PK', 'Pakistan'],
  ['PH', 'Philippines'],
  ['PL', 'Poland'],
  ['PT', 'Portugal'],
  ['RO', 'Romania'],
  ['SG', 'Singapore'],
  ['SK', 'Slovakia'],
  ['SI', 'Slovenia'],
  ['ZA', 'South Africa'],
  ['KR', 'South Korea'],
  ['ES', 'Spain'],
  ['SE', 'Sweden'],
  ['CH', 'Switzerland'],
  ['TH', 'Thailand'],
  ['TR', 'Turkey'],
  ['AE', 'United Arab Emirates'],
  ['GB', 'United Kingdom'],
];

export function PayoutConnect() {
  const [country, setCountry] = useState('US');
  return (
    <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        <span>Bank account country</span>
        <select value={country} onChange={(e) => setCountry(e.target.value)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border, #d0d5dd)' }}>
          {COUNTRIES.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <RedirectButton path="/user/marketplace/seller/payout-account" body={{ country }} icon={<Landmark size={16} />}>
        Connect payout account
      </RedirectButton>
    </span>
  );
}
