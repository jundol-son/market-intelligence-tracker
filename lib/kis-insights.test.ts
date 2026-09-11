import assert from 'node:assert/strict';
import { parseKisAssetInsight, parseKisMarketInsight } from './kis-insights.ts';

const ok = (output: unknown) => ({ rt_cd: '0', output });
const market = parseKisMarketInsight('KOSPI', ok({ bstp_nmix_prpr: '2689.42', bstp_nmix_prdy_ctrt: '0.82', ascn_issu_cnt: '520', down_issu_cnt: '330', stnr_issu_cnt: '80', ntby_rsqn: '1200' }), ok([{ stck_bsop_date: '20260911', frgn_ntby_qty: '120000', orgn_ntby_qty: '-50000', prsn_ntby_qty: '-70000', frgn_ntby_tr_pbmn: '210000' }]), '2026-09-11');
assert.equal(market.date, '2026-09-11');
assert.equal(market.breadthPercent?.toFixed(1), '61.2');
assert.equal(market.foreignNetQty, 120000);

const asset = parseKisAssetInsight('005930', ok({ stck_prpr: '84000', prdy_ctrt: '1.20', per: '18.2', pbr: '1.55', w52_hgpr: '90000', hts_frgn_ehrt: '52.4', pgtr_ntby_qty: '30000', ssts_yn: 'Y', invt_caful_yn: 'N' }), ok([{ stck_bsop_date: '20260911', frgn_ntby_qty: '90000', orgn_ntby_qty: '20000', prsn_ntby_qty: '-110000' }]), '2026-09-11');
assert.equal(asset.per, 18.2);
assert.equal(asset.foreignNetQty, 90000);
assert.equal(asset.shortSellable, true);
assert.deepEqual(asset.warnings, []);
assert.deepEqual(parseKisAssetInsight('000660', ok({ mang_issu_cls_code: '0', mrkt_warn_cls_code: '00' }), ok([]), '2026-09-11').warnings, []);
assert.throws(() => parseKisMarketInsight('KOSPI', { rt_cd: '1', msg1: 'denied' }, ok([]), '2026-09-11'), /denied/);

console.log('KIS insight tests passed');
