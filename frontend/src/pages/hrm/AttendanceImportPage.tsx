import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { payrollApi } from '@/lib/api/payroll';
import { attendanceApi, type AttendanceImportLog } from '@/lib/api/attendance';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { PayrollPeriodStatusBadge } from '@/components/payroll/PayrollPeriodStatusBadge';

const formatDate = (date: string | Date | undefined | null) => {
  if (!date) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export function AttendanceImportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [clearExisting, setClearExisting] = useState(true);

  // Fetch period details
  const { data: period, isLoading: isLoadingPeriod } = useQuery({
    queryKey: ['payroll-period', id],
    queryFn: () => payrollApi.getPeriod(id!),
    enabled: !!id,
  });

  // Fetch import logs
  const { data: importLogs = [] } = useQuery({
    queryKey: ['attendance-import-logs', id],
    queryFn: () => attendanceApi.getImportLogs(id!),
    enabled: !!id,
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: () => attendanceApi.import(id!, selectedFile!, clearExisting),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-import-logs', id] });
      queryClient.invalidateQueries({ queryKey: ['payroll-period', id] });
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      if (result.summary.errorRows > 0) {
        toast.warning(`Đã nhập ${result.summary.successfulRows} dòng, ${result.summary.errorRows} lỗi`);
      } else {
        toast.success(`Đã nhập ${result.summary.successfulRows} dòng chấm công`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
      ];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
        toast.error('Vui lòng chọn file Excel (.xlsx, .xls) hoặc CSV');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleImport = () => {
    if (!selectedFile) return;
    importMutation.mutate();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-600 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Hoàn thành</Badge>;
      case 'failed':
        return <Badge variant="destructive">Thất bại</Badge>;
      case 'processing':
        return <Badge className="bg-yellow-100 text-yellow-800">Đang xử lý</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoadingPeriod) {
    return <div className="p-8 text-center">Đang tải...</div>;
  }

  if (!period) {
    return <div className="p-8 text-center">Không tìm thấy kỳ lương</div>;
  }

  const canImport = period.status === 'draft';

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/hrm/payroll/${id}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold">Nhập Chấm Công</h1>
            <PayrollPeriodStatusBadge status={period.status} />
          </div>
          <p className="text-muted-foreground">{period.period_name}</p>
        </div>
      </div>

      {!canImport && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <span className="text-yellow-800">
            Chỉ có thể nhập chấm công khi kỳ lương ở trạng thái Nháp
          </span>
        </div>
      )}

      {/* Upload Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Tải lên file chấm công
          </CardTitle>
          <CardDescription>
            Hỗ trợ file Excel (.xlsx, .xls) hoặc CSV theo định dạng mẫu
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">Chọn file</Label>
            <Input
              id="file"
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              disabled={!canImport}
            />
          </div>

          {selectedFile && (
            <div className="p-3 bg-muted rounded-lg flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <div className="font-medium">{selectedFile.name}</div>
                <div className="text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              >
                Xóa
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="clear-existing"
                checked={clearExisting}
                onCheckedChange={setClearExisting}
                disabled={!canImport}
              />
              <Label htmlFor="clear-existing" className="text-sm">
                Xóa dữ liệu chấm công cũ trước khi nhập
              </Label>
            </div>
          </div>

          <Button
            onClick={handleImport}
            disabled={!selectedFile || !canImport || importMutation.isPending}
            className="w-full"
          >
            {importMutation.isPending ? 'Đang nhập...' : 'Nhập Chấm Công'}
          </Button>
        </CardContent>
      </Card>

      {/* Import History */}
      <Card>
        <CardHeader>
          <CardTitle>Lịch sử nhập</CardTitle>
        </CardHeader>
        <CardContent>
          {importLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Chưa có lịch sử nhập chấm công
            </div>
          ) : (
            <div className="space-y-3">
              {importLogs.map((log: AttendanceImportLog) => (
                <div
                  key={log.id}
                  className="p-4 border rounded-lg flex items-start gap-4"
                >
                  <div className="mt-1">{getStatusIcon(log.status)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{log.file_name}</span>
                      {getStatusBadge(log.status)}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>
                        Nhập bởi: {log.user_profiles?.full_name || 'N/A'}
                      </div>
                      <div>Thời gian: {formatDate(log.created_at)}</div>
                      <div>Kích thước: {formatFileSize(log.file_size)}</div>
                      {log.status === 'completed' && (
                        <div className="flex gap-4 mt-2">
                          <span className="text-green-600">
                            {log.successful_rows} thành công
                          </span>
                          {(log.warning_rows || 0) > 0 && (
                            <span className="text-yellow-600">
                              {log.warning_rows} cảnh báo
                            </span>
                          )}
                          {(log.error_rows || 0) > 0 && (
                            <span className="text-red-600">
                              {log.error_rows} lỗi
                            </span>
                          )}
                        </div>
                      )}
                      {log.status === 'failed' && log.error_message && (
                        <div className="text-red-600 mt-2">
                          Lỗi: {log.error_message}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
