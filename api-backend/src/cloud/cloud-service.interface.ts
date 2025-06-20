export interface ICloudService {
  runTask(input: IRunTaskInput): Promise<string>;
  stopTask(taskId: string): Promise<void>;
  syncTaskStatus(): Promise<void>;
}

export interface IRunTaskInput {
  command: string[];
  containerName?: string;
  image?: string;
  taskDefinition?: string;
  taskCount?: number;
  resourceRequests?: {
    cpu: string;
    memory: string;
  };
  resourceLimits?: {
    cpu: string;
    memory: string;
  };
}
