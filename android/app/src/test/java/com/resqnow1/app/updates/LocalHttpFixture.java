package com.resqnow1.app.updates;

import java.io.BufferedReader;import java.io.Closeable;import java.io.IOException;import java.io.InputStreamReader;import java.io.OutputStream;import java.net.InetAddress;import java.net.ServerSocket;import java.net.Socket;import java.nio.charset.StandardCharsets;import java.util.LinkedHashMap;import java.util.Locale;

/** Real loopback HTTP fixture using only java.base (Android's test bootclasspath). */
final class LocalHttpFixture implements Closeable {
 interface Handler{void handle(Exchange exchange)throws IOException;}
 static class Headers extends LinkedHashMap<String,String>{void set(String key,String value){put(key.toLowerCase(Locale.ROOT),value);}String getFirst(String key){return get(key.toLowerCase(Locale.ROOT));}}
 static final class Exchange implements Closeable {
  private final Socket socket;private final OutputStream output;private final Headers request=new Headers(),response=new Headers();
  Exchange(Socket socket)throws IOException {
   this.socket=socket;socket.setSoTimeout(5000);output=socket.getOutputStream();BufferedReader input=new BufferedReader(new InputStreamReader(socket.getInputStream(),StandardCharsets.US_ASCII));String first=input.readLine();if(first==null||first.length()>8192)throw new IOException("Invalid fixture request");int size=first.length();String line;
   while((line=input.readLine())!=null&&!line.isEmpty()){size+=line.length();if(size>16384)throw new IOException("Fixture headers too large");int colon=line.indexOf(':');if(colon>0)request.set(line.substring(0,colon),line.substring(colon+1).trim());}
  }
  Headers getRequestHeaders(){return request;}Headers getResponseHeaders(){return response;}OutputStream getResponseBody(){return output;}
  void sendResponseHeaders(int status,long length)throws IOException {StringBuilder header=new StringBuilder("HTTP/1.1 "+status+" Fixture\r\nConnection: close\r\n");if(length>=0)response.set("Content-Length",Long.toString(length));for(java.util.Map.Entry<String,String> e:response.entrySet())header.append(e.getKey()).append(": ").append(e.getValue()).append("\r\n");header.append("\r\n");output.write(header.toString().getBytes(StandardCharsets.US_ASCII));output.flush();}
  public void close()throws IOException {socket.close();}
 }
 private final ServerSocket socket;private final Thread thread;private volatile Throwable failure;
 LocalHttpFixture(Handler handler)throws IOException {
  socket=new ServerSocket(0,10,InetAddress.getByName("127.0.0.1"));thread=new Thread(()->{while(!socket.isClosed()){try(Socket client=socket.accept();Exchange exchange=new Exchange(client)){handler.handle(exchange);}catch(IOException closed){if(!socket.isClosed())failure=closed;}catch(Throwable unexpected){failure=unexpected;}}},"updater-loopback-fixture");thread.setDaemon(true);thread.start();
 }
 int port(){return socket.getLocalPort();}
 public void close()throws IOException {socket.close();try{thread.join(1000);}catch(InterruptedException e){Thread.currentThread().interrupt();}if(failure!=null)throw new IOException("HTTP fixture failed",failure);}
}
