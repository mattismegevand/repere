#!/bin/bash
echo "=== Lines of Code ==="
echo "Source"
for ext in ts tsx css; do
  count=$(find src -name "*.$ext" -exec cat {} + 2>/dev/null | wc -l)
  printf "%6d  .%s\n" $count $ext
done
src_total=$(find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.css" \) -exec cat {} + | wc -l)
printf "%6d  source total\n" $src_total
echo "------"
echo "Tests"
for ext in ts tsx css; do
  count=$(find tests -name "*.$ext" -exec cat {} + 2>/dev/null | wc -l)
  printf "%6d  .%s\n" $count $ext
done
test_total=$(find tests -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.css" \) -exec cat {} + 2>/dev/null | wc -l)
printf "%6d  test total\n" $test_total
echo "------"
grand_total=$((src_total + test_total))
printf "%6d  total\n" $grand_total
