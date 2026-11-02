package com.resqnow1.app.updates;

import android.content.Context;
import android.util.AtomicFile;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Properties;
import java.util.UUID;

/** All state/artifacts are app-owned; neither belongs in Android backup. */
public final class UpdateStorage {
 private UpdateStorage(){}
 public static File stateFile(Context context){return new File(context.getNoBackupFilesDir(),"apk-update-state.properties");}
 public static UpdateStateStore open(Context context){
  final AtomicFile file=new AtomicFile(stateFile(context));
  return new UpdateStateStore(new UpdateStateStore.Disk(){
   public Properties read()throws IOException {
    Properties data=new Properties();if(!file.getBaseFile().exists()&&!new File(file.getBaseFile()+".bak").exists())return data;
    try(FileInputStream input=file.openRead();ByteArrayOutputStream bytes=new ByteArrayOutputStream()){
     byte[] buffer=new byte[2048];int n;while((n=input.read(buffer))!=-1){if(bytes.size()+n>16384)throw new IOException("Invalid Android update state size");bytes.write(buffer,0,n);}data.load(new ByteArrayInputStream(bytes.toByteArray()));return data;
    }catch(IllegalArgumentException invalid){throw new IOException("Invalid Android update state");}
   }
   public void write(Properties data)throws IOException {
    FileOutputStream output=file.startWrite();try{data.store(output,null);file.finishWrite(output);}catch(IOException|RuntimeException error){file.failWrite(output);throw error;}
   }
  });
 }
 public static String requireGeneration(String generation){if(generation==null||!UUID.fromString(generation).toString().equals(generation))throw new IllegalArgumentException("Invalid updater generation");return generation;}
 public static File directory(Context context)throws IOException {File dir=new File(context.getCacheDir(),"apk-updates");if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("update_storage");return dir;}
 public static File partial(Context context,String generation)throws IOException {return new File(directory(context),requireGeneration(generation)+".part");}
 public static File verified(Context context,String generation)throws IOException {return new File(directory(context),requireGeneration(generation)+".apk");}
 public static void removeArtifacts(Context context,String generation)throws IOException {
  File root=directory(context).getCanonicalFile();for(File file:new File[]{partial(context,generation),verified(context,generation)}){if(!file.getCanonicalFile().getParentFile().equals(root))throw new IOException("update_cache_path");if(file.exists()&&!file.delete())throw new IOException("update_storage");}
 }
}
