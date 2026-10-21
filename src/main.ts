import './style.css';
import { calculate, example, fieldIds, formatDecimal, isTinyNonZero, money, statusLabels, zero } from './calculator.ts';
import type { FieldId, Inputs } from './calculator.ts';

const select = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
};

const form = select<HTMLFormElement>('#calculator');
const inputs = Object.fromEntries(fieldIds.map(id => [id, select<HTMLInputElement>(`#${id}`)])) as Record<FieldId, HTMLInputElement>;
const results = select('#valid-results');
const invalid = select('#invalid-results');
const status = select('#profit-status');
const panel = select('#result-panel');
const announcements = select('#announcements');
const inputMessage = select('#input-message');
let announcementTimer: ReturnType<typeof setTimeout>;

function update(announce = true, action = ''): void {
  const values = Object.fromEntries(fieldIds.map(id => [id, inputs[id].value])) as Inputs;
  const calculation = calculate(values);
  for (const id of fieldIds) {
    const error = !calculation.valid ? calculation.errors[id] : undefined;
    const message = select(`#${id}-error`);
    message.textContent = error ?? '';
    message.hidden = !error;
    inputs[id].setAttribute('aria-invalid', String(Boolean(error)));
    inputs[id].setAttribute('aria-describedby', `${id}-hint${error ? ` ${id}-error` : ''}`);
  }
  results.hidden = !calculation.valid;
  invalid.hidden = calculation.valid;
  panel.dataset.state = calculation.valid ? calculation.results.status : 'invalid';
  let announcement: string;
  if (calculation.valid) {
    const r = calculation.results;
    for (const key of ['imdCost', 'total', 'profit', 'breakEven', 'revenue', 'other', 'human'] as const) {
      select(`#result-${key}`).textContent = money(r[key]);
    }
    select('#result-executions').textContent = formatDecimal(r.executions, 0);
    select('#result-imd').textContent = formatDecimal(r.imd, 6);
    status.textContent = statusLabels[r.status];
    select('#status-icon').textContent = r.status === 'profit' ? '↗' : r.status === 'loss' ? '↘' : '=';
    const explanation = r.status === 'profit' ? '客户收费已覆盖本批填写的成本。'
      : r.status === 'loss' ? '客户收费尚未覆盖本批填写的成本。' : '客户收费与本批填写的成本相等。';
    select('#profit-explanation').textContent = explanation;
    const precisionNotes: string[] = [];
    if (isTinyNonZero(r.profit, 2)) precisionNotes.push('毛利绝对值小于 0.01 美元；盈亏状态按未舍入值判定。');
    if (isTinyNonZero(r.imd, 6)) precisionNotes.push('IMD 消耗大于 0 且小于 0.000001；显示值已舍入。');
    select('#precision-note').textContent = precisionNotes.join(' ');
    select('#precision-note').hidden = !precisionNotes.length;
    announcement = `${action}总成本 ${money(r.total)} 美元，毛利 ${money(r.profit)} 美元，${statusLabels[r.status]}。${precisionNotes.join(' ')}`;
  } else {
    // Also clear hidden numbers so stale results cannot be mistaken for a new estimate.
    results.querySelectorAll('[data-value]').forEach(element => { element.textContent = ''; });
    const count = Object.keys(calculation.errors).length;
    select('#error-summary').textContent = `有 ${count} 项输入需要修改。请按字段下方提示修正，结果会自动恢复。`;
    announcement = '计算已暂停。' + select('#error-summary').textContent;
  }
  clearTimeout(announcementTimer);
  if (announce) announcementTimer = setTimeout(() => { announcements.textContent = announcement; }, 350);
}

function setValues(values: Readonly<Inputs>, message: string): void {
  for (const id of fieldIds) inputs[id].value = values[id];
  inputMessage.textContent = message;
  update(true, `${message}。`);
}

form.addEventListener('input', () => {
  inputMessage.textContent = '修改任一数值，结果即刻更新。';
  update();
});
form.addEventListener('submit', event => { event.preventDefault(); update(); });
select('#load-example').addEventListener('click', () => setValues(example, '已载入示例 A，所有示例均为虚构数据。'));
select('#clear').addEventListener('click', () => setValues(zero, '已清空，所有输入与结果均已归零。'));
select('#fix-input').addEventListener('click', () => {
  fieldIds.map(id => inputs[id]).find(input => input.getAttribute('aria-invalid') === 'true')?.focus();
});

for (const id of fieldIds) inputs[id].value = example[id];
update(false);
