export interface IJobInfo {
  jobName?: string | undefined;
  status?: string | undefined;
  completionTime?: string | undefined;
  failureReason?: string | undefined;
  podName?: string | undefined;
  containerOverrides?: any[] | undefined;
}
