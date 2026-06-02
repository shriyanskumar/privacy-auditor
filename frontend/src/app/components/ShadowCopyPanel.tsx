import { useMemo } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

type ShadowCopy = {
  id: number;
  file_path: string;
  filename: string;
  file_size: number;
  detected_pattern: string;
  file_extension: string;
  severity: string;
  detected_at: string;
};

type ShadowCopyPanelProps = {
  shadowCopies: ShadowCopy[];
  loading: boolean;
  error: string | null;
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

const formatTimestamp = (value?: string | null) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const patternLabels: Record<string, string> = {
  final: "Final version",
  backup: "Backup copy",
  copy: "Copy marker",
  old: "Old/previous",
  version: "Version number",
  numbered_copy: "Numbered copy",
  date_suffix: "Date suffix",
  archive: "Archive",
  unknown: "Unknown pattern",
};

export function ShadowCopyPanel({
  shadowCopies,
  loading,
  error,
}: ShadowCopyPanelProps) {
  const stats = useMemo(() => {
    const byPattern = shadowCopies.reduce(
      (acc: Record<string, number>, copy) => {
        const key = copy.detected_pattern;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {},
    );

    const byExtension = shadowCopies.reduce(
      (acc: Record<string, number>, copy) => {
        const key = copy.file_extension || "unknown";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {},
    );

    const totalSize = shadowCopies.reduce((sum, copy) => sum + copy.file_size, 0);

    return { byPattern, byExtension, totalSize };
  }, [shadowCopies]);

  return (
    <Card className="border-[#424242] bg-[#050505]/80">
      <CardHeader>
        <CardTitle className="text-white text-2xl">
          Shadow Copy Detector
        </CardTitle>
        <CardDescription>
          Identify duplicate and backup files that may contain sensitive data.
          These are often overlooked copies that increase privacy risk.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-xl border border-[#2A2A2A] bg-white/5 p-10 text-center text-[#A6A6A6]">
            Loading shadow copies...
          </div>
        ) : shadowCopies.length === 0 ? (
          <div className="rounded-xl border border-[#2A2A2A] bg-white/5 p-10 text-center text-[#A6A6A6]">
            No shadow copies detected in this scan.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-[#2A2A2A] bg-black/50 p-4">
                <div className="text-[#A6A6A6] text-sm mb-1">Total copies</div>
                <div className="text-white text-2xl font-semibold">
                  {shadowCopies.length}
                </div>
              </div>
              <div className="rounded-lg border border-[#2A2A2A] bg-black/50 p-4">
                <div className="text-[#A6A6A6] text-sm mb-1">Total size</div>
                <div className="text-white text-2xl font-semibold">
                  {formatFileSize(stats.totalSize)}
                </div>
              </div>
              <div className="rounded-lg border border-[#2A2A2A] bg-black/50 p-4">
                <div className="text-[#A6A6A6] text-sm mb-1">
                  Detected patterns
                </div>
                <div className="text-white text-2xl font-semibold">
                  {Object.keys(stats.byPattern).length}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="text-[#E8E8E8] text-sm font-semibold mb-2">
                  Pattern breakdown
                </h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.byPattern).map(([pattern, count]) => (
                    <div
                      key={pattern}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A2A] bg-black/50 px-3 py-1.5"
                    >
                      <span className="text-[#A6A6A6] text-xs">
                        {patternLabels[pattern] || pattern}:
                      </span>
                      <span className="text-white text-xs font-semibold">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-[#E8E8E8] text-sm font-semibold mb-2">
                  File type breakdown
                </h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.byExtension).map(([ext, count]) => (
                    <div
                      key={ext}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A2A] bg-black/50 px-3 py-1.5"
                    >
                      <span className="text-[#A6A6A6] text-xs">{ext}:</span>
                      <span className="text-white text-xs font-semibold">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[#2A2A2A] bg-black/30">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Filename</TableHead>
                    <TableHead>Pattern detected</TableHead>
                    <TableHead>File size</TableHead>
                    <TableHead>Extension</TableHead>
                    <TableHead>Found at</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shadowCopies.map((copy) => (
                    <TableRow key={copy.id}>
                      <TableCell className="max-w-[280px] overflow-hidden text-ellipsis whitespace-nowrap text-sm text-[#E8E8E8]">
                        {copy.filename}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {patternLabels[copy.detected_pattern] || copy.detected_pattern}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-[#C6C6C6]">
                        {formatFileSize(copy.file_size)}
                      </TableCell>
                      <TableCell className="text-sm text-[#C6C6C6]">
                        {copy.file_extension}
                      </TableCell>
                      <TableCell className="text-xs text-[#8B8B8B]">
                        {formatTimestamp(copy.detected_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
