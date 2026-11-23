package com.resqnow1.app.maps;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;
import com.resqnow1.app.BuildConfig;
import java.security.MessageDigest;

final class MapAuth {
    // Public owner signing-certificate fingerprint, not an API key or private secret.
    private static final String OWNER_SHA256="3874c317a48dcd014c0665786a139246890bb0f951561097eb7d2d732bcf6826";
    @SuppressWarnings("deprecation")
    static String unavailable(Context context) {
        if(!BuildConfig.MAPPLS_CONFIGURED) return "AUTH_CONFIG";
        if(!"com.resqnow1.app".equals(context.getPackageName())) return "AUTH_CONFIG";
        try {
            PackageManager pm=context.getPackageManager();
            PackageInfo info=pm.getPackageInfo(context.getPackageName(),Build.VERSION.SDK_INT>=28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES);
            Signature[] signatures=Build.VERSION.SDK_INT>=28 ? info.signingInfo.getApkContentsSigners() : info.signatures;
            if(signatures==null || signatures.length!=1) return "CERTIFICATE";
            byte[] digest=MessageDigest.getInstance("SHA-256").digest(signatures[0].toByteArray());
            StringBuilder hex=new StringBuilder(); for(byte b:digest) hex.append(String.format(java.util.Locale.ROOT,"%02x",b & 255));
            return OWNER_SHA256.equals(hex.toString()) ? null : "CERTIFICATE";
        } catch(Exception ignored) { return "CERTIFICATE"; }
    }
}
