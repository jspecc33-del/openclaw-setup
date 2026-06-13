#!/bin/bash
# Binary analysis script for .so files
# Usage: ./analyze_binary.sh <path-to-target.so>

if [ $# -eq 0 ]; then
    echo "Usage: $0 <path-to-target.so>"
    echo "Example: $0 ./target.so"
    exit 1
fi

TARGET_FILE="$1"

if [ ! -f "$TARGET_FILE" ]; then
    echo "Error: File '$TARGET_FILE' not found"
    exit 1
fi

echo "=========================================="
echo "Binary Analysis: $TARGET_FILE"
echo "=========================================="

# Extract strings
echo ""
echo "=== Extracting strings (min length 6) ==="
strings -n 6 "$TARGET_FILE" > strings_out.txt
echo "Strings saved to strings_out.txt ($(wc -l < strings_out.txt) lines)"

# Dynamic symbols
echo ""
echo "=== Dynamic symbols (exported) ==="
nm -D "$TARGET_FILE"

# Quick disassembly check
echo ""
echo "=== Disassembly (first 200 lines) ==="
objdump -d "$TARGET_FILE" | head -200

# Full ELF analysis
echo ""
echo "=== ELF Header & Sections ==="
readelf -a "$TARGET_FILE"

echo ""
echo "=========================================="
echo "Analysis complete!"
echo "=========================================="
