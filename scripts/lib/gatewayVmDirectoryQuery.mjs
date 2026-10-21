/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

// Fixed Windows boundary embedded in the ESM creator. No caller-selected native
// library/code; declaration alone does not create a directory. Do not substitute
// Directory.CreateDirectory: it accepts an existing target rather than refusing.
export const PRIVATE_DIRECTORY_QUERY = String.raw`
  function Initialize-PrivateDirectoryNative {
    Add-Type -ErrorAction Stop -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace Classifarr.StudyVm {
  public static class NativeDirectory {
    [StructLayout(LayoutKind.Sequential)]
    private struct SecurityAttributes {
      public int Length;
      public IntPtr Descriptor;
      public int InheritHandle;
    }
    [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CreateDirectoryW(string path, ref SecurityAttributes attributes);
    public static int Create(string path, byte[] descriptor) {
      if (descriptor == null || descriptor.Length < 20 || descriptor.Length > 16384)
        throw new ArgumentException();
      GCHandle pinned = GCHandle.Alloc(descriptor, GCHandleType.Pinned);
      try {
        SecurityAttributes attributes = new SecurityAttributes();
        attributes.Length = Marshal.SizeOf(typeof(SecurityAttributes));
        attributes.Descriptor = pinned.AddrOfPinnedObject();
        attributes.InheritHandle = 0;
        if (CreateDirectoryW(path, ref attributes)) return 0;
        int error = Marshal.GetLastWin32Error();
        return error == 0 ? -1 : error;
      } finally { pinned.Free(); }
    }
  }
}
'@
  }
  function New-ExclusiveDirectory([string]$path,[Security.AccessControl.DirectorySecurity]$security) {
    if (!$security.AreAccessRulesProtected) { throw 'directory_not_protected' };
    $code=[Classifarr.StudyVm.NativeDirectory]::Create($path,$security.GetSecurityDescriptorBinaryForm());
    switch ($code) {
      0 { return }
      80 { throw 'directory_exists' }
      183 { throw 'directory_exists' }
      3 { throw 'not_found' }
      5 { throw 'access_denied' }
      default { throw 'query_failed' }
    }
  }
`;
