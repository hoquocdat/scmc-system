import { apiClient } from './client';

export interface GeneratedTask {
  name: string;
  description: string;
}

export interface GenerateTasksResponse {
  tasks: GeneratedTask[];
  summary: string;
}

export interface GenerateTasksRequest {
  customer_demand: string;
  bike_brand?: string;
  bike_model?: string;
  bike_year?: number;
}

export const aiApi = {
  generateTasks: async (request: GenerateTasksRequest): Promise<GenerateTasksResponse> => {
    const response = await apiClient.post('/ai/generate-tasks', request);
    return response.data;
  },
};
