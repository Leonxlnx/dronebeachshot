# Native EGL options

Inspection date: 2026-09-05. Scope: native libraries only; no browser or window server used. No packages installed or source changes made during this inspection.

## Recommended route

Use the bundled ANGLE OpenGL backend over Mesa's surfaceless EGL implementation. The native addon already creates a pbuffer; its missing piece is explicit surfaceless display selection plus Mesa EGL runtime libraries.

Local evidence:

- `binding/egl_context_wrapper.cc` currently tries ANGLE's default display and then `eglGetDisplay(EGL_DEFAULT_DISPLAY)` on Linux x64. It does not specify a native platform. The root agent's default probe failed opening the default X display.
- `libGLESv2.so` includes `rx::DisplayGLX` and `rx::DisplayEGL` symbols and the runtime library name `libEGL.so.1`.
- A read-only `eglQueryString(EGL_NO_DISPLAY, EGL_EXTENSIONS)` query against the bundled libraries advertised `EGL_MESA_platform_surfaceless`, `EGL_ANGLE_platform_angle_opengl`, and `EGL_ANGLE_platform_angle_device_type_egl_angle`.
- That query did **not** advertise ANGLE Vulkan or SwiftShader platform extensions; `nm -C` found no `DisplayVk` or `RendererVk` symbols. General Vulkan validation strings in the binary do not establish a usable Vulkan backend.
- Installed Mesa 25.2.8 software rendering is available: `swrast_dri.so` links to `libdril_dri.so`; the matching `libgallium-25.2.8-0ubuntu0.24.04.2.so` and LLVM 20 are installed.

## Concrete initialization change

For Linux, supply these native EGL display attributes before `EGL_NONE`:

```cpp
EGLAttrib attrs[] = {
    EGL_PLATFORM_ANGLE_TYPE_ANGLE, EGL_PLATFORM_ANGLE_TYPE_OPENGL_ANGLE,
    EGL_PLATFORM_ANGLE_NATIVE_PLATFORM_TYPE_ANGLE, EGL_PLATFORM_SURFACELESS_MESA,
    EGL_NONE
};
EGLDisplay d = eglGetPlatformDisplay(EGL_PLATFORM_ANGLE_ANGLE, nullptr, attrs);
```

Local headers define the native-platform key as `0x348F`, surfaceless as `0x31DD`, and OpenGL backend as `0x320D`. OpenGL ES backend `0x320E` is an alternative. Preserve the existing config/context/pbuffer creation flow. Upstream [ANGLE display selection](https://chromium.googlesource.com/angle/angle/+/HEAD/src/libANGLE/Display.cpp) routes the surfaceless native platform to `DisplayEGL`. Its `ANGLE_DEFAULT_PLATFORM=gl` setting alone chooses a backend but does not supply the missing native platform.

## Required official Ubuntu packages

The following exact package names, sizes and hashes were read directly from Ubuntu's HTTPS `Packages.xz` indexes for noble and noble-updates. Index signatures were not independently verified in this inspection.

| Package | Download | Bytes | SHA256 |
|---|---|---:|---|
| libegl1 1.7.0-1build1 | [Official .deb](https://archive.ubuntu.com/ubuntu/pool/main/libg/libglvnd/libegl1_1.7.0-1build1_amd64.deb) | 28670 | `e549f7776216f7bd3b1c216729fb40a97a562e2eb7c563cde632b4931f9a4e57` |
| libegl-mesa0 25.2.8-0ubuntu0.24.04.2 | [Official .deb](https://archive.ubuntu.com/ubuntu/pool/main/m/mesa/libegl-mesa0_25.2.8-0ubuntu0.24.04.2_amd64.deb) | 117222 | `8ccb85abbc76d53d47d952c975c5630bf305244a2af20e2b262725d1378d73c1` |

All other declared dependencies were checked as installed, including exactly matching libgbm1/mesa-libgallium, libglvnd0 1.7.0, sufficiently recent libdrm2, libc6, libgcc-s1, libexpat1, Wayland client and required XCB libraries. The older noble base libegl-mesa0 should be avoided because it expects older libgbm1/libglapi-mesa.

Download, verify SHA256, and extract these two packages into a task-specific scratch directory. No system installation is needed. Point the process at that extraction:

```text
LD_LIBRARY_PATH=<extract>/usr/lib/x86_64-linux-gnu
__EGL_VENDOR_LIBRARY_FILENAMES=<extract>/usr/share/glvnd/egl_vendor.d/50_mesa.json
LIBGL_ALWAYS_SOFTWARE=1
```

The native addon should keep its bundled ANGLE `libEGL.so` and `libGLESv2.so`; Mesa/GLVND supplies the separate `libEGL.so.1` that ANGLE loads. Check the extracted vendor JSON path after extraction. GLVND's [vendor loader](https://github.com/NVIDIA/libglvnd/blob/master/src/EGL/libeglvendor.c) supports the explicit JSON setting. Mesa documents [software rendering selection](https://docs.mesa3d.org/egl.html) and [`LIBGL_ALWAYS_SOFTWARE`](https://docs.mesa3d.org/envvars.html).

Validation: probe a small ES3 pbuffer, print GL_VERSION and GL_RENDERER, clear to a known color, and verify returned pixel bytes. Successful context creation alone is insufficient for the intended rendering work.

## Other routes

- Xvfb plus existing Mesa GLX is plausible but adds a window-server dependency and is unnecessary if the supported surfaceless path succeeds.
- Vulkan/SwiftShader would require replacing/rebuilding ANGLE with its Vulkan backend and supplying a Vulkan software driver. Merely installing a Vulkan ICD cannot add the missing backend to this bundle.
- Direct Mesa EGL would require adapting this ANGLE-oriented addon and its extension handling; the layered surfaceless path is the smaller change.
- OSMesa is a separate context API, not a drop-in EGL runtime for this addon.
