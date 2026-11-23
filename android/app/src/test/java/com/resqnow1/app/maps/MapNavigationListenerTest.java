package com.resqnow1.app.maps;

import org.junit.Test;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.Assert.*;

public class MapNavigationListenerTest {
    @Test public void aFailedFontOrImageMustNotDestroyHealthyNativeMaps() {
        AtomicInteger clears=new AtomicInteger();
        MapNavigationListener listener=new MapNavigationListener(clears::incrementAndGet,()->{},url->true);
        listener.onReceivedError(null);
        listener.onReceivedHttpError(null);
        assertEquals(0,clears.get());
    }
    @Test public void actualNavigationAndRendererLossStillClearNativeMaps() {
        AtomicInteger clears=new AtomicInteger(),documents=new AtomicInteger();
        MapNavigationListener listener=new MapNavigationListener(clears::incrementAndGet,documents::incrementAndGet,url->"https://localhost/".equals(url));
        listener.onPageStarted(null);
        assertEquals(1,clears.get());assertEquals(1,documents.get());
        listener.onPageCommitVisible(null,"https://localhost/");assertEquals(1,clears.get());
        listener.onPageCommitVisible(null,"https://example.test/");assertEquals(2,clears.get());
        assertFalse(listener.onRenderProcessGone(null,null));assertEquals(3,clears.get());
    }
}
