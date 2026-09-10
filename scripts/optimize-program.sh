#!/usr/bin/env bash
set -euo pipefail

PDF="assets/program/current-program.pdf"
COVER="assets/program/current-cover.jpg"
TMP_GS="/tmp/current-program-gs.pdf"
TMP_OPT="/tmp/current-program-optimized.pdf"
TMP_QDF_BEFORE="/tmp/current-program-before-qdf.pdf"
TMP_QDF_AFTER="/tmp/current-program-after-qdf.pdf"
TMP_COVER_PREFIX="/tmp/current-cover"
SKIP_RECOMPRESS_BELOW=5000000

if [[ ! -f "$PDF" ]]; then
  echo "Program PDF not found: $PDF"
  exit 1
fi

before_bytes=$(stat -c%s "$PDF")
before_pages=$(pdfinfo "$PDF" | awk '/^Pages:/ {print $2}')

echo "Original PDF: $before_bytes bytes, $before_pages pages"
qpdf --check "$PDF"

if (( before_bytes > SKIP_RECOMPRESS_BELOW )); then
  qpdf --qdf --object-streams=disable "$PDF" "$TMP_QDF_BEFORE"
  before_links=$(grep -a -c '/Subtype /Link' "$TMP_QDF_BEFORE" || true)
  echo "Link annotations before optimization: $before_links"

  gs \
    -sDEVICE=pdfwrite \
    -dCompatibilityLevel=1.7 \
    -dNOPAUSE \
    -dQUIET \
    -dBATCH \
    -dDetectDuplicateImages=true \
    -dCompressFonts=true \
    -dSubsetFonts=true \
    -dAutoFilterColorImages=false \
    -dColorImageFilter=/DCTEncode \
    -dDownsampleColorImages=true \
    -dColorImageDownsampleType=/Bicubic \
    -dColorImageResolution=170 \
    -dAutoFilterGrayImages=false \
    -dGrayImageFilter=/DCTEncode \
    -dDownsampleGrayImages=true \
    -dGrayImageDownsampleType=/Bicubic \
    -dGrayImageResolution=170 \
    -dDownsampleMonoImages=true \
    -dMonoImageDownsampleType=/Subsample \
    -dMonoImageResolution=300 \
    -dJPEGQ=85 \
    -sOutputFile="$TMP_GS" \
    "$PDF"

  qpdf --linearize "$TMP_GS" "$TMP_OPT"
  qpdf --check "$TMP_OPT"

  after_bytes=$(stat -c%s "$TMP_OPT")
  after_pages=$(pdfinfo "$TMP_OPT" | awk '/^Pages:/ {print $2}')

  qpdf --qdf --object-streams=disable "$TMP_OPT" "$TMP_QDF_AFTER"
  after_links=$(grep -a -c '/Subtype /Link' "$TMP_QDF_AFTER" || true)

  echo "Optimized PDF: $after_bytes bytes, $after_pages pages"
  echo "Link annotations after optimization: $after_links"

  if [[ "$before_pages" != "$after_pages" ]]; then
    echo "Page-count validation failed; leaving original PDF unchanged."
    exit 1
  fi

  if (( after_links < before_links )); then
    echo "Link-annotation validation failed; leaving original PDF unchanged."
    exit 1
  fi

  if (( after_bytes < before_bytes )); then
    cp "$TMP_OPT" "$PDF"
    echo "Replaced PDF with smaller web-optimized version."
  else
    echo "Optimized PDF is not smaller; keeping original PDF."
  fi
else
  echo "PDF is already under $SKIP_RECOMPRESS_BELOW bytes; skipping lossy recompression."
fi

rm -f "${TMP_COVER_PREFIX}.jpg"
pdftoppm \
  -f 1 \
  -singlefile \
  -jpeg \
  -r 120 \
  -jpegopt quality=84,progressive=y,optimize=y \
  "$PDF" \
  "$TMP_COVER_PREFIX"

cp "${TMP_COVER_PREFIX}.jpg" "$COVER"
cover_bytes=$(stat -c%s "$COVER")
final_bytes=$(stat -c%s "$PDF")

echo "Final PDF: $final_bytes bytes"
echo "Cover preview: $cover_bytes bytes"
