/** Exact base-10 arithmetic. No rounding occurs until display formatting. */
export interface Decimal {
  readonly coefficient: bigint;
  readonly scale: number;
}

export const fieldIds = ['N', 'R', 'U', 'P', 'E', 'H', 'S'] as const;
export type FieldId = (typeof fieldIds)[number];
export type Inputs = Record<FieldId, string>;
export type Errors = Partial<Record<FieldId, string>>;
export const example: Readonly<Inputs> = {
  N: '10', R: '2', U: '0.5', P: '2', E: '5', H: '8', S: '40',
};
export const zero: Readonly<Inputs> = {
  N: '0', R: '0', U: '0', P: '0', E: '0', H: '0', S: '0',
};
export const MAX_INPUT_LENGTH = 120;

function decimal(coefficient: bigint, scale: number): Decimal {
  if (coefficient === 0n) return { coefficient: 0n, scale: 0 };
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale--;
  }
  return { coefficient, scale };
}

export function parseInput(raw: string, integer: boolean): Decimal | string {
  const value = raw.trim();
  if (!value) return '请填写数值；没有此项时填 0。';
  if (value.length > MAX_INPUT_LENGTH) return `数值过长，请控制在 ${MAX_INPUT_LENGTH} 个字符以内。`;
  if (value.startsWith('-') || value.startsWith('−')) return '请填写大于或等于 0 的数值。';
  if (integer && !/^\d+$/.test(value)) return '请填写非负整数，例如 0、10；次数不接受小数。';
  if (!integer && !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) {
    return '请填写非负数，小数用英文句点，例如 0.5；不要填写单位或科学计数法。';
  }
  const [whole = '0', fraction = ''] = value.split('.');
  return decimal(BigInt((whole || '0') + fraction), fraction.length);
}

export function add(a: Decimal, b: Decimal): Decimal {
  const scale = Math.max(a.scale, b.scale);
  return decimal(
    a.coefficient * 10n ** BigInt(scale - a.scale) + b.coefficient * 10n ** BigInt(scale - b.scale),
    scale,
  );
}

export function multiply(a: Decimal, b: Decimal): Decimal {
  return decimal(a.coefficient * b.coefficient, a.scale + b.scale);
}

export interface Results {
  executions: Decimal;
  imd: Decimal;
  imdCost: Decimal;
  total: Decimal;
  profit: Decimal;
  breakEven: Decimal;
  revenue: Decimal;
  other: Decimal;
  human: Decimal;
  status: 'profit' | 'loss' | 'balanced';
}
export type Calculation = { valid: false; errors: Errors } | { valid: true; results: Results };

export function calculate(inputs: Inputs): Calculation {
  const errors: Errors = {};
  const parsed: Partial<Record<FieldId, Decimal>> = {};
  for (const id of fieldIds) {
    const result = parseInput(inputs[id], id === 'N' || id === 'R');
    if (typeof result === 'string') errors[id] = result;
    else parsed[id] = result;
  }
  if (Object.keys(errors).length) return { valid: false, errors };
  const { N, R, U, P, E, H, S } = parsed as Record<FieldId, Decimal>;
  const executions = add(N, R);
  const imd = multiply(executions, U);
  const imdCost = multiply(imd, P);
  const total = add(add(imdCost, E), H);
  const profit = add(S, { coefficient: -total.coefficient, scale: total.scale });
  return {
    valid: true,
    results: {
      executions, imd, imdCost, total, profit, breakEven: total, revenue: S, other: E, human: H,
      status: profit.coefficient > 0n ? 'profit' : profit.coefficient < 0n ? 'loss' : 'balanced',
    },
  };
}

/** Round half away from zero, only at the presentation boundary. */
export function formatDecimal(value: Decimal, places: number, fixed = false, grouped = true): string {
  const absolute = value.coefficient < 0n ? -value.coefficient : value.coefficient;
  let rounded: bigint;
  if (value.scale > places) {
    const divisor = 10n ** BigInt(value.scale - places);
    rounded = (absolute + divisor / 2n) / divisor;
  } else {
    rounded = absolute * 10n ** BigInt(places - value.scale);
  }
  const digits = rounded.toString().padStart(places + 1, '0');
  let whole = places ? digits.slice(0, -places) : digits;
  let fraction = places ? digits.slice(-places) : '';
  if (!fixed) fraction = fraction.replace(/0+$/, '');
  if (grouped) whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = value.coefficient < 0n && rounded !== 0n ? '−' : '';
  return `${sign}${whole}${fraction ? `.${fraction}` : ''}`;
}

export const money = (value: Decimal): string => formatDecimal(value, 2, true);
export const statusLabels = { profit: '盈利', loss: '亏损', balanced: '盈亏平衡' } as const;

export function isTinyNonZero(value: Decimal, places: number): boolean {
  const absolute = value.coefficient < 0n ? -value.coefficient : value.coefficient;
  return absolute !== 0n && value.scale > places && absolute < 10n ** BigInt(value.scale - places);
}
