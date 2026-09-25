// All PDF coordinates are millimeters. Leave 10 mm for printer margins.
export function getCardLayout(widthCm, heightCm) {
  const width = widthCm * 10;
  const height = heightCm * 10;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 10 || height < 10 || width > 190 || height > 277) return null;
  const gap = 0;
  const columns = Math.floor((190 + gap + 1e-9) / (width + gap));
  const rows = Math.floor((277 + gap + 1e-9) / (height + gap));
  return {
    width, height, gap, columns, rows, perPage: columns * rows,
    left: (210 - columns * width - (columns - 1) * gap) / 2,
    top: (297 - rows * height - (rows - 1) * gap) / 2,
  };
}

export async function createCardsPdf(students, layout, renderCard, backImage, onProgress = () => {}, options = {}) {
  if (!students.length || !layout?.perPage) throw new Error("Nuk ka kartela ose përmasat janë të pavlefshme.");
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  pdf.setProperties({ title: "Bashkim Tours - Kartelat" });
  const { width, height, gap, columns, perPage, left, top } = layout;
  const drawCard = (image, slot, back = false) => {
    // Mirror columns for duplex printing with a long-edge flip, including partial sheets.
    const column = back ? columns - 1 - (slot % columns) : slot % columns;
    const x = options.centerSingle ? (210 - width) / 2 : left + column * (width + gap);
    const y = options.centerSingle ? (297 - height) / 2 : top + Math.floor(slot / columns) * (height + gap);
    pdf.addImage(image, "PNG", x, y, width, height, back ? "card-back" : undefined, "FAST");
    pdf.setDrawColor(175);
    pdf.setLineWidth(0.1);
    pdf.rect(x, y, width, height);
  };
  if (!backImage) throw new Error("Mungon fotoja e pasme e kartelës.");
  pdf.viewerPreferences({ Duplex: "DuplexFlipLongEdge" });
  for (let start = 0; start < students.length; start += perPage) {
    if (start) pdf.addPage();
    const count = Math.min(perPage, students.length - start);
    for (let slot = 0; slot < count; slot += 1) {
      drawCard(await renderCard(students[start + slot]), slot);
      onProgress(start + slot + 1);
    }
    pdf.addPage();
    for (let slot = 0; slot < count; slot += 1) drawCard(backImage, slot, true);
  }
  return pdf;
}
