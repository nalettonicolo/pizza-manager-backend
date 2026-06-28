# Legge il token Management API salvato da `supabase login` (Windows Credential Manager).
if (-not ("Cred" -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Cred {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct CREDENTIAL {
    public int Flags; public int Type; public string TargetName; public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public int CredentialBlobSize; public IntPtr CredentialBlob; public int Persist;
    public int AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName;
  }
  [DllImport("advapi32", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credPtr);
  [DllImport("advapi32")] public static extern bool CredFree(IntPtr cred);
  public static string Read(string target) {
    IntPtr n;
    if (!CredRead(target, 1, 0, out n)) return null;
    var c = (CREDENTIAL)Marshal.PtrToStructure(n, typeof(CREDENTIAL));
    var bytes = new byte[c.CredentialBlobSize];
    Marshal.Copy(c.CredentialBlob, bytes, 0, c.CredentialBlobSize);
    CredFree(n);
    return Encoding.UTF8.GetString(bytes).TrimEnd('\0');
  }
}
'@
}

$token = [Cred]::Read("Supabase CLI:supabase")
if (-not $token) {
  $token = $env:SUPABASE_ACCESS_TOKEN
}
if (-not $token) {
  Write-Error "Token assente. Esegui: npx supabase login"
  exit 1
}
Write-Output $token
