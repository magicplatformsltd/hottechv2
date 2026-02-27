"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { format } from "date-fns";

export function ExportReportButton() {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    const container = document.getElementById("report-container");
    if (!container) {
      alert("Report content not found.");
      return;
    }

    setExporting(true);
    try {
      const dataUrl = await toPng(container, {
        backgroundColor: "#0a0a0a",
        pixelRatio: 2,
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const pixelRatio = 2;
      const imgWidth = container.offsetWidth * pixelRatio;
      const imgHeight = container.offsetHeight * pixelRatio;
      const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight) * 0.95;
      const scaledWidth = imgWidth * ratio;
      const scaledHeight = imgHeight * ratio;
      const x = (pageWidth - scaledWidth) / 2;
      const y = (pageHeight - scaledHeight) / 2;

      pdf.addImage(dataUrl, "PNG", x, y, scaledWidth, scaledHeight);
      const dateStr = format(new Date(), "yyyy-MM-dd");
      pdf.save(`hot-tech-report-${dateStr}.pdf`);
    } catch (err) {
      console.error("[ExportReportButton]", err);
      alert("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={exporting}
      className="flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 font-sans text-sm text-hot-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download className="h-4 w-4 shrink-0" aria-hidden />
      {exporting ? "Exporting…" : "Export PDF"}
    </button>
  );
}
