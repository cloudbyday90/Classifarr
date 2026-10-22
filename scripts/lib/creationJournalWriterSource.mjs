/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { CREATION_JOURNAL_IDENTITY_SOURCE } from './creationJournalIdentitySource.mjs';

// File-only primitives, intentionally not imported by a VM creator or a CLI.
export const CREATION_JOURNAL_WRITER_QUERY = String.raw`
function Initialize-CreationJournal {
  Add-Type -ErrorAction Stop -TypeDefinition @'
${CREATION_JOURNAL_IDENTITY_SOURCE}
namespace Classifarr.FileJournal {
  public sealed class Writer : IDisposable {
    private readonly FileStream stream;
    private readonly string path, identity;
    private readonly MemoryStream expected=new MemoryStream();
    private bool failed, closeAttempted, closed;
    public int Attempted { get; private set; }
    public int Acknowledged { get; private set; }
    private Writer(FileStream file,string name) {
      stream=file; path=name; identity=Identity.Of(stream.SafeFileHandle,path,false);
      Identity.Private(stream.GetAccessControl());
    }
    public static Writer Create(string path) {
      Identity.PathGuard(path);
      FileStream file=new FileStream(path,FileMode.CreateNew,FileSystemRights.Write|FileSystemRights.ReadPermissions,
        FileShare.Read,4096,FileOptions.WriteThrough,Identity.FileSecurity());
      try { return new Writer(file,path); }
      catch(Exception primary) {
        try { file.Dispose(); } catch(Exception close) { throw new AggregateException(primary,close); }
        throw;
      }
    }
    private static void Frame(byte[] bytes) {
      if(bytes==null || bytes.Length<38 || bytes.Length>65536 || bytes[bytes.Length-1]!=10 ||
        BitConverter.ToUInt32(bytes,0)!=bytes.Length-37) throw new InvalidOperationException();
      using(System.Security.Cryptography.SHA256 sha=System.Security.Cryptography.SHA256.Create()) {
        byte[] digest=sha.ComputeHash(bytes,36,bytes.Length-37);
        for(int i=0;i<32;i++) if(digest[i]!=bytes[i+4]) throw new InvalidOperationException();
      }
    }
    public void Append(byte[] bytes) {
      if(failed || closeAttempted) throw new InvalidOperationException();
      Attempted++;
      try {
        Frame(bytes);
        if(Attempted>32 || stream.Position!=expected.Length || stream.Length!=expected.Length ||
          stream.Position+bytes.Length>524288 || Identity.Of(stream.SafeFileHandle,path,false)!=identity) throw new InvalidOperationException();
        Identity.Private(stream.GetAccessControl());
        long end=stream.Position+bytes.Length;
        stream.Write(bytes,0,bytes.Length);
        if(stream.Position!=end || stream.Length!=end) throw new InvalidOperationException();
        stream.Flush(true);
        expected.Write(bytes,0,bytes.Length); Acknowledged++;
      } catch { failed=true; throw; }
    }
    public void Dispose() {
      if(closeAttempted) throw new InvalidOperationException();
      closeAttempted=true;
      try { stream.Dispose(); closed=true; } catch { failed=true; throw; }
    }
    public bool MatchesFile() {
      using(FileStream read=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.Read)) {
        Identity.Private(read.GetAccessControl());
        return Identity.Of(read.SafeFileHandle,path,false)==identity;
      }
    }
    public byte[] Readback() {
      if(!closed || failed || expected.Length==0 || !MatchesFile()) throw new InvalidOperationException();
      using(FileStream read=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.Read)) {
        if(Identity.Of(read.SafeFileHandle,path,false)!=identity || read.Length!=expected.Length || read.Length>524288) throw new InvalidOperationException();
        Identity.Private(read.GetAccessControl());
        byte[] bytes=new byte[(int)read.Length]; int offset=0;
        while(offset<bytes.Length) {
          int count=read.Read(bytes,offset,bytes.Length-offset);
          if(count<=0) throw new InvalidOperationException(); offset+=count;
        }
        if(read.ReadByte()!=-1) throw new InvalidOperationException();
        byte[] original=expected.ToArray();
        for(int i=0;i<bytes.Length;i++) if(bytes[i]!=original[i]) throw new InvalidOperationException();
        return bytes;
      }
    }
  }
}
'@
}
`;
