"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, Check, FileSpreadsheet } from "lucide-react";
import { bulkImportTrackings } from "@/actions/tracking-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId: string;
}

interface ParsedRow {
  companyName: string;
  companyType: string;
  contactName: string;
  contactEmail: string;
  interestLevel: string;
}

function downloadTemplate() {
  const headers = "Company,Type,Contact Name,Contact Email,Interest Level";
  const example1 = "Example Corp,Investor,John Smith,john@example.com,WARM";
  const example2 = "Advisory Ltd,Advisor,Jane Doe,jane@advisory.com,HOT";
  const csv = [headers, example1, example2].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/);
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(",").map((s) => s.trim());
    if (!parts[0]) continue;

    rows.push({
      companyName: parts[0] || "",
      companyType: parts[1] || "Investor",
      contactName: parts[2] || "",
      contactEmail: parts[3] || "",
      interestLevel: parts[4] || "NONE",
    });
  }

  return rows;
}

const INTEREST_COLORS: Record<string, string> = {
  HOT: "destructive",
  WARM: "default",
  COLD: "secondary",
  NONE: "outline",
};

export function ImportDialog({ open, onOpenChange, assetId }: ImportDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; total: number } | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = parseCSV(text);
      setParsedRows(rows);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (parsedRows.length === 0) return;

    setImporting(true);
    try {
      const res = await bulkImportTrackings(
        assetId,
        parsedRows.map((r) => ({
          companyName: r.companyName,
          companyType: r.companyType,
          contactName: r.contactName || undefined,
          contactEmail: r.contactEmail || undefined,
          interestLevel: r.interestLevel || undefined,
        }))
      );
      setResult(res);
      toast.success(`Successfully imported ${res.imported} companies`);
      router.refresh();
    } catch (error) {
      toast.error("Failed to import companies");
    } finally {
      setImporting(false);
    }
  }

  function handleClose(open: boolean) {
    if (!open) {
      setParsedRows([]);
      setFileName("");
      setResult(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Bulk Import Companies
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to import multiple companies into this asset&apos;s pipeline at once.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/30">
              <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">
                {result.imported} of {result.total} companies imported
              </p>
              {result.imported < result.total && (
                <p className="text-sm text-muted-foreground mt-1">
                  {result.total - result.imported} were skipped (duplicates or errors)
                </p>
              )}
            </div>
            <Button variant="outline" onClick={() => handleClose(false)}>
              Close
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {/* Step 1: Download template */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">1. Download Template</p>
                  <p className="text-sm text-muted-foreground">
                    Get the CSV template with required headers and example rows
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  Template
                </Button>
              </div>

              {/* Step 2: Upload file */}
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">2. Upload CSV</p>
                    <p className="text-sm text-muted-foreground">
                      Headers: Company, Type, Contact Name, Contact Email, Interest Level
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {fileName || "Choose File"}
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Preview table */}
              {parsedRows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {parsedRows.length} companies to import
                  </p>
                  <div className="rounded-lg border overflow-auto max-h-[300px]">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="text-left p-2 font-medium">Company</th>
                          <th className="text-left p-2 font-medium">Type</th>
                          <th className="text-left p-2 font-medium">Contact</th>
                          <th className="text-left p-2 font-medium">Email</th>
                          <th className="text-left p-2 font-medium">Interest</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.map((row, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-2">{row.companyName}</td>
                            <td className="p-2">{row.companyType}</td>
                            <td className="p-2">{row.contactName}</td>
                            <td className="p-2">{row.contactEmail}</td>
                            <td className="p-2">
                              <Badge
                                variant={
                                  (INTEREST_COLORS[row.interestLevel.toUpperCase()] ||
                                    "outline") as any
                                }
                              >
                                {row.interestLevel}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={parsedRows.length === 0 || importing}
              >
                {importing ? "Importing..." : "Confirm Import"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
