/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

// Fixed C# declarations for Windows PowerShell 5.1's .NET Framework Add-Type.
// Importing this ESM file neither compiles code nor opens a path.
export const CREATION_JOURNAL_IDENTITY_SOURCE = String.raw`
using System;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using Microsoft.Win32.SafeHandles;
namespace Classifarr.FileJournal {
  public static class Identity {
    [StructLayout(LayoutKind.Sequential)]
    private struct Info {
      public uint Attributes; public System.Runtime.InteropServices.ComTypes.FILETIME Created, Accessed, Written;
      public uint Volume, SizeHigh, SizeLow, Links, IndexHigh, IndexLow;
    }
    [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    [DllImport("kernel32.dll", ExactSpelling=true, SetLastError=true)]
    private static extern bool GetFileInformationByHandle(SafeFileHandle handle, out Info info);
    [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, ExactSpelling=true, SetLastError=true)]
    private static extern uint GetFinalPathNameByHandleW(SafeFileHandle handle, StringBuilder name, uint size, uint flags);
    [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, ExactSpelling=true, SetLastError=true)]
    private static extern SafeFileHandle CreateFileW(string name, uint access, uint share, IntPtr security, uint mode, uint flags, IntPtr template);
    public static void PathGuard(string path) {
      if (path==null || path.Length>240 || !Regex.IsMatch(path,@"^[A-Za-z]:\\[A-Za-z0-9 ._()\\-]+$") ||
          !String.Equals(Path.GetFullPath(path),path,StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException();
      foreach(string part in path.Substring(3).Split('\\')) {
        if(part.Length==0 || part.EndsWith(".") || part.EndsWith(" ") ||
          Regex.IsMatch(part,@"^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(\.|$)",RegexOptions.IgnoreCase)) throw new InvalidOperationException();
      }
      DriveInfo drive=new DriveInfo(Path.GetPathRoot(path));
      if(drive.DriveType!=DriveType.Fixed || drive.DriveFormat!="NTFS") throw new InvalidOperationException();
      for(string ancestor=Path.GetDirectoryName(path); ancestor!=null; ancestor=Path.GetDirectoryName(ancestor)) {
        if((File.GetAttributes(ancestor)&FileAttributes.ReparsePoint)!=0) throw new InvalidOperationException();
      }
    }
    public static string Of(SafeFileHandle handle,string path,bool directory) {
      Info info; StringBuilder name=new StringBuilder(512);
      if(handle==null || handle.IsInvalid || handle.IsClosed || !GetFileInformationByHandle(handle,out info) ||
        (info.Attributes&0x400)!=0 || ((info.Attributes&0x10)!=0)!=directory || (!directory && info.Links!=1) ||
        (info.IndexHigh==0 && info.IndexLow==0)) throw new InvalidOperationException();
      uint count=GetFinalPathNameByHandleW(handle,name,512,0);
      if(count==0 || count>=512 || !String.Equals(name.ToString(),@"\\?\"+path,StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException();
      return info.Volume.ToString("x8")+info.IndexHigh.ToString("x8")+info.IndexLow.ToString("x8");
    }
    public static SafeFileHandle PinDirectory(string path) {
      PathGuard(path);
      SafeFileHandle handle=CreateFileW(path,0x80000000,3,IntPtr.Zero,3,0x02200000,IntPtr.Zero);
      try { Of(handle,path,true); Private(Directory.GetAccessControl(path)); return handle; }
      catch { handle.Dispose(); throw; }
    }
    public static void Private(FileSystemSecurity security) {
      byte[] bytes=security.GetSecurityDescriptorBinaryForm();
      RawSecurityDescriptor raw=new RawSecurityDescriptor(bytes,0);
      SecurityIdentifier owner=WindowsIdentity.GetCurrent().User;
      if(!security.AreAccessRulesProtected || (raw.ControlFlags&ControlFlags.DiscretionaryAclPresent)==0 ||
        raw.DiscretionaryAcl==null || raw.DiscretionaryAcl.Count!=1 || !owner.Equals(raw.Owner)) throw new InvalidOperationException();
      AuthorizationRuleCollection rules=security.GetAccessRules(true,true,typeof(SecurityIdentifier));
      if(rules.Count!=1) throw new InvalidOperationException();
      FileSystemAccessRule rule=(FileSystemAccessRule)rules[0];
      if(!owner.Equals(rule.IdentityReference) || rule.AccessControlType!=AccessControlType.Allow || rule.IsInherited ||
        rule.InheritanceFlags!=InheritanceFlags.None || rule.PropagationFlags!=PropagationFlags.None ||
        rule.FileSystemRights!=FileSystemRights.FullControl) throw new InvalidOperationException();
    }
    public static FileSecurity FileSecurity() {
      SecurityIdentifier owner=WindowsIdentity.GetCurrent().User;
      FileSecurity result=new FileSecurity(); result.SetOwner(owner); result.SetAccessRuleProtection(true,false);
      result.AddAccessRule(new FileSystemAccessRule(owner,FileSystemRights.FullControl,AccessControlType.Allow));
      Private(result); return result;
    }
  }
}
`;
