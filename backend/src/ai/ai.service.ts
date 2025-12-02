import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { UserContextService } from '../auth/user-context.service';

export interface GeneratedTask {
  name: string;
  description: string;
}

export interface GenerateTasksResponse {
  tasks: GeneratedTask[];
  summary: string;
}

// Token pricing per 1M tokens (as of 2024)
const TOKEN_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4': { input: 30, output: 60 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private userContext: UserContextService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  private calculateCost(
    model: string,
    promptTokens: number,
    completionTokens: number,
  ): number {
    const pricing = TOKEN_PRICING[model] || TOKEN_PRICING['gpt-4o-mini'];
    const inputCost = (promptTokens / 1_000_000) * pricing.input;
    const outputCost = (completionTokens / 1_000_000) * pricing.output;
    return inputCost + outputCost;
  }

  private async logUsage(params: {
    action: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    durationMs: number;
    status: 'success' | 'error';
    requestPayload?: any;
    responseSummary?: string;
    errorMessage?: string;
  }) {
    try {
      const userId = this.userContext.getUserId();
      const estimatedCost = this.calculateCost(
        params.model,
        params.promptTokens,
        params.completionTokens,
      );

      await this.prisma.ai_usage_logs.create({
        data: {
          user_id: userId || null,
          action: params.action,
          model: params.model,
          prompt_tokens: params.promptTokens,
          completion_tokens: params.completionTokens,
          total_tokens: params.totalTokens,
          estimated_cost: estimatedCost,
          duration_ms: params.durationMs,
          status: params.status,
          request_payload: params.requestPayload,
          response_summary: params.responseSummary,
          error_message: params.errorMessage,
        },
      });

      this.logger.log(
        `AI Usage logged: ${params.action} - ${params.totalTokens} tokens - $${estimatedCost.toFixed(6)}`,
      );
    } catch (error) {
      this.logger.error('Failed to log AI usage:', error);
      // Don't throw - logging failure shouldn't break the main flow
    }
  }

  async generateServiceTasks(
    customerDemand: string,
    bikeInfo?: { brand?: string; model?: string; year?: number },
  ): Promise<GenerateTasksResponse> {
    if (!this.openai) {
      this.logger.warn('OpenAI API key not configured');
      return {
        tasks: [],
        summary: 'AI service not configured',
      };
    }

    const bikeContext = bikeInfo
      ? `Xe: ${bikeInfo.brand || ''} ${bikeInfo.model || ''} ${bikeInfo.year || ''}`
      : '';

    const prompt = `Bạn là một kỹ thuật viên sửa chữa xe máy chuyên nghiệp tại Việt Nam.

Khách hàng yêu cầu: "${customerDemand}"
${bikeContext}

Hãy phân tích yêu cầu và tạo danh sách các công việc (tasks) cần thực hiện. Mỗi task cần có:
- name: Tên công việc ngắn gọn (tiếng Việt)
- description: Mô tả chi tiết công việc

Lưu ý:
- Không cần chia nhỏ quá mức vì đây là các thợ đã lành nghề, chỉ liệt kê các công việc chính.
- Nếu khách hàng muốn thay nhớt, thì chỉ cần liệt kê thay nhớt, không cần các tác vụ Kiểm tra, vì đây là các bước cơ bản
- Tránh lặp lại các công việc.
- Về zin: giữ nguyên định nghia "zin" trong mô tả nếu khách hàng yêu cầu.
- Không thêm công việc không liên quan đến yêu cầu của khách hàng.
- Kiểm tra kỹ yêu cầu để đảm bảo không bỏ sót công việc quan trọng nào.
- Description không cần quá dài, vì đây là mô tả cho kỹ thuật viên, chỉ cần đủ chi tiết để hiểu công việc.

Ví dụ:

Yêu cầu: "Về zin đèn, đồng hồ, lẫy số cho Moto2, làm sạch"
Kết quả có thể là:
{
  "tasks": [
    {
      "name": "Kiểm tra và phục hồi đèn zin",
      "description": "Check hệ thống đèn, thay thế đồ chơi bằng bóng đèn zin chính hãng."
    },
    {
      "name": "Kiểm tra và phục hồi đồng hồ zin",
      "description": "Check chức năng đồng hồ, thay thế đồ chơi bằng linh kiện zin chính hãng."
    },
    {
      "name": "Kiểm tra và phục hồi lẫy số zin",
      "description": "Check hoạt động của lẫy số, thay thế đồ chơi bằng bộ phận zin chính hãng."
    },
    {
      "name": "Rửa xe",
      "description": "Làm sạch toàn bộ xe máy, bao gồm rửa xe, lau chùi các chi tiết và bảo dưỡng cơ bản."
    }
  ],
  "summary": "Phục hồi các bộ phận zin theo yêu cầu của khách hàng và làm sạch xe máy."
  }

Trả về JSON với format:
{
  "tasks": [
    {
      "name": "Tên công việc",
      "description": "Mô tả chi tiết"
    }
  ],
  "summary": "Tóm tắt ngắn gọn về các công việc cần làm"
}
Chỉ trả về JSON, không có text khác.`;

    const model = 'gpt-4.1-mini';
    const startTime = Date.now();

    try {
      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'Bạn là trợ lý AI cho xưởng sửa chữa xe máy. Trả lời bằng JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const durationMs = Date.now() - startTime;
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const result = JSON.parse(content) as GenerateTasksResponse;
      this.logger.log(`Generated ${result.tasks.length} tasks for demand: "${customerDemand.substring(0, 50)}..."`);

      // Log successful usage
      await this.logUsage({
        action: 'generate_tasks',
        model,
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
        durationMs,
        status: 'success',
        requestPayload: { customerDemand: customerDemand.substring(0, 200), bikeInfo },
        responseSummary: `Generated ${result.tasks.length} tasks`,
      });

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      // Log failed usage
      await this.logUsage({
        action: 'generate_tasks',
        model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        durationMs,
        status: 'error',
        requestPayload: { customerDemand: customerDemand.substring(0, 200), bikeInfo },
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      this.logger.error('Failed to generate tasks:', error);
      throw error;
    }
  }
}
