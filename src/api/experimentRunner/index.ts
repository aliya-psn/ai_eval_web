import { experimentRunnerRequest } from './request';
import { getLangfuseProjectName, loadLangfuseProjectName } from '@/api/langfuse';
import type { ExperimentJobRunRequest, ExperimentJobRunResult } from '@/types/dataset';

export const experimentRunnerApi = {
  /**
   * POST /api/runner/experiment-jobs/run — 提交实验执行任务
   * workspace 使用 Langfuse 项目名（应用初始化时已预加载，未命中再补拉）
   */
  runExperimentJob: async (
    data: ExperimentJobRunRequest,
  ): Promise<ExperimentJobRunResult> => {
    const workspace =
      data.workspace?.trim() ||
      getLangfuseProjectName() ||
      (await loadLangfuseProjectName());
    return experimentRunnerRequest({
      path: '/api/runner/experiment-jobs/run',
      method: 'POST',
      body: { ...data, workspace },
    });
  },
};
