<#
.SYNOPSIS
    Super Audio Control - Windows Core Audio / WASAPI COM Bridge
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("SetVolume", "SetMute", "SetMicMute", "GetSessions", "GetEndpoints")]
    [string]$Action,

    [int]$TargetPid = 0,
    [string]$ProcessName = "",
    [float]$Volume = 1.0,
    [int]$Mute = 0,
    [string]$DeviceId = ""
)

$ErrorActionPreference = "SilentlyContinue"

$csharpCode = @'
using System;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Collections.Generic;

namespace SuperAudioNative {
    [Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface ISimpleAudioVolume {
        [PreserveSig] int SetMasterVolume(float fLevel, [In] ref Guid EventContext);
        [PreserveSig] int GetMasterVolume(out float pfLevel);
        [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, [In] ref Guid EventContext);
        [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool pbMute);
    }

    [Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IAudioSessionControl2 {
        [PreserveSig] int GetState(out int state);
        [PreserveSig] int GetDisplayName(out IntPtr name);
        [PreserveSig] int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string name, [In] ref Guid EventContext);
        [PreserveSig] int GetIconPath(out IntPtr path);
        [PreserveSig] int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string path, [In] ref Guid EventContext);
        [PreserveSig] int GetGroupingParam(out Guid param);
        [PreserveSig] int SetGroupingParam([In] ref Guid param, [In] ref Guid EventContext);
        [PreserveSig] int RegisterAudioSessionNotification(IntPtr client);
        [PreserveSig] int UnregisterAudioSessionNotification(IntPtr client);
        [PreserveSig] int GetSessionIdentifier(out IntPtr id);
        [PreserveSig] int GetSessionInstanceIdentifier(out IntPtr id);
        [PreserveSig] int GetProcessId(out int pid);
        [PreserveSig] int IsSystemSoundsSession();
        [PreserveSig] int SetDuckingPreference([MarshalAs(UnmanagedType.Bool)] bool optOut);
    }

    [Guid("E2F5EE11-070C-4010-8709-9277A6DCDA58"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IAudioSessionEnumerator {
        [PreserveSig] int GetCount(out int sessionCount);
        [PreserveSig] int GetSession(int sessionIndex, [MarshalAs(UnmanagedType.IUnknown)] out object session);
    }

    [Guid("77AA99A0-1BD6-484F-BC23-F00CE0E05D52"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IAudioSessionManager2 {
        [PreserveSig] int GetAudioSessionControl([In] ref Guid AudioSessionGuid, uint StreamFlags, out IntPtr SessionControl);
        [PreserveSig] int GetSimpleAudioVolume([In] ref Guid AudioSessionGuid, uint StreamFlags, out ISimpleAudioVolume AudioVolume);
        [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator SessionEnum);
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct PROPERTYKEY {
        public Guid fmtid;
        public uint pid;
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct PROPVARIANT {
        [FieldOffset(0)] public short vt;
        [FieldOffset(8)] public IntPtr pwszVal;
    }

    [Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IPropertyStore {
        [PreserveSig] int GetCount(out uint cProps);
        [PreserveSig] int GetAt(uint iProp, out PROPERTYKEY pkey);
        [PreserveSig] int GetValue(ref PROPERTYKEY key, out PROPVARIANT pv);
        [PreserveSig] int SetValue(ref PROPERTYKEY key, ref PROPVARIANT propvar);
        [PreserveSig] int Commit();
    }

    [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IMMDevice {
        [PreserveSig] int Activate([In] ref Guid id, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object interfacePointer);
        [PreserveSig] int OpenPropertyStore(int stgmAccess, out IPropertyStore properties);
        [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string strId);
        [PreserveSig] int GetState(out int pdwState);
    }

    [Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IMMDeviceCollection {
        [PreserveSig] int GetCount(out int pcDevices);
        [PreserveSig] int Item(int nDevice, out IMMDevice ppDevice);
    }

    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IMMDeviceEnumerator {
        [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection devices);
        [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
    }

    [Guid("5BC648F6-2820-4786-B4A4-225A15EC40FD"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IAudioEndpointVolume {
        [PreserveSig] int RegisterControlChangeNotify(IntPtr pNotify);
        [PreserveSig] int UnregisterControlChangeNotify(IntPtr pNotify);
        [PreserveSig] int GetChannelCount(out uint pnChannelCount);
        [PreserveSig] int SetMasterVolumeLevel(float fLevelDB, [In] ref Guid EventContext);
        [PreserveSig] int SetMasterVolumeLevelScalar(float fLevel, [In] ref Guid EventContext);
        [PreserveSig] int GetMasterVolumeLevel(out float pfLevelDB);
        [PreserveSig] int GetMasterVolumeLevelScalar(out float pfLevel);
        [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, [In] ref Guid EventContext);
        [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool pbMute);
    }

    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    public class MMDeviceEnumeratorComObject { }

    public class CoreAudioAPI {
        private static Guid IID_IAudioSessionManager2 = typeof(IAudioSessionManager2).GUID;
        private static Guid IID_IAudioEndpointVolume = typeof(IAudioEndpointVolume).GUID;

        private static PROPERTYKEY PKEY_Device_FriendlyName = new PROPERTYKEY {
            fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"),
            pid = 14
        };

        private static string GetDeviceFriendlyName(IMMDevice dev) {
            try {
                IPropertyStore store;
                dev.OpenPropertyStore(0, out store);
                if (store != null) {
                    PROPVARIANT pv;
                    store.GetValue(ref PKEY_Device_FriendlyName, out pv);
                    if (pv.pwszVal != IntPtr.Zero) {
                        return Marshal.PtrToStringUni(pv.pwszVal);
                    }
                }
            } catch {}
            return "Audio Device";
        }

        private static bool MatchSession(int sPid, int targetPid, string targetProcessName) {
            if (targetPid > 0 && sPid == targetPid) return true;
            if (!string.IsNullOrEmpty(targetProcessName)) {
                try {
                    var p = Process.GetProcessById(sPid);
                    string cleanTarget = targetProcessName.Replace(".exe", "").Trim().ToLower();
                    if (p.ProcessName.ToLower() == cleanTarget) return true;
                } catch {}
            }
            if (targetPid > 0) {
                try {
                    var tp = Process.GetProcessById(targetPid);
                    var sp = Process.GetProcessById(sPid);
                    if (tp.ProcessName.ToLower() == sp.ProcessName.ToLower()) return true;
                } catch {}
            }
            return false;
        }

        public static bool SetVolume(int targetPid, string procName, float volume) {
            float clamped = Math.Max(0.0f, Math.Min(1.0f, volume));
            bool ok = false;
            try {
                var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
                IMMDeviceCollection coll;
                enumerator.EnumAudioEndpoints(0, 1, out coll);
                int count = 0;
                coll.GetCount(out count);
                for (int d = 0; d < count; d++) {
                    IMMDevice dev;
                    coll.Item(d, out dev);
                    object o;
                    dev.Activate(ref IID_IAudioSessionManager2, 23, IntPtr.Zero, out o);
                    var mgr = o as IAudioSessionManager2;
                    if (mgr == null) continue;
                    IAudioSessionEnumerator sEnum;
                    mgr.GetSessionEnumerator(out sEnum);
                    if (sEnum == null) continue;
                    int sCount = 0;
                    sEnum.GetCount(out sCount);
                    for (int s = 0; s < sCount; s++) {
                        object rawSession;
                        if (sEnum.GetSession(s, out rawSession) != 0 || rawSession == null) continue;
                        var ctl = rawSession as IAudioSessionControl2;
                        if (ctl == null) continue;
                        int sPid = 0;
                        ctl.GetProcessId(out sPid);
                        if (MatchSession(sPid, targetPid, procName)) {
                            var vol = rawSession as ISimpleAudioVolume;
                            if (vol != null) {
                                Guid g = Guid.Empty;
                                int hr = vol.SetMasterVolume(clamped, ref g);
                                if (hr >= 0) ok = true;
                            }
                        }
                    }
                }
            } catch {}
            return ok;
        }

        public static bool SetMute(int targetPid, string procName, bool mute) {
            bool ok = false;
            try {
                var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
                IMMDeviceCollection coll;
                enumerator.EnumAudioEndpoints(0, 1, out coll);
                int count = 0;
                coll.GetCount(out count);
                for (int d = 0; d < count; d++) {
                    IMMDevice dev;
                    coll.Item(d, out dev);
                    object o;
                    dev.Activate(ref IID_IAudioSessionManager2, 23, IntPtr.Zero, out o);
                    var mgr = o as IAudioSessionManager2;
                    if (mgr == null) continue;
                    IAudioSessionEnumerator sEnum;
                    mgr.GetSessionEnumerator(out sEnum);
                    if (sEnum == null) continue;
                    int sCount = 0;
                    sEnum.GetCount(out sCount);
                    for (int s = 0; s < sCount; s++) {
                        object rawSession;
                        if (sEnum.GetSession(s, out rawSession) != 0 || rawSession == null) continue;
                        var ctl = rawSession as IAudioSessionControl2;
                        if (ctl == null) continue;
                        int sPid = 0;
                        ctl.GetProcessId(out sPid);
                        if (MatchSession(sPid, targetPid, procName)) {
                            var vol = rawSession as ISimpleAudioVolume;
                            if (vol != null) {
                                Guid g = Guid.Empty;
                                int hr = vol.SetMute(mute, ref g);
                                if (hr >= 0) ok = true;
                            }
                        }
                    }
                }
            } catch {}
            return ok;
        }

        public static bool SetMicMute(int targetPid, string procName, bool mute) {
            bool ok = false;
            try {
                var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
                IMMDeviceCollection coll;
                enumerator.EnumAudioEndpoints(1, 1, out coll);
                int count = 0;
                coll.GetCount(out count);
                for (int d = 0; d < count; d++) {
                    IMMDevice dev;
                    coll.Item(d, out dev);
                    object o;
                    dev.Activate(ref IID_IAudioSessionManager2, 23, IntPtr.Zero, out o);
                    var mgr = o as IAudioSessionManager2;
                    if (mgr == null) continue;
                    IAudioSessionEnumerator sEnum;
                    mgr.GetSessionEnumerator(out sEnum);
                    if (sEnum == null) continue;
                    int sCount = 0;
                    sEnum.GetCount(out sCount);
                    for (int s = 0; s < sCount; s++) {
                        object rawSession;
                        if (sEnum.GetSession(s, out rawSession) != 0 || rawSession == null) continue;
                        var ctl = rawSession as IAudioSessionControl2;
                        if (ctl == null) continue;
                        int sPid = 0;
                        ctl.GetProcessId(out sPid);
                        if (MatchSession(sPid, targetPid, procName)) {
                            var vol = rawSession as ISimpleAudioVolume;
                            if (vol != null) {
                                Guid g = Guid.Empty;
                                int hr = vol.SetMute(mute, ref g);
                                if (hr >= 0) ok = true;
                            }
                        }
                    }
                }
                if (!ok) {
                    IMMDevice defMic;
                    enumerator.GetDefaultAudioEndpoint(1, 0, out defMic);
                    if (defMic != null) {
                        object o;
                        defMic.Activate(ref IID_IAudioEndpointVolume, 23, IntPtr.Zero, out o);
                        var ep = o as IAudioEndpointVolume;
                        if (ep != null) {
                            Guid g = Guid.Empty;
                            ep.SetMute(mute, ref g);
                            ok = true;
                        }
                    }
                }
            } catch {}
            return ok;
        }

        public static string GetEndpointsJson() {
            var playList = new List<string>();
            var recList = new List<string>();
            try {
                var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
                string defPlayId = "";
                string defRecId = "";
                try {
                    IMMDevice defPlay;
                    enumerator.GetDefaultAudioEndpoint(0, 0, out defPlay);
                    if (defPlay != null) defPlay.GetId(out defPlayId);
                } catch {}
                try {
                    IMMDevice defRec;
                    enumerator.GetDefaultAudioEndpoint(1, 0, out defRec);
                    if (defRec != null) defRec.GetId(out defRecId);
                } catch {}

                IMMDeviceCollection coll;
                enumerator.EnumAudioEndpoints(0, 1, out coll);
                int count = 0;
                coll.GetCount(out count);
                for (int i = 0; i < count; i++) {
                    IMMDevice dev;
                    coll.Item(i, out dev);
                    string id;
                    dev.GetId(out id);
                    string name = GetDeviceFriendlyName(dev);
                    bool isDef = (!string.IsNullOrEmpty(defPlayId) && id == defPlayId) || (string.IsNullOrEmpty(defPlayId) && i == 0);
                    string item = string.Format("{{\"id\":\"{0}\",\"name\":\"{1}\",\"flow\":\"render\",\"state\":\"active\",\"isDefault\":{2}}}",
                        id.Replace("\\", "\\\\"), name.Replace("\\", "\\\\").Replace("\"", "\\\""), isDef ? "true" : "false");
                    playList.Add(item);
                }

                IMMDeviceCollection recColl;
                enumerator.EnumAudioEndpoints(1, 1, out recColl);
                int recCount = 0;
                recColl.GetCount(out recCount);
                for (int i = 0; i < recCount; i++) {
                    IMMDevice dev;
                    recColl.Item(i, out dev);
                    string id;
                    dev.GetId(out id);
                    string name = GetDeviceFriendlyName(dev);
                    bool isDef = (!string.IsNullOrEmpty(defRecId) && id == defRecId) || (string.IsNullOrEmpty(defRecId) && i == 0);
                    string item = string.Format("{{\"id\":\"{0}\",\"name\":\"{1}\",\"flow\":\"capture\",\"state\":\"active\",\"isDefault\":{2}}}",
                        id.Replace("\\", "\\\\"), name.Replace("\\", "\\\\").Replace("\"", "\\\""), isDef ? "true" : "false");
                    recList.Add(item);
                }
            } catch {}

            return string.Format("{{\"playback\":[{0}],\"recording\":[{1}]}}", string.Join(",", playList.ToArray()), string.Join(",", recList.ToArray()));
        }

        public static string GetSessionsJson() {
            var list = new List<string>();
            try {
                var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
                IMMDeviceCollection coll;
                enumerator.EnumAudioEndpoints(0, 1, out coll);
                int devCount = 0;
                coll.GetCount(out devCount);
                var seenPids = new HashSet<int>();
                for (int d = 0; d < devCount; d++) {
                    IMMDevice dev;
                    coll.Item(d, out dev);
                    string devId = "";
                    try { dev.GetId(out devId); } catch {}
                    object o;
                    dev.Activate(ref IID_IAudioSessionManager2, 23, IntPtr.Zero, out o);
                    var mgr = o as IAudioSessionManager2;
                    if (mgr == null) continue;
                    IAudioSessionEnumerator sessionEnum;
                    mgr.GetSessionEnumerator(out sessionEnum);
                    if (sessionEnum == null) continue;
                    int sCount = 0;
                    sessionEnum.GetCount(out sCount);
                    for (int s = 0; s < sCount; s++) {
                        object rawSession;
                        if (sessionEnum.GetSession(s, out rawSession) != 0 || rawSession == null) continue;
                        var ctl = rawSession as IAudioSessionControl2;
                        if (ctl == null) continue;
                        int sPid = 0;
                        ctl.GetProcessId(out sPid);
                        if (sPid <= 4 || seenPids.Contains(sPid)) continue;
                        seenPids.Add(sPid);
                        var vol = rawSession as ISimpleAudioVolume;
                        float curVol = 1.0f;
                        bool curMute = false;
                        if (vol != null) {
                            vol.GetMasterVolume(out curVol);
                            vol.GetMute(out curMute);
                        }
                        string pName = "";
                        string dName = "";
                        string pPath = "";
                        try {
                            var p = Process.GetProcessById(sPid);
                            pName = p.ProcessName + ".exe";
                            dName = string.IsNullOrEmpty(p.MainWindowTitle) ? p.ProcessName : p.MainWindowTitle;
                            try { pPath = p.MainModule.FileName; } catch {}
                        } catch {
                            pName = "Process " + sPid;
                            dName = pName;
                        }
                        int volPct = (int)Math.Round(curVol * 100);
                        string muteStr = curMute ? "true" : "false";
                        string item = string.Format("{{\"pid\":{0},\"processName\":\"{1}\",\"displayName\":\"{2}\",\"executablePath\":\"{3}\",\"volume\":{4},\"isMuted\":{5},\"deviceId\":\"{6}\"}}",
                            sPid,
                            pName.Replace("\\", "/").Replace("\"", "'"),
                            dName.Replace("\\", "/").Replace("\"", "'"),
                            pPath.Replace("\\", "/").Replace("\"", "'"),
                            volPct,
                            muteStr,
                            devId.Replace("\\", "/").Replace("\"", "'")
                        );
                        list.Add(item);
                    }
                }
            } catch {}
            return "[" + string.Join(",", list.ToArray()) + "]";
        }
    }
}
'@

if (-not ([System.Management.Automation.PSTypeName]'SuperAudioNative.CoreAudioAPI').Type) {
    Add-Type -TypeDefinition $csharpCode -Language CSharp
}

switch ($Action) {
    "SetVolume" {
        $ok = [SuperAudioNative.CoreAudioAPI]::SetVolume($TargetPid, $ProcessName, $Volume)
        Write-Output ($ok.ToString().ToLower())
    }
    "SetMute" {
        $ok = [SuperAudioNative.CoreAudioAPI]::SetMute($TargetPid, $ProcessName, ($Mute -ne 0))
        Write-Output ($ok.ToString().ToLower())
    }
    "SetMicMute" {
        $ok = [SuperAudioNative.CoreAudioAPI]::SetMicMute($TargetPid, $ProcessName, ($Mute -ne 0))
        Write-Output ($ok.ToString().ToLower())
    }
    "GetEndpoints" {
        $json = [SuperAudioNative.CoreAudioAPI]::GetEndpointsJson()
        Write-Output $json
    }
    "GetSessions" {
        $json = [SuperAudioNative.CoreAudioAPI]::GetSessionsJson()
        Write-Output $json
    }
}
