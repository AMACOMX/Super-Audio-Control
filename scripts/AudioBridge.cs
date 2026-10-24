using System;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Collections.Generic;
using System.IO;
using System.Globalization;
using System.Text;

namespace SuperAudio {
    // ------------------------------------------------------------
    // The bridge is built with the .NET 10 SDK. Keep COM declarations explicit
    // and preserve their native method order; changing this order corrupts the
    // COM vtable contract and can break audio operations at runtime.
    // ------------------------------------------------------------
    // Windows Core Audio COM interop.
    // These declarations intentionally preserve the real COM vtable slots.
    // Derived WASAPI interfaces are declared flat rather than relying on
    // CLR interface inheritance, and session enumeration returns the base
    // IAudioSessionControl before querying for IAudioSessionControl2.
    // ------------------------------------------------------------

    [ComImport, Guid("F4B1A599-7266-4319-A8CA-E70ACB11E8CD"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IAudioSessionControl {
        [PreserveSig] int GetState(out int state);
        [PreserveSig] int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string name);
        [PreserveSig] int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string name, IntPtr eventContext);
        [PreserveSig] int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string path);
        [PreserveSig] int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string path, IntPtr eventContext);
        [PreserveSig] int GetGroupingParam(out Guid param);
        [PreserveSig] int SetGroupingParam(ref Guid param, IntPtr eventContext);
        [PreserveSig] int RegisterAudioSessionNotification(IntPtr client);
        [PreserveSig] int UnregisterAudioSessionNotification(IntPtr client);
    }

    // Explicit IAudioSessionControl2 vtable. Do not inherit the COM interface in C#:
    // Keeping inherited slots explicit avoids ambiguity in COM vtable marshaling.
    [ComImport, Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IAudioSessionControl2 {
        [PreserveSig] int GetState(out int state);
        [PreserveSig] int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string name);
        [PreserveSig] int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string name, IntPtr eventContext);
        [PreserveSig] int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string path);
        [PreserveSig] int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string path, IntPtr eventContext);
        [PreserveSig] int GetGroupingParam(out Guid param);
        [PreserveSig] int SetGroupingParam(ref Guid param, IntPtr eventContext);
        [PreserveSig] int RegisterAudioSessionNotification(IntPtr client);
        [PreserveSig] int UnregisterAudioSessionNotification(IntPtr client);
        [PreserveSig] int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
        [PreserveSig] int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string id);
        [PreserveSig] int GetProcessId(out int pid);
        [PreserveSig] int IsSystemSoundsSession();
        [PreserveSig] int SetDuckingPreference([MarshalAs(UnmanagedType.Bool)] bool optOut);
    }

    [ComImport, Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface ISimpleAudioVolume {
        [PreserveSig] int SetMasterVolume(float level, IntPtr eventContext);
        [PreserveSig] int GetMasterVolume(out float level);
        [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, IntPtr eventContext);
        [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
    }

    [ComImport, Guid("c02216f6-8c67-4b5b-9d00-d008e73e0064"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IAudioMeterInformation {
        [PreserveSig] int GetPeakValue(out float peak);
        [PreserveSig] int GetMeteringChannelCount(out int channelCount);
        [PreserveSig] int GetChannelsPeakValues(int channelCount, [Out] float[] peakValues);
        [PreserveSig] int QueryHardwareSupport(out int hardwareSupportMask);
    }

    // Explicit manager vtable: the first two methods are IAudioSessionManager.
    [ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IAudioSessionManager2 {
        [PreserveSig] int GetAudioSessionControl(ref Guid audioSessionGuid, uint streamFlags, out IAudioSessionControl sessionControl);
        [PreserveSig] int GetSimpleAudioVolume(ref Guid audioSessionGuid, uint streamFlags, out ISimpleAudioVolume audioVolume);
        [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator sessionEnum);
        [PreserveSig] int RegisterSessionNotification(IntPtr sessionNotification);
        [PreserveSig] int UnregisterSessionNotification(IntPtr sessionNotification);
        [PreserveSig] int RegisterDuckNotification(string sessionId, IntPtr duckNotification);
        [PreserveSig] int UnregisterDuckNotification(IntPtr duckNotification);
    }

    [ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IAudioSessionEnumerator {
        [PreserveSig] int GetCount(out int sessionCount);
        [PreserveSig] int GetSession(int index, out IAudioSessionControl session);
    }

    [ComImport, Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IPropertyStore {
        [PreserveSig] int GetCount(out uint count);
        [PreserveSig] int GetAt(uint index, out PROPERTYKEY key);
        [PreserveSig] int GetValue(ref PROPERTYKEY key, out PROPVARIANT value);
        [PreserveSig] int SetValue(ref PROPERTYKEY key, ref PROPVARIANT value);
        [PreserveSig] int Commit();
    }

    [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IMMDevice {
        [PreserveSig] int Activate(ref Guid id, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object interfacePointer);
        [PreserveSig] int OpenPropertyStore(int stgmAccess, out IPropertyStore properties);
        [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
        [PreserveSig] int GetState(out int state);
    }

    [ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IMMDeviceCollection {
        [PreserveSig] int GetCount(out int count);
        [PreserveSig] int Item(int index, out IMMDevice device);
    }

    [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IMMDeviceEnumerator {
        [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection devices);
        [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
        [PreserveSig] int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice device);
        [PreserveSig] int RegisterEndpointNotificationCallback(IntPtr client);
        [PreserveSig] int UnregisterEndpointNotificationCallback(IntPtr client);
    }

    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    public class MMDeviceEnumeratorComObject { }

    // EarTrumpet / Windows Settings per-application endpoint policy API.
    // Windows 11 21H2+ and downlevel expose different interface IIDs/vtables.
    [ComImport, Guid("ab3d4648-e242-459f-b02f-541c70306324"), InterfaceType(ComInterfaceType.InterfaceIsIInspectable)]
    public interface IAudioPolicyConfigFactory21H2 {
        int __incomplete__add_CtxVolumeChange();
        int __incomplete__remove_CtxVolumeChanged();
        int __incomplete__add_RingerVibrateStateChanged();
        int __incomplete__remove_RingerVibrateStateChange();
        int __incomplete__SetVolumeGroupGainForId();
        int __incomplete__GetVolumeGroupGainForId();
        int __incomplete__GetActiveVolumeGroupForEndpointId();
        int __incomplete__GetVolumeGroupsForEndpoint();
        int __incomplete__GetCurrentVolumeContext();
        int __incomplete__SetVolumeGroupMuteForId();
        int __incomplete__GetVolumeGroupMuteForId();
        int __incomplete__SetRingerVibrateState();
        int __incomplete__GetRingerVibrateState();
        int __incomplete__SetPreferredChatApplication();
        int __incomplete__ResetPreferredChatApplication();
        int __incomplete__GetPreferredChatApplication();
        int __incomplete__GetCurrentChatApplications();
        int __incomplete__add_ChatContextChanged();
        int __incomplete__remove_ChatContextChanged();
        [PreserveSig] int SetPersistedDefaultAudioEndpoint(uint processId, int flow, int role, IntPtr deviceId);
        [PreserveSig] int GetPersistedDefaultAudioEndpoint(uint processId, int flow, int role, [Out, MarshalAs(UnmanagedType.HString)] out string deviceId);
        [PreserveSig] int ClearAllPersistedApplicationDefaultEndpoints();
    }

    [ComImport, Guid("2a59116d-6c4f-45e0-a74f-707e3fef9258"), InterfaceType(ComInterfaceType.InterfaceIsIInspectable)]
    public interface IAudioPolicyConfigFactoryDownlevel {
        int __incomplete__add_CtxVolumeChange();
        int __incomplete__remove_CtxVolumeChanged();
        int __incomplete__add_RingerVibrateStateChanged();
        int __incomplete__remove_RingerVibrateStateChange();
        int __incomplete__SetVolumeGroupGainForId();
        int __incomplete__GetVolumeGroupGainForId();
        int __incomplete__GetActiveVolumeGroupForEndpointId();
        int __incomplete__GetVolumeGroupsForEndpoint();
        int __incomplete__GetCurrentVolumeContext();
        int __incomplete__SetVolumeGroupMuteForId();
        int __incomplete__GetVolumeGroupMuteForId();
        int __incomplete__SetRingerVibrateState();
        int __incomplete__GetRingerVibrateState();
        int __incomplete__SetPreferredChatApplication();
        int __incomplete__ResetPreferredChatApplication();
        int __incomplete__GetPreferredChatApplication();
        int __incomplete__GetCurrentChatApplications();
        int __incomplete__add_ChatContextChanged();
        int __incomplete__remove_ChatContextChanged();
        [PreserveSig] int SetPersistedDefaultAudioEndpoint(uint processId, int flow, int role, IntPtr deviceId);
        [PreserveSig] int GetPersistedDefaultAudioEndpoint(uint processId, int flow, int role, [Out, MarshalAs(UnmanagedType.HString)] out string deviceId);
        [PreserveSig] int ClearAllPersistedApplicationDefaultEndpoints();
    }

    internal static class Combase {
        [DllImport("combase.dll", PreserveSig = true)]
        public static extern int RoInitialize(uint initType);

        [DllImport("combase.dll", PreserveSig = true)]
        public static extern void RoUninitialize();

        // .NET 5+ removed built-in WinRT HSTRING/IInspectable marshalling.
        // Use raw ABI pointers here, then invoke the WinRT interface vtable explicitly.
        [DllImport("combase.dll", PreserveSig = true)]
        public static extern int RoGetActivationFactory(
            IntPtr activatableClassIdHString,
            ref Guid iid,
            out IntPtr factory);

        [DllImport("combase.dll", PreserveSig = true)]
        public static extern int WindowsCreateString(
            [MarshalAs(UnmanagedType.LPWStr)] string sourceString,
            uint length,
            out IntPtr hstring);

        [DllImport("combase.dll", PreserveSig = true)]
        public static extern int WindowsDeleteString(IntPtr hstring);
    }

    // AudioPolicyConfig is an internal WinRT runtime class hosted by AudioSes.dll.
    // Calling its exported DllGetActivationFactory directly is the activation path
    // used by modern audio switchers; RoGetActivationFactory alone can resolve a
    // different or unavailable activation path on some Windows 11 builds.
    internal static class AudioSesActivation {
        private static IntPtr _module = IntPtr.Zero;
        private static readonly object ModuleLock = new object();

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true, EntryPoint = "LoadLibraryW")]
        private static extern IntPtr LoadLibraryW(string fileName);

        [DllImport("kernel32.dll", CharSet = CharSet.Ansi, ExactSpelling = true, SetLastError = true, EntryPoint = "GetProcAddress")]
        private static extern IntPtr GetProcAddress(IntPtr module, string procedureName);

        [UnmanagedFunctionPointer(CallingConvention.StdCall)]
        private delegate int DllGetActivationFactoryNative(IntPtr runtimeClassNameHString, out IntPtr activationFactory);

        private static IntPtr GetModule() {
            if (_module != IntPtr.Zero) return _module;
            lock (ModuleLock) {
                if (_module == IntPtr.Zero) {
                    // System32 resolution is safe for this system DLL; the bridge is built win-x64.
                    _module = LoadLibraryW("AudioSes.dll");
                }
                return _module;
            }
        }

        public static int GetFactory(IntPtr runtimeClassNameHString, ref Guid iid, out IntPtr factory) {
            factory = IntPtr.Zero;
            try {
                IntPtr module = GetModule();
                if (module == IntPtr.Zero) {
                    int error = Marshal.GetLastWin32Error();
                    return error != 0 ? unchecked((int)(0x80070000u | ((uint)error & 0xFFFFu))) : unchecked((int)0x80004005);
                }
                IntPtr export = GetProcAddress(module, "DllGetActivationFactory");
                if (export == IntPtr.Zero) {
                    int error = Marshal.GetLastWin32Error();
                    return error != 0 ? unchecked((int)(0x80070000u | ((uint)error & 0xFFFFu))) : unchecked((int)0x80004005);
                }

                DllGetActivationFactoryNative getActivationFactory =
                    Marshal.GetDelegateForFunctionPointer<DllGetActivationFactoryNative>(export);
                IntPtr activationFactory = IntPtr.Zero;
                int hr = getActivationFactory(runtimeClassNameHString, out activationFactory);
                if (hr < 0 || activationFactory == IntPtr.Zero) {
                    if (activationFactory != IntPtr.Zero) { try { Marshal.Release(activationFactory); } catch { } }
                    return hr < 0 ? hr : unchecked((int)0x80004005);
                }

                try {
                    Guid requested = iid;
                    hr = Marshal.QueryInterface(activationFactory, ref requested, out factory);
                    if (hr < 0 && factory != IntPtr.Zero) { try { Marshal.Release(factory); } catch { } factory = IntPtr.Zero; }
                    return hr;
                } finally {
                    try { Marshal.Release(activationFactory); } catch { }
                }
            } catch (Exception ex) {
                Console.Error.WriteLine("[SetEndpoint] AudioSes activation exception: " + ex.GetType().Name + ": " + ex.Message);
                return unchecked((int)0x80004005);
            }
        }
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct PROPERTYKEY {
        public Guid fmtid;
        public uint pid;
    }

    [StructLayout(LayoutKind.Explicit, Size = 24)]
    public struct PROPVARIANT {
        [FieldOffset(0)] public ushort vt;
        [FieldOffset(8)] public IntPtr pwszVal;
    }

    public class Program {
        private static readonly Guid IID_IAudioSessionManager2 = typeof(IAudioSessionManager2).GUID;
        private static readonly Guid IID_IAudioMeterInformation = typeof(IAudioMeterInformation).GUID;

        private const int FLOW_RENDER = 0;
        private const int FLOW_CAPTURE = 1;
        private const int DEVICE_STATE_ACTIVE = 1;
        private const int ROLE_CONSOLE = 0;
        private const int ROLE_MULTIMEDIA = 1;
        private const int CLSCTX_ALL = 23;

        // IUnknown (3 slots) + IInspectable (3 slots) + 19 AudioPolicyConfig
        // methods precede SetPersistedDefaultAudioEndpoint in both known variants.
        private const int SET_PERSISTED_DEFAULT_ENDPOINT_VTABLE_SLOT = 25;

        [UnmanagedFunctionPointer(CallingConvention.StdCall)]
        private delegate int SetPersistedDefaultAudioEndpointNative(
            IntPtr self, uint processId, int flow, int role, IntPtr deviceIdHString);

        private static readonly PROPERTYKEY PKEY_Device_FriendlyName = new PROPERTYKEY {
            fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"),
            pid = 14
        };

        private static string NormalizeExe(string value) {
            if (string.IsNullOrWhiteSpace(value)) return "";
            string n = value.Trim().Trim('"');
            try { n = Path.GetFileName(n); } catch { }
            n = n.ToLowerInvariant();
            if (n.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) n = n.Substring(0, n.Length - 4);
            return n;
        }

        private static string ProcessNameForPid(int pid) {
            try {
                using (var p = Process.GetProcessById(pid)) return p.ProcessName + ".exe";
            } catch { return ""; }
        }

        private static bool SameExecutable(int pid, string targetProc) {
            string expected = NormalizeExe(targetProc);
            if (string.IsNullOrEmpty(expected)) return false;
            try {
                using (var p = Process.GetProcessById(pid)) {
                    return NormalizeExe(p.ProcessName) == expected;
                }
            } catch { return false; }
        }

        private static bool IsTargetSession(IAudioSessionControl2 session, int targetPid, string targetProc, out int sessionPid) {
            sessionPid = 0;
            try {
                int hr = session.GetProcessId(out sessionPid);
                if (hr < 0 || sessionPid <= 0) return false;
                if (targetPid > 0 && sessionPid == targetPid) return true;
                return SameExecutable(sessionPid, targetProc) || SameExecutable(targetPid, ProcessNameForPid(sessionPid));
            } catch { return false; }
        }

        // Capture sessions are deliberately matched more strictly than render sessions.
        // A capture session can be the shared/default microphone session. Muting that
        // session would silence other applications as well. For microphone control we
        // therefore only target sessions whose owner PID belongs to the selected app's
        // process family. We never target a session merely because it happens to be
        // attached to the default capture endpoint.
        private static bool IsTargetCaptureSession(IAudioSessionControl2 session, int targetPid, string targetProc, out int sessionPid) {
            sessionPid = 0;
            try {
                int hr = session.GetProcessId(out sessionPid);
                if (hr < 0 || sessionPid <= 0) return false;

                if (targetPid > 0 && sessionPid == targetPid) return true;

                string expected = NormalizeExe(targetProc);
                if (string.IsNullOrEmpty(expected)) return false;

                // Accept child/worker processes belonging to the same executable, but
                // never reverse-match an arbitrary capture session to the target app.
                return SameExecutable(sessionPid, targetProc);
            } catch { return false; }
        }

        private static ISimpleAudioVolume GetSimpleVolume(IAudioSessionControl session) {
            if (session == null) return null;
            try { return session as ISimpleAudioVolume; } catch { return null; }
        }

        private static bool TrySetRenderSession(int targetPid, string targetProc, bool setMute, float volumeOrMute, out int matched, out string lastError) {
            matched = 0;
            lastError = "";
            try {
                var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumeratorComObject();
                IMMDeviceCollection devices;
                int hr = enumerator.EnumAudioEndpoints(FLOW_RENDER, DEVICE_STATE_ACTIVE, out devices);
                if (hr < 0 || devices == null) { lastError = "EnumAudioEndpoints failed: 0x" + hr.ToString("X8"); return false; }
                int deviceCount = 0;
                devices.GetCount(out deviceCount);

                for (int d = 0; d < deviceCount; d++) {
                    IMMDevice device;
                    if (devices.Item(d, out device) < 0 || device == null) continue;
                    object activated;
                    Guid sessionManagerIid = IID_IAudioSessionManager2;
                    if (device.Activate(ref sessionManagerIid, CLSCTX_ALL, IntPtr.Zero, out activated) < 0 || activated == null) continue;
                    var manager = activated as IAudioSessionManager2;
                    if (manager == null) continue;

                    IAudioSessionEnumerator sessions;
                    if (manager.GetSessionEnumerator(out sessions) < 0 || sessions == null) continue;
                    int count = 0;
                    sessions.GetCount(out count);

                    for (int s = 0; s < count; s++) {
                        IAudioSessionControl control;
                        if (sessions.GetSession(s, out control) < 0 || control == null) continue;
                        var control2 = control as IAudioSessionControl2;
                        if (control2 == null) continue;
                        int sessionPid;
                        if (!IsTargetSession(control2, targetPid, targetProc, out sessionPid)) continue;

                        var volume = GetSimpleVolume(control);
                        if (volume == null) continue;

                        int setHr;
                        if (setMute) {
                            setHr = volume.SetMute(volumeOrMute > 0.5f, IntPtr.Zero);
                        } else {
                            float clamped = Math.Max(0.0f, Math.Min(1.0f, volumeOrMute));
                            setHr = volume.SetMasterVolume(clamped, IntPtr.Zero);
                        }

                        if (setHr >= 0) {
                            matched++;
                        } else {
                            lastError = "Session PID " + sessionPid + " returned HRESULT 0x" + setHr.ToString("X8");
                        }
                    }
                }
                return matched > 0;
            } catch (Exception ex) {
                lastError = ex.GetType().Name + ": " + ex.Message;
                return false;
            }
        }

        private static bool TrySetCaptureSessionMute(int targetPid, string targetProc, bool mute, out int matched, out string lastError) {
            matched = 0;
            lastError = "";
            int matchingSessions = 0;
            try {
                var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumeratorComObject();
                IMMDeviceCollection devices;
                int hr = enumerator.EnumAudioEndpoints(FLOW_CAPTURE, DEVICE_STATE_ACTIVE, out devices);
                if (hr < 0 || devices == null) { lastError = "EnumAudioEndpoints(capture) failed: 0x" + hr.ToString("X8"); return false; }
                int deviceCount = 0;
                devices.GetCount(out deviceCount);

                for (int d = 0; d < deviceCount; d++) {
                    IMMDevice device;
                    if (devices.Item(d, out device) < 0 || device == null) continue;
                    object activated;
                    Guid sessionManagerIid = IID_IAudioSessionManager2;
                    if (device.Activate(ref sessionManagerIid, CLSCTX_ALL, IntPtr.Zero, out activated) < 0 || activated == null) continue;
                    var manager = activated as IAudioSessionManager2;
                    if (manager == null) continue;
                    IAudioSessionEnumerator sessions;
                    if (manager.GetSessionEnumerator(out sessions) < 0 || sessions == null) continue;
                    int count = 0;
                    sessions.GetCount(out count);

                    for (int s = 0; s < count; s++) {
                        IAudioSessionControl control;
                        if (sessions.GetSession(s, out control) < 0 || control == null) continue;
                        var control2 = control as IAudioSessionControl2;
                        if (control2 == null) continue;
                        int sessionPid;
                        if (!IsTargetCaptureSession(control2, targetPid, targetProc, out sessionPid)) continue;
                        matchingSessions++;

                        // ISimpleAudioVolume controls this audio session only. Never
                        // query or mute IAudioEndpointVolume, which would affect every app.
                        var volume = GetSimpleVolume(control);
                        if (volume == null) {
                            lastError = "Capture session PID " + sessionPid + " does not expose ISimpleAudioVolume.";
                            continue;
                        }
                        int setHr = volume.SetMute(mute, IntPtr.Zero);
                        if (setHr < 0) {
                            lastError = "Capture session PID " + sessionPid + " SetMute returned HRESULT 0x" + setHr.ToString("X8");
                            continue;
                        }

                        // Do not report success based on the setter HRESULT alone.
                        // Read the state back so the UI only marks the app muted when
                        // Windows confirms the session's mute flag changed as requested.
                        bool actualMute = false;
                        int verifyHr = volume.GetMute(out actualMute);
                        if (verifyHr < 0) {
                            lastError = "Capture session PID " + sessionPid + " SetMute succeeded, but GetMute verification failed: 0x" + verifyHr.ToString("X8");
                            continue;
                        }
                        if (actualMute != mute) {
                            lastError = "Capture session PID " + sessionPid + " did not retain the requested mute state (requested " + mute + ", reported " + actualMute + ").";
                            continue;
                        }
                        matched++;
                    }
                }
                if (matched == 0 && matchingSessions == 0 && string.IsNullOrWhiteSpace(lastError)) {
                    lastError = "No matching active capture session was found for the selected process.";
                } else if (matched == 0 && matchingSessions > 0 && string.IsNullOrWhiteSpace(lastError)) {
                    lastError = "Matching capture sessions were found, but none accepted session mute control.";
                }
                return matched > 0;
            } catch (Exception ex) {
                lastError = ex.GetType().Name + ": " + ex.Message;
                return false;
            }
        }

        private static bool SetVolume(int targetPid, float volume, string targetProc) {
            float normalized = volume > 1.0f ? volume / 100.0f : volume;
            for (int attempt = 0; attempt < 8; attempt++) {
                int matched; string error;
                if (TrySetRenderSession(targetPid, targetProc, false, normalized, out matched, out error)) return true;
                if (attempt == 7 && !string.IsNullOrEmpty(error)) Console.Error.WriteLine("[SetVolume] " + error);
                System.Threading.Thread.Sleep(75);
            }
            return false;
        }

        private static bool SetMute(int targetPid, bool mute, string targetProc) {
            for (int attempt = 0; attempt < 8; attempt++) {
                int matched; string error;
                if (TrySetRenderSession(targetPid, targetProc, true, mute ? 1.0f : 0.0f, out matched, out error)) return true;
                if (attempt == 7 && !string.IsNullOrEmpty(error)) Console.Error.WriteLine("[SetMute] " + error);
                System.Threading.Thread.Sleep(75);
            }
            return false;
        }

        // Per-app microphone mute first tries ISimpleAudioVolume.SetMute on an active
        // capture session owned by the selected process (or its same-executable worker).
        // This only succeeds when Windows exposes a matching, controllable capture session.
        // If not, the legacy silent-endpoint route is attempted as a fallback. Never
        // mute IAudioEndpointVolume or the physical microphone globally.
        private static string FindSilentCaptureEndpoint() {
            try {
                var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumeratorComObject();
                IMMDeviceCollection capture;
                int hr = enumerator.EnumAudioEndpoints(FLOW_CAPTURE, DEVICE_STATE_ACTIVE, out capture);
                if (hr < 0 || capture == null) return "";
                int count = 0; capture.GetCount(out count);
                string[] markers = {
                    "CABLE Output",
                    "VB-Audio Cable",
                    "VB-Audio",
                    "Virtual Audio Cable",
                    "Silent Microphone",
                    "SAC Silent Mic"
                };
                for (int i = 0; i < count; i++) {
                    IMMDevice dev;
                    if (capture.Item(i, out dev) < 0 || dev == null) continue;
                    string name = GetDeviceFriendlyName(dev);
                    for (int m = 0; m < markers.Length; m++) {
                        if (name.IndexOf(markers[m], StringComparison.OrdinalIgnoreCase) >= 0) {
                            string id = "";
                            if (dev.GetId(out id) >= 0 && !string.IsNullOrWhiteSpace(id)) return id;
                        }
                    }
                }
            } catch { }
            return "";
        }

        private static bool SetMicMute(int targetPid, bool mute, string targetProc, string restoreDeviceId, string preferredMode, out string appliedMode) {
            appliedMode = "";
            if (targetPid <= 0) {
                Console.Error.WriteLine("[SetMicMute] Invalid target process ID.");
                return false;
            }

            string mode = (preferredMode ?? "auto").Trim().ToLowerInvariant();
            if (mode != "session" && mode != "endpoint") mode = "auto";

            // Prefer the documented WASAPI audio-session mute when the target app has
            // an active capture session. This changes that app's session, not the
            // physical microphone endpoint or the machine-wide privacy setting.
            if (mode != "endpoint") {
                int matched;
                string sessionError;
                if (TrySetCaptureSessionMute(targetPid, targetProc, mute, out matched, out sessionError)) {
                    appliedMode = "session";
                    Console.Error.WriteLine("[SetMicMute] Per-app capture-session mute applied to " + matched + " session(s).");
                    return true;
                }

                // If this operation is the restore of a previous session mute and
                // that capture stream has ended, there is nothing left to unmute.
                if (!mute && mode == "session" &&
                    !string.IsNullOrEmpty(sessionError) &&
                    sessionError.StartsWith("No matching active capture session", StringComparison.OrdinalIgnoreCase)) {
                    appliedMode = "session";
                    Console.Error.WriteLine("[SetMicMute] The previous capture session has ended; no active session remains muted.");
                    return true;
                }

                Console.Error.WriteLine("[SetMicMute] Capture-session mute unavailable: " +
                    (string.IsNullOrWhiteSpace(sessionError) ? "No matching muteable capture session was found." : sessionError));
                if (mode == "session") return false;
            }

            // Fallback for apps where Windows does not expose a controllable capture
            // session. Keep the existing endpoint-routing behavior, and remember that
            // it was the method used so unmute restores the original endpoint.
            string deviceId = mute ? FindSilentCaptureEndpoint() : restoreDeviceId;
            if (string.IsNullOrWhiteSpace(deviceId)) {
                Console.Error.WriteLine(mute
                    ? "[SetMicMute] No silent virtual capture endpoint is installed."
                    : "[SetMicMute] No previous capture endpoint was supplied for restore.");
                return false;
            }

            try {
                bool ok = SetPerAppEndpoint(targetPid, deviceId, FLOW_CAPTURE, targetProc);
                if (ok) appliedMode = "endpoint";
                Console.Error.WriteLine(ok
                    ? "[SetMicMute] Capture endpoint routed successfully."
                    : "[SetMicMute] Windows rejected the per-app capture endpoint.");
                return ok;
            } catch (Exception ex) {
                Console.Error.WriteLine("[SetMicMute] " + ex.GetType().Name + ": " + ex.Message);
                return false;
            }
        }

        private const string MMDEVAPI_TOKEN = @"\\?\SWD#MMDEVAPI#";
        private const string DEVINTERFACE_AUDIO_RENDER = "#{e6327cad-dcec-4949-ae8a-991e976a79d2}";
        private const string DEVINTERFACE_AUDIO_CAPTURE = "#{2eef81be-33fa-4800-9670-1cd474972c3f}";

        // IMMDevice.GetId() returns a device-interface path such as
        // \?\SWD#MMDEVAPI#<MMDeviceId>#{audio-interface-guid}.
        // AudioPolicyConfigFactory expects only the inner MMDevice endpoint id.
        // EarTrumpet performs this exact normalization before calling
        // SetPersistedDefaultAudioEndpoint.
        private static string NormalizePolicyDeviceId(string deviceId) {
            if (string.IsNullOrWhiteSpace(deviceId)) return "";
            string normalized = deviceId.Trim();

            if (normalized.StartsWith(MMDEVAPI_TOKEN, StringComparison.OrdinalIgnoreCase))
                normalized = normalized.Substring(MMDEVAPI_TOKEN.Length);

            if (normalized.EndsWith(DEVINTERFACE_AUDIO_RENDER, StringComparison.OrdinalIgnoreCase))
                normalized = normalized.Substring(0, normalized.Length - DEVINTERFACE_AUDIO_RENDER.Length);
            else if (normalized.EndsWith(DEVINTERFACE_AUDIO_CAPTURE, StringComparison.OrdinalIgnoreCase))
                normalized = normalized.Substring(0, normalized.Length - DEVINTERFACE_AUDIO_CAPTURE.Length);

            return normalized;
        }

        private static int ActivateAudioPolicyFactory(Guid iid, out IntPtr factory) {
            factory = IntPtr.Zero;
            const string runtimeClassName = "Windows.Media.Internal.AudioPolicyConfig";
            IntPtr classNameHString = IntPtr.Zero;
            int createHr = Combase.WindowsCreateString(runtimeClassName, (uint)runtimeClassName.Length, out classNameHString);
            if (createHr < 0 || classNameHString == IntPtr.Zero) {
                Console.Error.WriteLine("[SetEndpoint] Could not create activation-class HSTRING: 0x" + createHr.ToString("X8"));
                return createHr < 0 ? createHr : unchecked((int)0x80004005);
            }

            try {
                // Prefer the same activation path used by EarTrumpet's implementation.
                // AudioSes.dll's export is kept as a fallback for Windows builds where
                // RoGetActivationFactory cannot resolve the internal runtime class.
                int roHr = Combase.RoGetActivationFactory(classNameHString, ref iid, out factory);
                if (roHr >= 0 && factory != IntPtr.Zero) {
                    Console.Error.WriteLine("[SetEndpoint] Activated AudioPolicyConfig through RoGetActivationFactory.");
                    return roHr;
                }
                if (factory != IntPtr.Zero) { try { Marshal.Release(factory); } catch { } factory = IntPtr.Zero; }

                int audioSesHr = AudioSesActivation.GetFactory(classNameHString, ref iid, out factory);
                if (audioSesHr >= 0 && factory != IntPtr.Zero) {
                    Console.Error.WriteLine("[SetEndpoint] Activated AudioPolicyConfig through AudioSes.dll fallback.");
                    return audioSesHr;
                }
                if (factory != IntPtr.Zero) { try { Marshal.Release(factory); } catch { } factory = IntPtr.Zero; }

                Console.Error.WriteLine("[SetEndpoint] Both activation paths failed. RoGetActivationFactory=0x" + roHr.ToString("X8") + "; AudioSes.dll=0x" + audioSesHr.ToString("X8") + "; OS=" + Environment.OSVersion.VersionString);
                return audioSesHr < 0 ? audioSesHr : roHr;
            } finally {
                if (classNameHString != IntPtr.Zero) {
                    try { Combase.WindowsDeleteString(classNameHString); } catch { }
                }
            }
        }

        // The AudioPolicyConfig API is flow-specific: the persisted endpoint ID must
        // include the render interface GUID for playback or the capture interface GUID
        // for recording. Do not brute-force unrelated ID formats; construct the canonical
        // representation from the real IMMDevice ID returned by Core Audio.
        private static string PackPolicyDeviceId(string deviceId, int flow) {
            string normalized = NormalizePolicyDeviceId(deviceId);
            if (string.IsNullOrWhiteSpace(normalized)) return "";
            string interfaceId = flow == FLOW_RENDER
                ? DEVINTERFACE_AUDIO_RENDER
                : DEVINTERFACE_AUDIO_CAPTURE;
            return MMDEVAPI_TOKEN + normalized + interfaceId;
        }

        // Route only PIDs that Windows exposes in a session for the requested audio flow.
        // Chromium-based apps may use a child process for their audio service, so the card's
        // main PID is not always the PID that owns the active session. This avoids sending
        // the undocumented policy API arbitrary browser/helper PIDs that own no audio session.
        private static List<int> FindTargetAudioSessionPids(int flow, int targetPid, string targetProc) {
            var matches = new List<int>();
            try {
                var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumeratorComObject();
                IMMDeviceCollection devices;
                int hr = enumerator.EnumAudioEndpoints(flow, DEVICE_STATE_ACTIVE, out devices);
                if (hr < 0 || devices == null) {
                    Console.Error.WriteLine("[SetEndpoint] Could not enumerate " +
                        (flow == FLOW_RENDER ? "playback" : "capture") +
                        " endpoints while resolving the target audio session: 0x" + hr.ToString("X8"));
                    return matches;
                }

                int deviceCount = 0;
                devices.GetCount(out deviceCount);
                for (int d = 0; d < deviceCount; d++) {
                    IMMDevice device;
                    if (devices.Item(d, out device) < 0 || device == null) continue;

                    object activated;
                    Guid sessionManagerIid = IID_IAudioSessionManager2;
                    if (device.Activate(ref sessionManagerIid, CLSCTX_ALL, IntPtr.Zero, out activated) < 0 || activated == null)
                        continue;

                    var manager = activated as IAudioSessionManager2;
                    if (manager == null) continue;

                    IAudioSessionEnumerator sessions;
                    if (manager.GetSessionEnumerator(out sessions) < 0 || sessions == null) continue;

                    int sessionCount = 0;
                    sessions.GetCount(out sessionCount);
                    for (int s = 0; s < sessionCount; s++) {
                        IAudioSessionControl control;
                        if (sessions.GetSession(s, out control) < 0 || control == null) continue;

                        var control2 = control as IAudioSessionControl2;
                        if (control2 == null) continue;

                        int sessionPid;
                        if (!IsTargetSession(control2, targetPid, targetProc, out sessionPid)) continue;

                        int state = 0;
                        try {
                            if (control2.GetState(out state) >= 0 && state == 2) continue; // expired session
                        } catch { }

                        if (sessionPid > 0 && !matches.Contains(sessionPid)) matches.Add(sessionPid);
                    }
                }
            } catch (Exception ex) {
                Console.Error.WriteLine("[SetEndpoint] Audio-session PID discovery failed: " +
                    ex.GetType().Name + ": " + ex.Message);
            }

            return matches;
        }

        private static bool ApplyPolicyEndpoint(IntPtr factoryObject, int processId, int flow, string deviceId) {
            if (processId <= 0 || string.IsNullOrWhiteSpace(deviceId) || factoryObject == IntPtr.Zero) return false;

            string normalized = NormalizePolicyDeviceId(deviceId);
            string packedDeviceId = PackPolicyDeviceId(deviceId, flow);
            if (string.IsNullOrWhiteSpace(normalized) || string.IsNullOrWhiteSpace(packedDeviceId)) {
                Console.Error.WriteLine("[SetEndpoint] Device id became empty after normalization.");
                return false;
            }

            IntPtr deviceIdHString = IntPtr.Zero;
            int consoleHr = unchecked((int)0x80004005);
            int multimediaHr = unchecked((int)0x80004005);
            try {
                int createHr = Combase.WindowsCreateString(packedDeviceId, (uint)packedDeviceId.Length, out deviceIdHString);
                if (createHr < 0 || deviceIdHString == IntPtr.Zero) {
                    Console.Error.WriteLine("[SetEndpoint] WindowsCreateString failed for endpoint id: 0x" + createHr.ToString("X8"));
                    return false;
                }

                IntPtr vtable = Marshal.ReadIntPtr(factoryObject);
                if (vtable == IntPtr.Zero) {
                    Console.Error.WriteLine("[SetEndpoint] AudioPolicyConfig factory returned a null vtable.");
                    return false;
                }

                IntPtr method = Marshal.ReadIntPtr(vtable, SET_PERSISTED_DEFAULT_ENDPOINT_VTABLE_SLOT * IntPtr.Size);
                if (method == IntPtr.Zero) {
                    Console.Error.WriteLine("[SetEndpoint] SetPersistedDefaultAudioEndpoint vtable entry was null.");
                    return false;
                }

                SetPersistedDefaultAudioEndpointNative setter =
                    Marshal.GetDelegateForFunctionPointer<SetPersistedDefaultAudioEndpointNative>(method);

                // Follow the roles used by Windows' per-app volume-mixer preference:
                // Console and Multimedia. Communications is not required for this setting.
                consoleHr = setter(factoryObject, (uint)processId, flow, ROLE_CONSOLE, deviceIdHString);
                multimediaHr = setter(factoryObject, (uint)processId, flow, ROLE_MULTIMEDIA, deviceIdHString);
                bool ok = consoleHr >= 0 || multimediaHr >= 0;

                if (!ok) {
                    Console.Error.WriteLine("[SetEndpoint] Windows rejected the canonical endpoint preference. PID=" + processId +
                        ", flow=" + (flow == FLOW_RENDER ? "render" : "capture") +
                        ", normalizedId='" + normalized + "', packedId='" + packedDeviceId +
                        "', Console HRESULT=0x" + consoleHr.ToString("X8") +
                        ", Multimedia HRESULT=0x" + multimediaHr.ToString("X8") +
                        ". The system-wide default was not changed.");
                }
                return ok;
            } catch (Exception ex) {
                Console.Error.WriteLine("[SetEndpoint] Raw WinRT ABI invocation failed: " +
                    ex.GetType().Name + ": " + ex.Message);
                return false;
            } finally {
                if (deviceIdHString != IntPtr.Zero) {
                    try { Combase.WindowsDeleteString(deviceIdHString); } catch { }
                }
            }
        }

        private static bool SetPerAppEndpoint(int targetPid, string deviceId, int flow, string targetProc) {
            if (targetPid <= 0 || string.IsNullOrWhiteSpace(deviceId)) return false;

            IntPtr factory = IntPtr.Zero;
            try {
                Guid iid21 = typeof(IAudioPolicyConfigFactory21H2).GUID;
                int activationHr = ActivateAudioPolicyFactory(iid21, out factory);
                if (activationHr < 0 || factory == IntPtr.Zero) {
                    Console.Error.WriteLine("[SetEndpoint] 21H2 AudioPolicyConfig factory activation failed: hr=0x" + activationHr.ToString("X8"));
                    if (factory != IntPtr.Zero) { try { Marshal.Release(factory); } catch { } factory = IntPtr.Zero; }

                    Guid iidDown = typeof(IAudioPolicyConfigFactoryDownlevel).GUID;
                    activationHr = ActivateAudioPolicyFactory(iidDown, out factory);
                    if (activationHr < 0 || factory == IntPtr.Zero) {
                        Console.Error.WriteLine("[SetEndpoint] Downlevel AudioPolicyConfig factory activation failed: hr=0x" + activationHr.ToString("X8") +
                            "; OS=" + Environment.OSVersion.VersionString + ". The current Windows build may not expose this undocumented API.");
                        return false;
                    }
                }

                // A persisted application endpoint preference is keyed by process ID.
                // Do not make an active WASAPI session a hard prerequisite: users can
                // choose a device while an application is open but currently idle, and
                // Windows can use the preference when the process opens its next stream.
                // When session-owning child PIDs are available (Chromium/Electron apps),
                // apply to those as well as the selected card's primary PID.
                List<int> targetSessionPids = FindTargetAudioSessionPids(flow, targetPid, targetProc);
                var candidatePids = new List<int>();
                candidatePids.Add(targetPid);
                foreach (int sessionPid in targetSessionPids) {
                    if (sessionPid > 0 && !candidatePids.Contains(sessionPid)) candidatePids.Add(sessionPid);
                }

                if (targetSessionPids.Count == 0) {
                    Console.Error.WriteLine("[SetEndpoint] No matching active " +
                        (flow == FLOW_RENDER ? "playback" : "capture") +
                        " session was found for " + (targetProc ?? "PID " + targetPid) +
                        ". Trying the selected process PID directly; if Windows accepts the persisted preference it may take effect when that app opens its next audio stream.");
                }

                bool anySuccess = false;
                var successfulPids = new List<int>();
                foreach (int candidatePid in candidatePids) {
                    bool pidOk = ApplyPolicyEndpoint(factory, candidatePid, flow, deviceId);
                    if (pidOk) {
                        anySuccess = true;
                        successfulPids.Add(candidatePid);
                    }
                }

                if (anySuccess) {
                    Console.Error.WriteLine("[SetEndpoint] Windows accepted the " +
                        (flow == FLOW_RENDER ? "playback" : "capture") +
                        " preference for " + successfulPids.Count + " PID(s): " +
                        String.Join(",", successfulPids) +
                        (targetSessionPids.Count == 0 ? ". No active audio session existed yet; the preference may apply when a stream starts." : ". Restart or reopen the app's audio stream if it keeps using the old device."));
                } else if (targetSessionPids.Count == 0) {
                    Console.Error.WriteLine("[SetEndpoint] Windows rejected the direct process-PID preference and no matching audio session was found. Start playback/capture, then retry; inspect the HRESULT above to determine whether the endpoint identifier or this Windows build is unsupported.");
                }
                return anySuccess;
            } catch (Exception ex) {
                Console.Error.WriteLine("[SetEndpoint] " + ex.GetType().Name + ": " + ex.Message);
                return false;
            } finally {
                if (factory != IntPtr.Zero) {
                    try { Marshal.Release(factory); } catch { }
                }
            }
        }

        private static string GetDeviceFriendlyName(IMMDevice device) {
            try {
                IPropertyStore store;
                if (device.OpenPropertyStore(0, out store) >= 0 && store != null) {
                    PROPVARIANT value;
                    PROPERTYKEY friendlyNameKey = PKEY_Device_FriendlyName;
                    if (store.GetValue(ref friendlyNameKey, out value) >= 0 && value.pwszVal != IntPtr.Zero) {
                        string name = Marshal.PtrToStringUni(value.pwszVal);
                        if (!string.IsNullOrWhiteSpace(name)) return name;
                    }
                }
            } catch { }
            return "Audio Device";
        }

        private static string Escape(string s) {
            if (s == null) return "";
            var builder = new StringBuilder(s.Length + 8);
            foreach (char ch in s) {
                switch (ch) {
                    case '\\': builder.Append("\\\\"); break;
                    case '\"': builder.Append("\\\""); break;
                    case '\b': builder.Append("\\b"); break;
                    case '\f': builder.Append("\\f"); break;
                    case '\n': builder.Append("\\n"); break;
                    case '\r': builder.Append("\\r"); break;
                    case '\t': builder.Append("\\t"); break;
                    default:
                        if (ch < 0x20) builder.Append("\\u").Append(((int)ch).ToString("x4", CultureInfo.InvariantCulture));
                        else builder.Append(ch);
                        break;
                }
            }
            return builder.ToString();
        }


        // Enumerate actual Windows processes from the self-contained bridge. This
        // avoids relying exclusively on PowerShell, whose launch/JSON output can fail
        // in packaged environments. Access to MainModule/WindowTitle is optional:
        // restricted processes are still returned with an empty path/title.
        private static void PrintProcesses() {
            var items = new List<string>();
            var excluded = new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
                "idle", "system", "registry", "svchost", "fontdrvhost", "dwm",
                "smss", "csrss", "wininit", "services", "lsass", "winlogon",
                "sihost", "taskhostw", "runtimebroker", "conhost"
            };

            try {
                Process[] processes = Process.GetProcesses();
                foreach (Process p in processes) {
                    if (p == null) continue;
                    try {
                        int pid = p.Id;
                        if (pid <= 4) continue;
                        string processName = "";
                        string executablePath = "";
                        string windowTitle = "";
                        long memoryMb = 0;
                        try { processName = p.ProcessName; } catch { continue; }
                        if (string.IsNullOrWhiteSpace(processName) || excluded.Contains(processName)) continue;
                        try {
                            ProcessModule module = p.MainModule;
                            if (module != null && !string.IsNullOrWhiteSpace(module.FileName)) executablePath = module.FileName;
                        } catch { }
                        try { windowTitle = p.MainWindowTitle ?? ""; } catch { }
                        try { memoryMb = Math.Max(0, p.WorkingSet64 / (1024 * 1024)); } catch { }

                        string imageName = processName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)
                            ? processName : processName + ".exe";
                        items.Add(string.Format(CultureInfo.InvariantCulture,
                            "{{\"pid\":{0},\"name\":\"{1}\",\"windowTitle\":\"{2}\",\"executablePath\":\"{3}\",\"memoryMb\":{4}}}",
                            pid, Escape(imageName), Escape(windowTitle), Escape(executablePath), memoryMb));
                    } catch { }
                    finally { try { p.Dispose(); } catch { } }
                }
            } catch (Exception ex) {
                Console.Error.WriteLine("[ListProcesses] " + ex.GetType().Name + ": " + ex.Message);
            }
            Console.WriteLine("[" + string.Join(",", items.ToArray()) + "]");
        }

        private static void PrintEndpoints() {
            var playback = new List<string>();
            var recording = new List<string>();
            try {
                var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumeratorComObject();
                string defaultRender = "";
                string defaultCapture = "";
                try {
                    IMMDevice dev;
                    if (enumerator.GetDefaultAudioEndpoint(FLOW_RENDER, ROLE_CONSOLE, out dev) >= 0 && dev != null) dev.GetId(out defaultRender);
                } catch { }
                try {
                    IMMDevice dev;
                    if (enumerator.GetDefaultAudioEndpoint(FLOW_CAPTURE, ROLE_CONSOLE, out dev) >= 0 && dev != null) dev.GetId(out defaultCapture);
                } catch { }

                IMMDeviceCollection render;
                if (enumerator.EnumAudioEndpoints(FLOW_RENDER, DEVICE_STATE_ACTIVE, out render) >= 0 && render != null) {
                    int count = 0; render.GetCount(out count);
                    for (int i = 0; i < count; i++) {
                        IMMDevice dev; if (render.Item(i, out dev) < 0 || dev == null) continue;
                        string id = ""; dev.GetId(out id);
                        playback.Add(string.Format(CultureInfo.InvariantCulture,
                            "{{\"id\":\"{0}\",\"name\":\"{1}\",\"flow\":\"render\",\"state\":\"active\",\"isDefault\":{2},\"channels\":2,\"sampleRate\":48000}}",
                            Escape(id), Escape(GetDeviceFriendlyName(dev)), id == defaultRender ? "true" : "false"));
                    }
                }

                IMMDeviceCollection capture;
                if (enumerator.EnumAudioEndpoints(FLOW_CAPTURE, DEVICE_STATE_ACTIVE, out capture) >= 0 && capture != null) {
                    int count = 0; capture.GetCount(out count);
                    for (int i = 0; i < count; i++) {
                        IMMDevice dev; if (capture.Item(i, out dev) < 0 || dev == null) continue;
                        string id = ""; dev.GetId(out id);
                        recording.Add(string.Format(CultureInfo.InvariantCulture,
                            "{{\"id\":\"{0}\",\"name\":\"{1}\",\"flow\":\"capture\",\"state\":\"active\",\"isDefault\":{2},\"channels\":2,\"sampleRate\":48000}}",
                            Escape(id), Escape(GetDeviceFriendlyName(dev)), id == defaultCapture ? "true" : "false"));
                    }
                }
            } catch (Exception ex) {
                Console.Error.WriteLine("[GetEndpoints] " + ex.Message);
            }
            Console.WriteLine("{{\"playback\":[{0}],\"recording\":[{1}]}}", string.Join(",", playback.ToArray()), string.Join(",", recording.ToArray()));
        }

        private static void PrintSessions() {
            var list = new List<string>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            try {
                var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumeratorComObject();
                IMMDeviceCollection devices;
                if (enumerator.EnumAudioEndpoints(FLOW_RENDER, DEVICE_STATE_ACTIVE, out devices) < 0 || devices == null) {
                    Console.WriteLine("[]"); return;
                }
                int devCount = 0; devices.GetCount(out devCount);
                for (int d = 0; d < devCount; d++) {
                    IMMDevice dev; if (devices.Item(d, out dev) < 0 || dev == null) continue;
                    string deviceId = ""; try { dev.GetId(out deviceId); } catch { }
                    object activated;
                    Guid sessionManagerIid = IID_IAudioSessionManager2;
                    if (dev.Activate(ref sessionManagerIid, CLSCTX_ALL, IntPtr.Zero, out activated) < 0 || activated == null) continue;
                    var manager = activated as IAudioSessionManager2;
                    if (manager == null) continue;
                    IAudioSessionEnumerator sessionEnum;
                    if (manager.GetSessionEnumerator(out sessionEnum) < 0 || sessionEnum == null) continue;
                    int count = 0; sessionEnum.GetCount(out count);
                    for (int i = 0; i < count; i++) {
                        IAudioSessionControl control; if (sessionEnum.GetSession(i, out control) < 0 || control == null) continue;
                        var control2 = control as IAudioSessionControl2; if (control2 == null) continue;
                        int pid = 0; if (control2.GetProcessId(out pid) < 0 || pid <= 4) continue;
                        string key = pid + "|" + deviceId;
                        if (!seen.Add(key)) continue;

                        string processName = ProcessNameForPid(pid);
                        string displayName = processName;
                        try {
                            string dn; if (control2.GetDisplayName(out dn) >= 0 && !string.IsNullOrWhiteSpace(dn)) displayName = dn;
                        } catch { }

                        int state = 0; try { control2.GetState(out state); } catch { }
                        var volume = GetSimpleVolume(control);
                        float currentVolume = 1f; bool muted = false;
                        if (volume != null) {
                            try { volume.GetMasterVolume(out currentVolume); } catch { }
                            try { volume.GetMute(out muted); } catch { }
                        }

                        float peak = 0f;
                        try {
                            var meter = control2 as IAudioMeterInformation;
                            if (meter != null) meter.GetPeakValue(out peak);
                        } catch { }

                        string exePath = "";
                        try { using (var p = Process.GetProcessById(pid)) exePath = p.MainModule.FileName; } catch { }

                        list.Add(string.Format(CultureInfo.InvariantCulture,
                            "{{\"pid\":{0},\"processName\":\"{1}\",\"displayName\":\"{2}\",\"executablePath\":\"{3}\",\"volume\":{4:0.##},\"isMuted\":{5},\"peakMeter\":{6:0.##},\"state\":{7},\"deviceId\":\"{8}\"}}",
                            pid, Escape(processName), Escape(displayName), Escape(exePath), currentVolume * 100f,
                            muted ? "true" : "false", peak * 100f, state, Escape(deviceId)));
                    }
                }
            } catch (Exception ex) {
                Console.Error.WriteLine("[GetSessions] " + ex.Message);
            }
            Console.WriteLine("[" + string.Join(",", list.ToArray()) + "]");
        }

        private static void PrintDoctor(int pid, string proc) {
            bool renderFound = false;
            bool captureFound = false;
            var renderPids = new List<int>();
            var capturePids = new List<int>();
            try {
                var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumeratorComObject();
                foreach (int flow in new[] { FLOW_RENDER, FLOW_CAPTURE }) {
                    IMMDeviceCollection devices;
                    if (enumerator.EnumAudioEndpoints(flow, DEVICE_STATE_ACTIVE, out devices) < 0 || devices == null) continue;
                    int count = 0; devices.GetCount(out count);
                    for (int d = 0; d < count; d++) {
                        IMMDevice dev; if (devices.Item(d, out dev) < 0 || dev == null) continue;
                        object activated;
                        Guid sessionManagerIid = IID_IAudioSessionManager2;
                        if (dev.Activate(ref sessionManagerIid, CLSCTX_ALL, IntPtr.Zero, out activated) < 0 || activated == null) continue;
                        var manager = activated as IAudioSessionManager2; if (manager == null) continue;
                        IAudioSessionEnumerator sessions; if (manager.GetSessionEnumerator(out sessions) < 0 || sessions == null) continue;
                        int n = 0; sessions.GetCount(out n);
                        for (int i = 0; i < n; i++) {
                            IAudioSessionControl control; if (sessions.GetSession(i, out control) < 0 || control == null) continue;
                            var c2 = control as IAudioSessionControl2; if (c2 == null) continue;
                            int spid;
                            if (IsTargetSession(c2, pid, proc, out spid)) {
                                if (flow == FLOW_RENDER) {
                                    renderFound = true;
                                    if (!renderPids.Contains(spid)) renderPids.Add(spid);
                                } else {
                                    captureFound = true;
                                    if (!capturePids.Contains(spid)) capturePids.Add(spid);
                                }
                            }
                        }
                    }
                }
            } catch { }
            string renderJson = "[" + string.Join(",", renderPids.ConvertAll(x => x.ToString(CultureInfo.InvariantCulture)).ToArray()) + "]";
            string captureJson = "[" + string.Join(",", capturePids.ConvertAll(x => x.ToString(CultureInfo.InvariantCulture)).ToArray()) + "]";
            Console.WriteLine("{{\"renderSession\":{0},\"captureSession\":{1},\"renderPids\":{2},\"capturePids\":{3},\"pid\":{4},\"process\":\"{5}\"}}", renderFound ? "true" : "false", captureFound ? "true" : "false", renderJson, captureJson, pid, Escape(proc));
        }

        public static int Main(string[] args) {
            if (args == null || args.Length == 0) return 1;
            string action = (args[0] ?? "").ToLowerInvariant();

            // Process enumeration does not use WinRT or Core Audio. Run it before
            // attempting RoInitialize so a WinRT activation issue cannot disable
            // the unrelated Scan Apps feature.
            if (action == "ping") { Console.WriteLine("ok"); return 0; }
            if (action == "listprocesses") { PrintProcesses(); return 0; }

            // RoGetActivationFactory is used by the Windows internal audio-policy API.
            // CoInitializeEx alone is not sufficient: the Windows Runtime must be
            // initialized on this thread before calling RoGetActivationFactory.
            // Without this call, endpoint-routing commands fail with CO_E_NOTINITIALIZED.
            int initHr = Combase.RoInitialize(1); // RO_INIT_MULTITHREADED
            bool shouldUninitialize = initHr >= 0;
            const int RPC_E_CHANGED_MODE = unchecked((int)0x80010106);
            if (initHr < 0 && initHr != RPC_E_CHANGED_MODE) {
                Console.Error.WriteLine("[Startup] RoInitialize failed: 0x" + initHr.ToString("X8"));
                return 1;
            }

            try {
                if (action == "getendpoints") { PrintEndpoints(); return 0; }
                if (action == "normalizeid" && args.Length >= 2) {
                    Console.WriteLine(NormalizePolicyDeviceId(args[1])); return 0;
                }
                if (action == "getsessions") { PrintSessions(); return 0; }
                if (action == "doctor" && args.Length >= 2) {
                    int pid = int.Parse(args[1], CultureInfo.InvariantCulture);
                    string proc = args.Length > 2 && !string.IsNullOrWhiteSpace(args[2]) ? args[2] : ProcessNameForPid(pid);
                    PrintDoctor(pid, proc); return 0;
                }
                if (action == "setvolume" && args.Length >= 3) {
                    int pid = int.Parse(args[1], CultureInfo.InvariantCulture);
                    float volume = float.Parse(args[2], CultureInfo.InvariantCulture);
                    string proc = args.Length > 3 && !string.IsNullOrWhiteSpace(args[3]) ? args[3] : ProcessNameForPid(pid);
                    bool ok = SetVolume(pid, volume, proc);
                    Console.WriteLine(ok ? "true" : "false"); return ok ? 0 : 1;
                }
                if (action == "setmute" && args.Length >= 3) {
                    int pid = int.Parse(args[1], CultureInfo.InvariantCulture);
                    bool mute = args[2] == "1" || args[2].Equals("true", StringComparison.OrdinalIgnoreCase);
                    string proc = args.Length > 3 && !string.IsNullOrWhiteSpace(args[3]) ? args[3] : ProcessNameForPid(pid);
                    bool ok = SetMute(pid, mute, proc);
                    Console.WriteLine(ok ? "true" : "false"); return ok ? 0 : 1;
                }
                if (action == "setmicmute" && args.Length >= 3) {
                    int pid = int.Parse(args[1], CultureInfo.InvariantCulture);
                    bool mute = args[2] == "1" || args[2].Equals("true", StringComparison.OrdinalIgnoreCase);
                    string proc = args.Length > 3 && !string.IsNullOrWhiteSpace(args[3]) ? args[3] : ProcessNameForPid(pid);
                    string restoreDevice = args.Length > 4 ? args[4] : "";
                    string preferredMode = args.Length > 5 ? args[5] : "auto";
                    string appliedMode;
                    bool ok = SetMicMute(pid, mute, proc, restoreDevice, preferredMode, out appliedMode);
                    Console.WriteLine(ok ? "true:" + appliedMode : "false"); return ok ? 0 : 1;
                }
                if (action == "setendpoint" && args.Length >= 4) {
                    int pid = int.Parse(args[1], CultureInfo.InvariantCulture);
                    int flow = int.Parse(args[2], CultureInfo.InvariantCulture);
                    string deviceId = args[3];
                    string proc = args.Length > 4 && !string.IsNullOrWhiteSpace(args[4]) ? args[4] : ProcessNameForPid(pid);
                    bool ok = SetPerAppEndpoint(pid, deviceId, flow, proc);
                    Console.WriteLine(ok ? "true" : "false"); return ok ? 0 : 1;
                }
            } catch (Exception ex) {
                Console.Error.WriteLine(ex.ToString()); return 1;
            } finally {
                // RoInitialize returning RPC_E_CHANGED_MODE does not increment its
                // initialization count, so only balance S_OK/S_FALSE with RoUninitialize.
                if (shouldUninitialize) {
                    try { Combase.RoUninitialize(); } catch { }
                }
            }
            return 1;
        }
    }
}
