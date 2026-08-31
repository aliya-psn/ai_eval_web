export type MockEvaluatorType = string;
export type MockEvaluatorStatus = 'active' | 'inactive';

export interface MockEvaluator {
  id: string;
  name: string;
  type: MockEvaluatorType;
  status: MockEvaluatorStatus;
  description?: string;
  prompt?: string;
  createdAt: string;
  updatedAt: string;
}

export type MockEvaluatorInput = {
  name: string;
  type: MockEvaluatorType;
  status: MockEvaluatorStatus;
  description?: string;
  prompt?: string;
};

const now = () => new Date().toISOString();

let seed = 3;

function nextId() {
  seed += 1;
  return `eval-mock-${seed}`;
}

/** 内存 mock 数据，刷新页面会重置 */
let store: MockEvaluator[] = [
  {
    id: 'eval-mock-1',
    name: '相关性评估',
    type: 'llm_as_judge',
    status: 'active',
    description: '评估回答与问题的相关性',
    prompt:
      '请评估回答与用户问题的相关性，给出 0-1 分。\n问题：{{input}}\n回答：{{output}}',
    createdAt: '2026-07-20T08:00:00.000Z',
    updatedAt: '2026-07-28T10:30:00.000Z',
  },
  {
    id: 'eval-mock-2',
    name: '事实准确性',
    type: 'llm_as_judge',
    status: 'active',
    description: '检查回答是否包含事实错误',
    prompt:
      '判断回答是否事实准确。\n上下文：{{input}}\n回答：{{output}}\n请返回布尔结果。',
    createdAt: '2026-07-22T09:15:00.000Z',
    updatedAt: '2026-07-30T14:00:00.000Z',
  },
  {
    id: 'eval-mock-3',
    name: '格式校验',
    type: 'code',
    status: 'inactive',
    description: '用代码校验输出格式是否合法',
    prompt: '',
    createdAt: '2026-07-25T11:20:00.000Z',
    updatedAt: '2026-08-01T16:45:00.000Z',
  },
];

function delay(ms = 200) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockEvaluatorStore = {
  async list(): Promise<MockEvaluator[]> {
    await delay();
    return store.map((item) => ({ ...item }));
  },

  async create(input: MockEvaluatorInput): Promise<MockEvaluator> {
    await delay();
    const ts = now();
    const created: MockEvaluator = {
      id: nextId(),
      name: input.name.trim(),
      type: input.type,
      status: input.status,
      description: input.description?.trim() || '',
      prompt: input.prompt?.trim() || '',
      createdAt: ts,
      updatedAt: ts,
    };
    store = [created, ...store];
    return { ...created };
  },

  async update(id: string, input: MockEvaluatorInput): Promise<MockEvaluator> {
    await delay();
    const index = store.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('Evaluator not found');
    const current = store[index];
    const updated: MockEvaluator = {
      ...current,
      name: input.name.trim(),
      type: input.type,
      status: input.status,
      description: input.description?.trim() || '',
      prompt: input.prompt?.trim() || '',
      updatedAt: now(),
    };
    store = store.map((item, i) => (i === index ? updated : item));
    return { ...updated };
  },

  async remove(id: string): Promise<void> {
    await delay();
    store = store.filter((item) => item.id !== id);
  },
};
