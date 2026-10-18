#!/usr/bin/env bash
# Compila el APK del combo (menú + juegos) en este host.
#
# Dos cosas que NO son obvias y están medidas:
#   1. Gradle 8.14.3 NO corre con el Java 26 del sistema ("Unsupported class file
#      major version 70"): hay que usar el JDK 21 propio.
#   2. La plataforma android-36 no viene en el SDK: se instala sin sudo.
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
export JAVA_HOME="${JAVA_HOME:-$HOME/.hermes/tools/jdk-21}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
ENTORNO="${1:-debug}"   # debug | release

if [[ ! -x "$JAVA_HOME/bin/java" ]]; then
  echo "No encuentro el JDK 21 en $JAVA_HOME." >&2
  echo "El java del sistema (26) no sirve para Gradle. Bajalo sin sudo:" >&2
  echo "  mkdir -p ~/.hermes/tools && cd ~/.hermes/tools" >&2
  echo "  curl -L -o jdk21.tar.gz 'https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse'" >&2
  echo "  tar xzf jdk21.tar.gz && mv jdk-21* jdk-21" >&2
  exit 1
fi

echo "1/4 construyendo el paquete web (combo)"
node "$RAIZ/tools/build.mjs" combo

echo "2/4 copiando el paquete dentro del proyecto Android"
cd "$RAIZ"
# `cap sync` (no `cap copy`): es el que además genera android/capacitor.settings.gradle.
# Ojo: si `cap add android` se corrió antes de existir dist/, ese archivo no se
# crea y Gradle falla con "Could not read script capacitor.settings.gradle".
npx cap sync android

echo "3/4 compilando el APK ($ENTORNO) con $(basename "$JAVA_HOME")"
cd "$RAIZ/android"
if [[ "$ENTORNO" == "release" ]]; then
  ./gradlew assembleRelease --no-daemon --console=plain
else
  ./gradlew assembleDebug --no-daemon --console=plain
fi

echo "4/4 APK"
find "$RAIZ/android/app/build/outputs/apk" -name "*.apk" -newermt '-30 minutes' -exec ls -la {} \;
echo
echo "Para instalarlo (tablet/celular conectado por USB):"
echo "  adb install -r $RAIZ/android/app/build/outputs/apk/$ENTORNO/app-$ENTORNO.apk"
