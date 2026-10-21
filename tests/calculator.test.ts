import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, example, zero, formatDecimal, money, parseInput, isTinyNonZero } from '../src/calculator.ts';
import type { Inputs } from '../src/calculator.ts';

function result(values: Inputs) {
  const answer = calculate(values);
  assert.equal(answer.valid, true);
  if (!answer.valid) throw new Error('Expected valid calculation');
  return answer.results;
}

test('案例 A：12 次、6 IMD、12 美元 IMD 成本、25 总成本、15 毛利、25 盈亏平衡收费', () => {
  const r = result(example);
  assert.equal(formatDecimal(r.executions, 0), '12');
  assert.equal(formatDecimal(r.imd, 6), '6');
  assert.equal(money(r.imdCost), '12.00');
  assert.equal(money(r.total), '25.00');
  assert.equal(money(r.profit), '15.00');
  assert.equal(money(r.breakEven), '25.00');
  assert.equal(r.status, 'profit');
});

test('案例 B：仅修改 S=20，成本 25、毛利 −5，亏损', () => {
  const r = result({ ...example, S: '20' });
  assert.equal(money(r.total), '25.00');
  assert.equal(money(r.profit), '−5.00');
  assert.equal(r.status, 'loss');
});

test('案例 C：所有输入与输出归零，盈亏平衡', () => {
  const r = result(zero);
  for (const [key, value] of Object.entries(r)) {
    if (key !== 'status' && typeof value !== 'string') assert.equal(value.coefficient, 0n);
  }
  assert.equal(r.status, 'balanced');
  assert.equal(money(r.profit), '0.00');
});

test('R 为整批额外执行次数；E 和 H 各加一次，包括零任务批次', () => {
  const r = result({ N: '10', R: '2', U: '1', P: '1', E: '5', H: '8', S: '25' });
  assert.equal(money(r.total), '25.00');
  assert.equal(r.status, 'balanced');
  const noExecutions = result({ ...zero, E: '5', H: '8' });
  assert.equal(money(noExecutions.total), '13.00');
  assert.equal(money(noExecutions.profit), '−13.00');
});

test('每个字段拒绝负数、空值、非数字、非有限值和混入的单位', () => {
  for (const key of Object.keys(example)) {
    for (const value of ['-1', '-0', '−1', '', ' ', 'abc', 'NaN', 'Infinity', '1e309', '1,000', '5美元']) {
      const answer = calculate({ ...example, [key]: value });
      assert.equal(answer.valid, false, `${key}=${value}`);
      if (!answer.valid) assert.ok(answer.errors[key as keyof Inputs]);
    }
  }
});

test('N/R 拒绝小数；其他字段接受非负小数', () => {
  for (const key of ['N', 'R']) {
    for (const value of ['1.5', '1.0', '.5', '1.']) {
      assert.equal(calculate({ ...example, [key]: value }).valid, false);
    }
  }
  for (const key of ['U', 'P', 'E', 'H', 'S']) {
    for (const value of ['0.5', '.5', '1.', '  2.5  ']) {
      assert.equal(calculate({ ...example, [key]: value }).valid, true);
    }
  }
});

test('十进制精确相加，0.1 + 0.2 与 0.3 精确平衡', () => {
  const r = result({ ...zero, E: '0.1', H: '0.2', S: '0.3' });
  assert.equal(r.profit.coefficient, 0n);
  assert.equal(r.status, 'balanced');
});

test('中间 IMD 不提前舍入，美元只在展示时舍入', () => {
  const r = result({ ...zero, N: '1', U: '0.00000049', P: '100000000', S: '50' });
  assert.equal(formatDecimal(r.imd, 6), '0');
  assert.equal(money(r.imdCost), '49.00');
  assert.equal(money(r.profit), '1.00');
  assert.equal(isTinyNonZero(r.imd, 6), true);
  const pennies = result({ ...zero, E: '0.004', H: '0.004', S: '0.02' });
  assert.equal(money(pennies.total), '0.01');
  assert.equal(money(pennies.profit), '0.01');
});

test('极小毛利按精确值判断，显示不出现负零', () => {
  const r = result({ ...zero, E: '0.001' });
  assert.equal(r.status, 'loss');
  assert.equal(money(r.profit), '0.00');
  assert.equal(isTinyNonZero(r.profit, 2), true);
  assert.equal(result({ ...zero, S: '0.001' }).status, 'profit');
});

test('美元四舍五入、IMD 六位精度和千位分隔', () => {
  const d = (s: string) => { const r = parseInput(s, false); assert.notEqual(typeof r, 'string'); if (typeof r === 'string') throw Error(r); return r; };
  assert.equal(money(d('1.005')), '1.01');
  assert.equal(formatDecimal(d('1.2345678'), 6), '1.234568');
  assert.equal(formatDecimal(d('6.000000'), 6), '6');
  assert.equal(money(d('1234567.89')), '1,234,567.89');
});

test('超过 Number 安全整数的次数保持精确，长小数不下溢', () => {
  const r = result({ ...zero, N: '9007199254740993', R: '2', U: '1', P: '1' });
  assert.equal(formatDecimal(r.executions, 0, false, false), '9007199254740995');
  const tiny = result({ ...zero, S: `0.${'0'.repeat(100)}1` });
  assert.equal(tiny.status, 'profit');
});

test('120 字符上限明确拒绝超长输入，支持上限内大数', () => {
  assert.equal(calculate({ ...example, N: '9'.repeat(120) }).valid, true);
  assert.equal(calculate({ ...example, N: '9'.repeat(121) }).valid, false);
});
