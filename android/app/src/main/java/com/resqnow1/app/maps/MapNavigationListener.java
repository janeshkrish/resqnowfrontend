package com.resqnow1.app.maps;

import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import com.getcapacitor.WebViewListener;
import java.util.function.Predicate;

/** Document ownership only; a failed font/image is not a new document. */
final class MapNavigationListener extends WebViewListener {
    private final Runnable clearMaps, resetDocument;
    private final Predicate<String> trusted;
    MapNavigationListener(Runnable clearMaps,Runnable resetDocument,Predicate<String> trusted) {
        this.clearMaps=clearMaps;this.resetDocument=resetDocument;this.trusted=trusted;
    }
    @Override public void onPageStarted(WebView view) { clearMaps.run();resetDocument.run(); }
    @Override public void onPageCommitVisible(WebView view,String url) { if(!trusted.test(url)) clearMaps.run(); }
    @Override public boolean onRenderProcessGone(WebView view,RenderProcessGoneDetail detail) { clearMaps.run();return false; }
    // Capacitor 8's error callbacks omit WebResourceRequest and also fire for subresources.
    // Navigation is already covered above; SDK style/license errors belong to MapRenderer.
}
