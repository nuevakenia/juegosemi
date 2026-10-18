#!/usr/bin/env bash
# Verificación completa del proyecto, en el orden que importa:
#   1. los tests (lógica y contenido)
#   2. el typecheck
#   3. el build del combo
#   4. el APK, cuando se pide (--apk)
#
# Una suite verde no prueba nada por sí sola: acá también se comprueba que el
# paquete web quede armado y que el APK siga sin nada de Google adentro.
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
cd "$RAIZ"

echo "── 1. tests ────────────────────────────────────────────────────"
./node_modules/.bin/vitest run

echo
echo "── 2. typecheck ────────────────────────────────────────────────"
./node_modules/.bin/tsc -p tsconfig.json --noEmit

echo
echo "── 3. build del combo ──────────────────────────────────────────"
node tools/build.mjs combo

echo
echo "── 4. el paquete no debe pedir nada de Google ──────────────────"
if grep -ril "googleapis\|gstatic\|play.google" dist/ >/dev/null 2>&1; then
  echo "OJO: aparecen referencias a Google en dist/:" >&2
  grep -ril "googleapis\|gstatic\|play.google" dist/ >&2
  exit 1
fi
echo "OK: dist/ sin referencias a Google"

if [[ "${1:-}" == "--apk" ]]; then
  echo
  echo "── 5. APK ──────────────────────────────────────────────────────"
  bash tools/compilar-apk.sh
  APK="android/app/build/outputs/apk/debug/app-debug.apk"
  A="$ANDROID_HOME/build-tools/36.0.0"
  A="${A:-$HOME/Android/Sdk/build-tools/36.0.0}"
  echo "── el APK no debe traer GMS ────────────────────────────────────"
  if unzip -l "$APK" | grep -iqE "gms|firebase"; then
    echo "OJO: el APK trae librerías de Google" >&2
    unzip -l "$APK" | grep -iE "gms|firebase" >&2
    exit 1
  fi
  echo "OK: APK sin librerías de Google"
  ls -la "$APK"
fi

echo
echo "verificación terminada"
