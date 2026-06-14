#!/usr/bin/env bash
# Run this on macOS to produce icon.icns from the iconset.
# Requires: macOS (iconutil is built-in)
set -e
cd "$(dirname "$0")"
iconutil -c icns icon.iconset -o icon.icns
echo "icon.icns created"
