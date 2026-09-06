import assert from 'node:assert/strict';
import { parseAssetInput } from './asset.ts';

const asset = parseAssetInput({
  symbol: ' nvda ', name: 'NVIDIA', assetType: 'STOCK', market: 'nasdaq', currency: 'usd', enabled: true,
});
assert.equal(asset.symbol, 'NVDA');
assert.equal(asset.market, 'NASDAQ');
assert.throws(() => parseAssetInput({ ...asset, symbol: 'NV DA' }), /티커/);
assert.throws(() => parseAssetInput({ ...asset, importanceWeight: 101 }), /중요도/);
console.log('asset validation: ok');
