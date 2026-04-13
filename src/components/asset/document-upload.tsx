"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Copy, Check, RefreshCw, ExternalLink } from "lucide-react";
import { uploadDocument } from "@/actions/document-actions";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const DOC_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  SIGNED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  EXPIRED: "bg-gray-100 text-gray-500",
};

interface DocumentUploadProps {
  trackingId: string;
  stages: Array<{ id: string; key: string; label: string }>;
  documents: Array<any>;
  editable: boolean;
}

export function DocumentUpload({ trackingId, stages, documents, editable }: DocumentUploadProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedStageId, setSelectedStageId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedStageId) {
      toast.error("Select a stage and choose a file");
      return;
    }
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are accepted");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("trackingId", trackingId);
      formData.append("stageId", selectedStageId);

      const result = await uploadDocument(formData);
      toast.success("Document uploaded");

      // Copy signing link
      const baseUrl = window.location.origin;
      await navigator.clipboard.writeText(`${baseUrl}${result.signingUrl}`);
      toast.success("Signing link copied to clipboard");

      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function copyLink(token: string, docId: string) {
    const baseUrl = window.location.origin;
    await navigator.clipboard.writeText(`${baseUrl}/sign/${token}`);
    setCopiedId(docId);
    toast.success("Signing link copied");
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Upload form */}
      {editable && (
        <div className="space-y-3 rounded-md border border-dashed p-3">
          <Label className="text-xs font-medium">Upload document for signing</Label>
          <div className="flex gap-2">
            <Select value={selectedStageId} onValueChange={setSelectedStageId}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Select stage..." />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                onChange={handleUpload}
                className="hidden"
                id="doc-upload"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-full text-xs"
                disabled={uploading || !selectedStageId}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="mr-1.5 h-3 w-3" />
                {uploading ? "Uploading..." : "Choose PDF"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Document list */}
      {documents.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-4">No documents yet</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc: any) => {
            const activeToken = doc.signingTokens?.[0]?.token;
            return (
              <div key={doc.id} className="rounded-md border p-3 text-sm space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium">{doc.fileName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {doc.stage.label} &middot; Uploaded {formatDate(doc.createdAt)} by {doc.uploadedBy.name}
                      </p>
                    </div>
                  </div>
                  <Badge className={cn("text-[10px] border-0", DOC_STATUS_COLORS[doc.status])}>
                    {doc.status}
                  </Badge>
                </div>

                {doc.status === "SIGNED" && (
                  <div className="rounded bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700">
                    Signed by {doc.signedByName} ({doc.signedByEmail}) on {formatDate(doc.signedAt)}
                  </div>
                )}

                {doc.status === "REJECTED" && doc.rejectionReason && (
                  <div className="rounded bg-red-50 px-2 py-1.5 text-xs text-red-700">
                    Declined: {doc.rejectionReason}
                  </div>
                )}

                {doc.status === "PENDING" && activeToken && editable && (
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] flex-1"
                      onClick={() => copyLink(activeToken, doc.id)}
                    >
                      {copiedId === doc.id ? (
                        <><Check className="mr-1 h-3 w-3" />Copied!</>
                      ) : (
                        <><Copy className="mr-1 h-3 w-3" />Copy signing link</>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px]"
                      onClick={() => window.open(`/sign/${activeToken}`, "_blank")}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
