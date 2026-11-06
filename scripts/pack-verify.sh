#!/usr/bin/env bash
# Pack the npm tarball into OUT_DIR and verify its identity and contents.
#
# publish.yaml runs this on the release tag before staging, and build.yml runs
# it on every push so a packaging defect fails before a release tag exists.
#
# Usage: scripts/pack-verify.sh EXPECTED_NAME EXPECTED_VERSION OUT_DIR
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "usage: $0 EXPECTED_NAME EXPECTED_VERSION OUT_DIR" >&2
  exit 2
fi
EXPECTED_NAME="$1"
EXPECTED_VERSION="$2"
OUT_DIR="$3"

mkdir "$OUT_DIR"
npm pack --json --ignore-scripts \
  --pack-destination "$OUT_DIR" > "$OUT_DIR/PACK.json"

shopt -s nullglob
TARBALLS=("$OUT_DIR"/*.tgz)
shopt -u nullglob
if [[ "${#TARBALLS[@]}" -ne 1 ]]; then
  echo "::error::Expected exactly one package tarball, found ${#TARBALLS[@]}"
  exit 1
fi
TARBALL="${TARBALLS[0]}"

if [[ "$(jq 'length' "$OUT_DIR/PACK.json")" -ne 1 ]]; then
  echo "::error::npm pack did not report exactly one package"
  exit 1
fi
PACK_NAME="$(jq -r '.[0].name' "$OUT_DIR/PACK.json")"
PACK_VERSION="$(jq -r '.[0].version' "$OUT_DIR/PACK.json")"
PACK_FILENAME="$(jq -r '.[0].filename' "$OUT_DIR/PACK.json")"
if [[ "$PACK_NAME" != "$EXPECTED_NAME" ||
      "$PACK_VERSION" != "$EXPECTED_VERSION" ||
      "$PACK_FILENAME" != "$(basename "$TARBALL")" ]]; then
  echo "::error::npm pack reported an unexpected package identity"
  exit 1
fi

EMBEDDED_PACKAGE_JSON="$(tar -xOf "$TARBALL" package/package.json)"
EMBEDDED_NAME="$(jq -r '.name' <<< "$EMBEDDED_PACKAGE_JSON")"
EMBEDDED_VERSION="$(jq -r '.version' <<< "$EMBEDDED_PACKAGE_JSON")"
if [[ "$EMBEDDED_NAME" != "$EXPECTED_NAME" ||
      "$EMBEDDED_VERSION" != "$EXPECTED_VERSION" ]]; then
  echo "::error::The tarball contains an unexpected package identity"
  exit 1
fi

tar -tzf "$TARBALL" | LC_ALL=C sort > "$OUT_DIR/CONTENTS.txt"
EXPECTED_CONTENTS=$'package/LICENSE\npackage/README.md\npackage/index.d.ts\npackage/index.js\npackage/package.json'
if [[ "$(< "$OUT_DIR/CONTENTS.txt")" != "$EXPECTED_CONTENTS" ]]; then
  echo "::error::The npm tarball does not contain exactly the approved files"
  cat "$OUT_DIR/CONTENTS.txt"
  exit 1
fi
