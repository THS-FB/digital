#!/usr/bin/env bash
set -euo pipefail

PDF="assets/program/current-program.pdf"
COVER="assets/program/current-cover.jpg"
TMP_GS="/tmp/current-program-gs.pdf"
TMP_OPT="/tmp/current-program-optimized.pdf"
TMP_COVER_PREFIX="/tmp/current-cover"

if [[ ! -f "$PDF" ]]; then
  echo "Program PDF not found: $PDF"
  exit 1
fi

before_bytes=$(stat -c%s "$PDF")
before_pages=$(pdfinfo "$PDF" | awk '/^Pages:/ {print $2}')

echo "Original PDF: $before_bytes bytes, $before_pages pages"

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

after_bytes=$(stat -c%s "$TMP_OPT")
after_pages=$(pdfinfo "$TMP_OPT" | awk '/^Pages:/ {print $2}')

echo "Optimized PDF: $after_bytes bytes, $after_pages pages"

if [[ "$before_pages" != "$after_pages" ]]; then
  echo "Page-count validation failed; leaving original PDF unchanged."
  exit 1
fi

if (( after_bytes < before_bytes )); then
  cp "$TMP_OPT" "$PDF"
  echo "Replaced PDF with smaller web-optimized version."
else
  echo "Optimized PDF is not smaller; keeping original PDF."
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
